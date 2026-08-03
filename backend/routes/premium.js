const express = require('express');
const { db } = require('../config/firebase');
const { client, PreApproval } = require('../config/mercadopago');
const { authMiddleware, premiumMiddleware, adminMiddleware } = require('../middleware/auth');
const router = express.Router();

router.get('/verificar-premium', authMiddleware, premiumMiddleware, async (req, res) => {
  res.json({ isPremium: req.isPremium, role: req.user.role });
});

// Actualizar daysUnlocked al cambiar premium
router.post('/admin/actualizar-plan-premium', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { uid, premium } = req.body;
    const planSnap = await db.collection('plans').doc(uid).get();
    if (planSnap.exists()) {
      await db.collection('plans').doc(uid).update({ daysUnlocked: premium ? 7 : 3 });
    }
    res.json({ ok: true });
  } catch(e) { res.json({ ok: false }); }
});

// Registrar intento de pago para rastreo
router.post('/registrar-intento-pago', authMiddleware, async (req, res) => {
  try {
    const uid = req.uid;
    await db.collection('users').doc(uid).update({ paymentAttemptAt: Date.now(), paymentAttemptEmail: req.body.email || '' });
    res.json({ ok: true });
  } catch(e) { res.json({ ok: false }); }
});

// Verificación activa post-pago (cortafuego)
router.post('/verificar-pago', authMiddleware, async (req, res) => {
  try {
    const uid = req.uid;
    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.data();

    if (userData?.premium === true) {
      return res.json({ premium: true, source: 'firestore' });
    }

    if (userData?.mpSubscriptionId) {
      try {
        const preApproval = new PreApproval(client);
        const sub = await preApproval.get({ id: userData.mpSubscriptionId });
        if (sub.status === 'authorized') {
          await db.collection('users').doc(uid).update({ premium: true, premiumStatus: 'authorized', premiumUpdatedAt: Date.now() });
          console.log(`🔄 Premium recuperado por verificación activa: ${userData.email}`);
          return res.json({ premium: true, source: 'mp_verification' });
        }
      } catch(e) { console.error('Error verificando MP:', e.message); }
    }

    res.json({ premium: false, source: 'not_found' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Cortafuego manual: admin activa premium por email
router.post('/admin/activar-premium', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { email, motivo = 'activación manual' } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });
    const snap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'Usuario no encontrado' });
    await snap.docs[0].ref.update({
      premium: true,
      premiumStatus: 'manual',
      premiumUpdatedAt: Date.now(),
      premiumMotivo: motivo
    });
    const planSnap = await db.collection('plans').doc(snap.docs[0].id).get();
    if (planSnap.exists()) {
      await db.collection('plans').doc(snap.docs[0].id).update({ daysUnlocked: 7 });
    }
    console.log(`🔑 Premium activado manualmente para ${email} — motivo: ${motivo}`);
    res.json({ ok: true, email });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/verificar-premium', async (req, res) => {
  try {
    const { uid } = req.body;
    const snap = await db.collection('users').doc(uid).get();
    res.json({ premium: snap.data()?.premium === true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/suscripcion', async (req, res) => {
  const { uid } = req.body;
  const backUrl = encodeURIComponent(`${process.env.FRONTEND_URL}?pago=exitoso&uid=${uid}`);
  res.json({ init_point: `https://www.mercadopago.com.mx/subscriptions/checkout?preapproval_plan_id=${process.env.MP_PLAN_ID}&back_url=${backUrl}` });
});

module.exports = router;
