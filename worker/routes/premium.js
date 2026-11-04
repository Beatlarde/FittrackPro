// Premium y suscripciones — port de backend/routes/premium.js
// Mercado Pago se consulta por su API REST (el SDK de Node no corre en Workers).
import { Hono } from 'hono';
import { authMiddleware, premiumMiddleware, adminMiddleware } from '../lib/auth.js';
import { firestore } from '../lib/firestore.js';

const r = new Hono();

r.get('/verificar-premium', authMiddleware, premiumMiddleware, (c) =>
  c.json({ isPremium: c.get('isPremium'), role: c.get('user').role }));

r.post('/admin/actualizar-plan-premium', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { uid, premium } = await c.req.json();
    const db = firestore(c.env);
    if (await db.get(`plans/${uid}`)) await db.update(`plans/${uid}`, { daysUnlocked: premium ? 7 : 3 });
    return c.json({ ok: true });
  } catch (e) { return c.json({ ok: false }); }
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
          await db.update(`users/${uid}`, { premium: true, premiumStatus: 'authorized', premiumUpdatedAt: Date.now() });
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
    await db.update(`users/${id}`, { premium: true, premiumStatus: 'manual', premiumUpdatedAt: Date.now(), premiumMotivo: motivo });
    if (await db.get(`plans/${id}`)) await db.update(`plans/${id}`, { daysUnlocked: 7 });
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
