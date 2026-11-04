// Correos desde la app — port de backend/routes/comms.js
// Corrige: /send-email permitía a cualquier usuario enviar a cualquier dirección.
// Ahora: el admin a quien sea; el coach solo a sus clientes; el resto solo a sí mismo.
import { Hono } from 'hono';
import { authMiddleware } from '../lib/auth.js';
import { firestore } from '../lib/firestore.js';
import { sendMail } from '../lib/email.js';
import { generarMensajeCoach, enviarMensajeAuto } from '../lib/mensajes.js';

const r = new Hono();

async function puedeEnviarA(env, uid, authEmail, to) {
  const destino = String(to || '').trim().toLowerCase();
  if (!destino) return false;
  if (authEmail && destino === authEmail.toLowerCase()) return true;
  const db = firestore(env);
  const yo = (await db.get(`users/${uid}`))?.data || {};
  if (yo.admin === true) return true;
  if (yo.role === 'coach') {
    const rows = await db.query('users', { where: [['email', '==', to], ['refCoachId', '==', uid]], limit: 1 });
    if (rows.length) return true;
  }
  return false;
}

r.post('/send-email', authMiddleware, async (c) => {
  try {
    const { to, subject, html } = await c.req.json();
    if (!to || !subject || !html) return c.json({ error: 'Faltan campos' }, 400);
    if (!(await puedeEnviarA(c.env, c.get('uid'), c.get('authEmail'), to))) {
      return c.json({ error: 'No autorizado para enviar a ese destinatario' }, 403);
    }
    await sendMail(c.env, { to, subject, html });
    return c.json({ ok: true });
  } catch (e) { console.error('send-email error:', e.message); return c.json({ error: e.message }, 500); }
});

r.post('/mensaje-bienvenida', authMiddleware, async (c) => {
  try {
    const { uid } = await c.req.json();
    if (uid !== c.get('uid')) return c.json({ error: 'No autorizado' }, 403);
    const db = firestore(c.env);
    const snap = await db.get(`users/${uid}`);
    if (!snap) return c.json({ ok: false });
    const userData = snap.data;
    if (userData.welcomeMsgSent) return c.json({ ok: false, reason: 'already sent' });
    const texto = await generarMensajeCoach(c.env, userData.name, userData.goals?.objective,
      'El usuario acaba de registrarse y completar su onboarding. Dale una bienvenida cálida y motivadora.');
    await enviarMensajeAuto(c.env, uid, userData, texto, `¡Bienvenido a FitTrack Pro, ${userData.name}! 🎉`);
    await db.update(`users/${uid}`, { welcomeMsgSent: true });
    return c.json({ ok: true });
  } catch (e) { console.error('bienvenida error:', e.message); return c.json({ error: e.message }, 500); }
});

export default r;
