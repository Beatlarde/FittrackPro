const express = require('express');
const { admin, db } = require('../config/firebase');
const { transporter } = require('../services/email');
const router = express.Router();

router.post('/solicitud-coach', async (req, res) => {
  try {
    const { nombre, email } = req.body;
    const experiencia = req.body.experiencia || '';
    const especialidad = req.body.especialidad || '';
    const telefono = req.body.telefono || '';
    if (!nombre || !email) return res.status(400).json({ error: 'Nombre y email requeridos' });

    const existing = await db.collection('coachRequests').where('email', '==', email).where('status', '==', 'pending').get();
    if (!existing.empty) return res.status(400).json({ error: 'Ya tienes una solicitud pendiente' });

    const ref = await db.collection('coachRequests').add({
      nombre, email, experiencia, especialidad, telefono,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    try {
      await transporter.sendMail({
        from: `"FitTrack Pro" <${process.env.GMAIL_USER}>`,
        to: process.env.GMAIL_USER,
        subject: `🏋️ Nueva solicitud de coach: ${nombre}`,
        html: `<h2>Nueva solicitud de coach</h2>
          <p><b>Nombre:</b> ${nombre}</p>
          <p><b>Email:</b> ${email}</p>
          <p><b>Experiencia:</b> ${experiencia}</p>
          <p><b>Especialidad:</b> ${especialidad}</p>
          <p><b>Teléfono:</b> ${telefono || 'No proporcionado'}</p>
          <p>Revisa y aprueba desde el Panel Admin → Coaches</p>`
      });
    } catch(e) { console.error('Error enviando notificación:', e.message); }

    res.json({ ok: true, id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
