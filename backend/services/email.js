const nodemailer = require('nodemailer');
const { db } = require('../config/firebase');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
});

// Guarda un mensaje automático en la app del cliente y le envía el correspondiente email
async function enviarMensajeAuto(userId, userData, texto, asunto) {
  await db.collection('messages').add({
    userId, coachName: 'Coach FitTrack', text: texto,
    createdAt: new Date(), read: false, timestamp: Date.now(), auto: true
  });
  if (userData.email) {
    await transporter.sendMail({
      from: `"FitTrack Pro" <${process.env.GMAIL_USER}>`,
      to: userData.email,
      subject: asunto,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#fff;border-radius:16px;padding:32px;">
          <h2 style="color:#10b981;margin-bottom:16px;">FitTrack Pro 💪</h2>
          <p style="color:#e2e8f0;font-size:16px;line-height:1.6;">${texto}</p>
          <a href="${process.env.FRONTEND_URL}" style="display:inline-block;margin-top:24px;background:#10b981;color:#000;font-weight:900;padding:12px 24px;border-radius:12px;text-decoration:none;">
            Abrir FitTrack Pro →
          </a>
        </div>`
    });
  }
  console.log('🤖 Mensaje auto enviado a:', userData.email, '| Asunto:', asunto);
}

module.exports = { transporter, enviarMensajeAuto };
