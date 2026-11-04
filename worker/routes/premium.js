// Premium y suscripciones — port de backend/routes/premium.js
// Mercado Pago se consulta por su API REST (el SDK de Node no corre en Workers).
import { Hono } from 'hono';
import { authMiddleware, premiumMiddleware, adminMiddleware } from '../lib/auth.js';
import { firestore } from '../lib/firestore.js';
import { aplicarPremium, cargarUsuario } from '../lib/premium.js';

const r = new Hono();

r.get('/verificar-premium', authMiddleware, premiumMiddleware, (c) =>
  c.json({ isPremium: c.get('isPremium'), role: c.get('user').role }));

// El panel admin ya no escribe premium directo en Firestore: lo hace este endpoint.
r.post('/admin/actualizar-plan-premium', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { uid, premium } = await c.req.json();
    const db = firestore(c.env);
    const user = await cargarUsuario(db, uid);
    if (!user) return c.json({ ok: false, error: 'Usuario no encontrado' }, 404);
    await aplicarPremium(db, user, premium === true, { premiumStatus: premium ? 'manual' : 'manual_revocado' });
    return c.json({ ok: true });
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});

// Quien pagó en Hotmart antes de tener cuenta: al terminar el onboarding se le activa aquí
// (antes lo hacía el navegador escribiendo premium:true directo en Firestore).
r.post('/reclamar-premium-pendiente', authMiddleware, async (c) => {
  try {
    const email = c.get('authEmail');
    if (!email) return c.json({ premium: false });
    const db = firestore(c.env);
    const pend = await db.get(`premiumPendiente/${email}`);
    if (!pend) return c.json({ premium: false });
    const user = await cargarUsuario(db, c.get('uid'));
    if (!user) return c.json({ premium: false });
    await aplicarPremium(db, user, true, { premiumStatus: 'authorized', premiumSource: pend.data?.source || 'hotmart' });
    await db.delete(`premiumPendiente/${email}`);
    console.log(`✅ Premium pendiente reclamado: ${email}`);
    return c.json({ premium: true });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

r.post('/registrar-intento-pago', authMiddleware, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    await firestore(c.env).update(`users/${c.get('uid')}`, { paymentAttemptAt: Date.now(), paymentAttemptEmail: body.email || '' });
    return c.json({ ok: true });
  } catch (e) { return c.json({ ok: false }); }
});

// Verificación activa post-pago (cortafuego)
r.post('/verificar-pago', authMiddleware, async (c) => {
  try {
    const uid = c.get('uid');
    const db = firestore(c.env);
    const userData = (await db.get(`users/${uid}`))?.data;

    if (userData?.premium === true) return c.json({ premium: true, source: 'firestore' });

    if (userData?.mpSubscriptionId && c.env.MP_ACCESS_TOKEN) {
      try {
        const res = await fetch(`https://api.mercadopago.com/preapproval/${userData.mpSubscriptionId}`, {
          headers: { Authorization: `Bearer ${c.env.MP_ACCESS_TOKEN}` },
          signal: AbortSignal.timeout(8000),
        });
        const sub = await res.json();
        if (res.ok && sub.status === 'authorized') {
          await aplicarPremium(db, { id: uid, data: userData }, true, { premiumStatus: 'authorized' });
          console.log(`🔄 Premium recuperado por verificación activa: ${userData.email}`);
          return c.json({ premium: true, source: 'mp_verification' });
        }
      } catch (e) { console.error('Error verificando MP:', e.message); }
    }

    return c.json({ premium: false, source: 'not_found' });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

// Cortafuego manual: admin activa premium por email
r.post('/admin/activar-premium', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { email, motivo = 'activación manual' } = await c.req.json();
    if (!email) return c.json({ error: 'Email requerido' }, 400);
    const db = firestore(c.env);
    const rows = await db.query('users', { where: [['email', '==', email]], limit: 1 });
    if (!rows.length) return c.json({ error: 'Usuario no encontrado' }, 404);
    const id = rows[0].id;
    await aplicarPremium(db, rows[0], true, { premiumStatus: 'manual', premiumMotivo: motivo });
    console.log(`🔑 Premium activado manualmente para ${email} — motivo: ${motivo}`);
    return c.json({ ok: true, email });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

r.post('/verificar-premium', async (c) => {
  try {
    const { uid } = await c.req.json();
    const snap = await firestore(c.env).get(`users/${uid}`);
    return c.json({ premium: snap?.data?.premium === true });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

r.post('/suscripcion', async (c) => {
  const { uid } = await c.req.json();
  const backUrl = encodeURIComponent(`${c.env.FRONTEND_URL}?pago=exitoso&uid=${uid}`);
  return c.json({ init_point: `https://www.mercadopago.com.mx/subscriptions/checkout?preapproval_plan_id=${c.env.MP_PLAN_ID}&back_url=${backUrl}` });
});

export default r;
