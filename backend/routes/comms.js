const express = require('express');
const { db } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const { transporter, enviarMensajeAuto } = require('../services/email');
const { generarMensajeCoach } = require('../services/gemini');
const router = express.Router();

// Send email genérico
router.post('/send-email', authMiddleware, async (req, res) => {
  try {
    const { to, subject, html } = req.body;
    if (!to || !subject || !html) return res.status(400).json({ error: 'Faltan campos' });
    await transporter.sendMail({ from: `"FitTrack Pro" <${process.env.GMAIL_USER}>`, to, subject, html });
    res.json({ ok: true });
  } catch (e) { console.error('send-email error:', e); res.status(500).json({ error: e.message }); }
});

router.post('/mensaje-bienvenida', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.body;
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return res.json({ ok: false });
    const userData = userDoc.data();
    if (userData.welcomeMsgSent) return res.json({ ok: false, reason: 'already sent' });
    const texto = await generarMensajeCoach(userData.name, userData.goals?.objective,
      'El usuario acaba de registrarse y completar su onboarding. Dale una bienvenida cálida y motivadora.');
    await enviarMensajeAuto(uid, userData, texto, `¡Bienvenido a FitTrack Pro, ${userData.name}! 🎉`);
    await db.collection('users').doc(uid).update({ welcomeMsgSent: true });
    res.json({ ok: true });
  } catch (e) { console.error('bienvenida error:', e); res.status(500).json({ error: e.message }); }
});

module.exports = router;
