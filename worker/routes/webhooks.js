// Webhooks de pago — port de backend/routes/pagos-webhooks.js
// Mercado Pago: se consulta su API REST (el SDK de Node no corre en Workers). El aviso
// solo dispara una consulta a MP con NUESTRO token, así que no se puede falsificar el estado.
// Hotmart: antes no se verificaba nada → cualquiera podía activar premium a cualquier correo.
// Ahora se valida el header X-HOTMART-HOTTOK contra el secreto HOTMART_HOTTOK.
import { Hono } from 'hono';
import { firestore } from '../lib/firestore.js';
import { sendMail } from '../lib/email.js';
import { aplicarPremium } from '../lib/premium.js';

const r = new Hono();

const htmlHotmart = (userData) => `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#fff;border-radius:16px;">
              <h2 style="color:#10b981;">⭐ ¡Bienvenido a Premium!</h2>
              <p>Hola ${userData.name || ''},</p>
              <p>Tu suscripción Premium ya está activa. Ahora tienes acceso completo a FitTrack Pro.</p>
              <a href="https://fittrackpro.store" style="display:inline-block;margin-top:16px;background:#10b981;color:#000;font-weight:900;padding:12px 24px;border-radius:12px;text-decoration:none;">Abrir FitTrack Pro →</a>
            </div>`;
const htmlMP = (userData) => `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#fff;border-radius:16px;">
              <h2 style="color:#10b981;">⭐ ¡Bienvenido a Premium!</h2>
              <p>Hola ${userData.name || ''},</p>
              <p>Tu suscripción Premium ya está activa. Ahora tienes acceso a:</p>
              <ul style="color:#94a3b8;line-height:2;">
                <li>📅 Plan completo 7 días</li>
                <li>🔄 Alternativas ilimitadas</li>
                <li>🛒 Lista del súper automática</li>
                <li>📸 Fotos de progreso con análisis IA</li>
                <li>💬 Chat ilimitado con tu coach</li>
              </ul>
              <a href="https://fittrackpro.store" style="display:inline-block;margin-top:16px;background:#10b981;color:#000;font-weight:900;padding:12px 24px;border-radius:12px;text-decoration:none;">Abrir FitTrack Pro →</a>
            </div>`;

async function mp(env, path) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`MP ${path}: ${data.message || res.status}`);
  return data;
}

// Eventos de Hotmart que retiran premium: cancelación, reembolso, contracargo y disputa.
const QUITAN_PREMIUM = new Set(['SUBSCRIPTION_CANCELLATION', 'PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK', 'PURCHASE_PROTEST']);

r.post('/webhook-hotmart', async (c) => {
  try {
    const esperado = (c.env.HOTMART_HOTTOK || '').trim();
    if (!esperado) {
      console.error('⚠️ webhook-hotmart rechazado: falta el secreto HOTMART_HOTTOK');
      return c.text('Hotmart no configurado', 503);
    }
    // Hotmart manda el hottok en el header X-HOTMART-HOTTOK (webhook 2.0) y en
    // algunos eventos/versiones también en el cuerpo ("hottok") o en la URL.
    let body = {};
    const crudo = await c.req.text();
    try { body = JSON.parse(crudo); }
    catch { body = Object.fromEntries(new URLSearchParams(crudo)); } // postback 1.0 (formulario)
    const fuentes = {
      header: c.req.header('X-HOTMART-HOTTOK'),
      cuerpo: body?.hottok,
      url: c.req.query('hottok'),
    };
    const coincide = Object.values(fuentes).some(v => typeof v === 'string' && v.trim() === esperado);
    if (!coincide) {
      const diag = Object.entries(fuentes).map(([k, v]) => `${k}=${v ? 'len' + String(v).trim().length : 'vacío'}`).join(' ');
      console.warn(`⚠️ webhook-hotmart hottok inválido | esperado len${esperado.length} | ${diag} | evento=${body?.event}`);
      return c.text('No autorizado', 401);
    }

    const { event, data } = body;
    // Compras traen el correo en data.buyer; cancelaciones de suscripción, en data.subscriber.
    const email = (data?.buyer?.email || data?.subscriber?.email || data?.subscription?.subscriber?.email || '').trim() || null;
    console.log('🔥 Webhook Hotmart:', event, email);
    if (!email) return c.text('ok');

    const db = firestore(c.env);
    const rows = await db.query('users', { where: [['email', '==', email]], limit: 1 });

    if (event === 'PURCHASE_APPROVED' || event === 'SUBSCRIPTION_REACTIVATED') {
      if (rows.length) {
        const { cambio } = await aplicarPremium(db, rows[0], true, {
          premiumStatus: 'authorized', premiumSource: 'hotmart',
          hotmartTransactionId: data?.purchase?.transaction || null,
        });
        console.log(`✅ Hotmart premium activado: ${email}${cambio ? '' : ' (ya era premium, renovación)'}`);
        if (cambio) {
          try {
            await sendMail(c.env, { to: email, subject: '⭐ ¡Ya eres Premium en FitTrack Pro!', html: htmlHotmart(rows[0].data) });
          } catch (e) { console.error('Error email hotmart:', e.message); }
        }
      } else {
        await db.set(`premiumPendiente/${email}`, {
          email, source: 'hotmart', ts: Date.now(), transactionId: data?.purchase?.transaction || null,
        });
        console.log(`⏳ Hotmart premium pendiente (usuario sin cuenta): ${email}`);
      }
    } else if (QUITAN_PREMIUM.has(event)) {
      if (rows.length) {
        await aplicarPremium(db, rows[0], false, { premiumStatus: event.toLowerCase() });
        console.log(`❌ Hotmart premium retirado (${event}): ${email}`);
      } else {
        // Pagó sin tener cuenta y luego canceló/reembolsó/disputó: que no quede premium al registrarse.
        await db.delete(`premiumPendiente/${email}`);
        console.log(`🗑️ Hotmart premium pendiente eliminado (${event}): ${email}`);
      }
    }
    return c.text('ok');
  } catch (e) {
    console.error('webhook-hotmart error:', e.message);
    return c.text('error', 500);
  }
});

r.post('/webhook', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    // Mercado Pago a veces manda la notificación por query (?type=...&data.id=...)
    const type = body.type || c.req.query('type') || c.req.query('topic');
    const dataId = body.data?.id || c.req.query('data.id') || c.req.query('id');
    console.log('📩 Webhook MP:', type, dataId);
    if (!type || !dataId) return c.text('ok');
    if (!c.env.MP_ACCESS_TOKEN) {
      console.error('⚠️ webhook MP: falta el secreto MP_ACCESS_TOKEN');
      return c.text('MP no configurado', 503); // MP reintentará
    }
    const db = firestore(c.env);

    const activarPremium = async (email, subscriptionId, status, payerId = null) => {
      const isPremium = status === 'authorized';
      let user = null;
      if (email) user = (await db.query('users', { where: [['email', '==', email]], limit: 1 }))[0] || null;
      if (!user && payerId) user = (await db.query('users', { where: [['mpPayerId', '==', String(payerId)]], limit: 1 }))[0] || null;
      if (!user) { console.warn(`⚠️ Usuario no encontrado — email: "${email}" | payerId: ${payerId}`); return; }

      const { cambio } = await aplicarPremium(db, user, isPremium, {
        mpSubscriptionId: String(subscriptionId), premiumStatus: status,
        ...(payerId ? { mpPayerId: String(payerId) } : {}),
      });
      console.log(`✅ Usuario premium: ${isPremium} (${status})${cambio ? '' : ' sin cambio'}`);

      if (isPremium && cambio && user.data.email) {
        try {
          await sendMail(c.env, { to: user.data.email, subject: '⭐ ¡Ya eres Premium en FitTrack Pro!', html: htmlMP(user.data) });
        } catch (e) { console.error('Error email premium:', e.message); }
      }
    };

    if (type === 'subscription_preapproval' || type === 'subscription_preapproval_updated' || type === 'preapproval') {
      const sub = await mp(c.env, `/preapproval/${dataId}`);
      await activarPremium(sub.payer_email, dataId, sub.status, sub.payer_id);
    } else if (type === 'subscription_authorized_payment') {
      const payment = await mp(c.env, `/authorized_payments/${dataId}`);
      console.log('💳 Pago autorizado status:', payment.status, '| preapproval_id:', payment.preapproval_id);
      if (payment.preapproval_id) {
        const sub = await mp(c.env, `/preapproval/${payment.preapproval_id}`);
        await activarPremium(sub.payer_email, payment.preapproval_id, sub.status, sub.payer_id);
      }
    } else if (type === 'payment') {
      const payment = await mp(c.env, `/v1/payments/${dataId}`);
      if (payment.status === 'approved' && payment.payer?.email) {
        await activarPremium(payment.payer.email, dataId, 'authorized');
      }
    }
    return c.text('ok');
  } catch (e) {
    console.error('webhook error:', e.message);
    return c.text('error', 500); // MP reintentará automáticamente
  }
});

export default r;
