const express = require('express');
const { admin, db } = require('../config/firebase');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { transporter } = require('../services/email');
const router = express.Router();

router.post('/admin/aprobar-coach', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { requestId } = req.body;
    const reqSnap = await db.collection('coachRequests').doc(requestId).get();
    if (!reqSnap.exists) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const { nombre, email } = reqSnap.data();

    const userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!userSnap.empty) {
      await db.collection('users').doc(userSnap.docs[0].id).update({ role: 'coach', premium: true });
    }

    await db.collection('coachRequests').doc(requestId).update({ status: 'approved', approvedAt: admin.firestore.FieldValue.serverTimestamp() });

    try {
      await transporter.sendMail({
        from: `"FitTrack Pro" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `✅ ${nombre}, tu solicitud de coach fue aprobada`,
        html: `<h2>¡Bienvenido a FitTrack Pro Coach!</h2>
          <p>Hola ${nombre}, tu solicitud fue aprobada.</p>
          <p>${userSnap.empty ? 'Regístrate en <a href="https://fittrackpro.store">fittrackpro.store</a> con este email para acceder a tu panel de coach.' : 'La próxima vez que abras la app tendrás acceso a tu panel de coach.'}</p>
          <p>¡Bienvenido al equipo!</p>`
      });
    } catch(e) { console.error('Error enviando email aprobación:', e.message); }

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/rechazar-coach', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { requestId, motivo } = req.body;
    const reqSnap = await db.collection('coachRequests').doc(requestId).get();
    if (!reqSnap.exists) return res.status(404).json({ error: 'Solicitud no encontrada' });
    const { nombre, email } = reqSnap.data();

    await db.collection('coachRequests').doc(requestId).update({ status: 'rejected', rejectedAt: admin.firestore.FieldValue.serverTimestamp() });

    try {
      await transporter.sendMail({
        from: `"FitTrack Pro" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `FitTrack Pro — Actualización de tu solicitud`,
        html: `<p>Hola ${nombre}, gracias por tu interés en FitTrack Pro.</p>
          <p>Por el momento no podemos aprobar tu solicitud.${motivo ? ` Motivo: ${motivo}` : ''}</p>
          <p>Puedes volver a aplicar en el futuro.</p>`
      });
    } catch(e) { console.error('Error enviando email rechazo:', e.message); }

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/admin/solicitudes-coach', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const snap = await db.collection('coachRequests').orderBy('createdAt', 'desc').limit(50).get();
    const solicitudes = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?._seconds }));
    res.json({ solicitudes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/dar-alta-coach', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { email, nombre } = req.body;
    if (!email || !nombre) return res.status(400).json({ error: 'Email y nombre requeridos' });
    const snap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'Usuario no encontrado — debe registrarse primero' });
    await db.collection('users').doc(snap.docs[0].id).update({ role: 'coach', premium: true });
    console.log(`✅ Coach dado de alta: ${email}`);
    res.json({ ok: true, uid: snap.docs[0].id, nombre });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/revocar-coach', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ error: 'uid requerido' });
    await db.collection('users').doc(uid).update({ role: 'client' });
    console.log(`✅ Coach revocado: ${uid}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/admin/coaches', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const snap = await db.collection('users').where('role', '==', 'coach').get();
    const coaches = snap.docs.map(d => ({
      id: d.id,
      name: d.data().name,
      email: d.data().email,
      coachCode: d.data().coachCode,
      premium: d.data().premium,
      createdAt: d.data().createdAt?._seconds
    }));
    res.json({ coaches });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
