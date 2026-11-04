// Mensajes automáticos del "Coach FitTrack" — port de backend/services/email.js
// (enviarMensajeAuto) y de generarMensajeCoach (backend/services/gemini.js).
import { firestore } from './firestore.js';
import { sendMail } from './email.js';
import { callGemini } from './gemini.js';

export async function generarMensajeCoach(env, nombre, objetivo, contexto) {
  const prompt = `Eres un coach de fitness llamado "Coach FitTrack". Genera un mensaje corto, personal y motivador para tu cliente.
Cliente: ${nombre}
Objetivo: ${objetivo || 'mejorar condición física'}
Situación: ${contexto}
Reglas: máximo 3 oraciones, usa su nombre, tono cercano y profesional, 1-2 emojis máximo.
Solo escribe el mensaje, sin introducción.`;
  const text = await callGemini(env, { parts: [{ text: prompt }] });
  return text.trim();
}

// Guarda el mensaje en la app del cliente (colección messages) y le manda el correo.
// Si el correo falla, el mensaje en la app ya quedó guardado.
export async function enviarMensajeAuto(env, userId, userData, texto, asunto) {
  await firestore(env).add('messages', {
    userId, coachName: 'Coach FitTrack', text: texto,
    createdAt: new Date(), read: false, timestamp: Date.now(), auto: true,
  });
  if (userData.email) {
    try {
      await sendMail(env, {
        to: userData.email,
        subject: asunto,
        html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#fff;border-radius:16px;padding:32px;">
          <h2 style="color:#10b981;margin-bottom:16px;">FitTrack Pro 💪</h2>
          <p style="color:#e2e8f0;font-size:16px;line-height:1.6;">${texto}</p>
          <a href="${env.FRONTEND_URL}" style="display:inline-block;margin-top:24px;background:#10b981;color:#000;font-weight:900;padding:12px 24px;border-radius:12px;text-decoration:none;">
            Abrir FitTrack Pro →
          </a>
        </div>`,
      });
    } catch (e) { console.error('enviarMensajeAuto correo:', e.message); }
  }
  console.log('🤖 Mensaje auto enviado a:', userData.email, '| Asunto:', asunto);
}
