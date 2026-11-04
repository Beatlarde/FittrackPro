// Panel admin (coaches) + solicitud pública de coach
// Port de backend/routes/admin-coach.js y backend/routes/solicitud-coach.js
import { Hono } from 'hono';
import { authMiddleware, adminMiddleware } from '../lib/auth.js';
import { firestore, SERVER_TIMESTAMP } from '../lib/firestore.js';
import { sendMail } from '../lib/email.js';

const r = new Hono();
const soloAdmin = [authMiddleware, adminMiddleware];

r.post('/admin/aprobar-coach', ...soloAdmin, async (c) => {
  try {
    const { requestId } = await c.req.json();
    const db = firestore(c.env);
    const reqSnap = await db.get(`coachRequests/${requestId}`);
    if (!reqSnap) return c.json({ error: 'Solicitud no encontrada' }, 404);
    const { nombre, email } = reqSnap.data;

    const users = await db.query('users', { where: [['email', '==', email]], limit: 1 });
    if (users.length) await db.update(`users/${users[0].id}`, { role: 'coach', premium: true });

    await db.update(`coachRequests/${requestId}`, { status: 'approved', approvedAt: SERVER_TIMESTAMP });

    try {
      await sendMail(c.env, {
        to: email,
        subject: `✅ ${nombre}, tu solicitud de coach fue aprobada`,
        html: `<h2>¡Bienvenido a FitTrack Pro Coach!</h2>
          <p>Hola ${nombre}, tu solicitud fue aprobada.</p>
          <p>${!users.length ? 'Regístrate en <a href="https://fittrackpro.store">fittrackpro.store</a> con este email para acceder a tu panel de coach.' : 'La próxima vez que abras la app tendrás acceso a tu panel de coach.'}</p>
          <p>¡Bienvenido al equipo!</p>`,
      });
    } catch (e) { console.error('Error enviando email aprobación:', e.message); }

    return c.json({ ok: true });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

r.post('/admin/rechazar-coach', ...soloAdmin, async (c) => {
  try {
    const { requestId, motivo } = await c.req.json();
    const db = firestore(c.env);
    const reqSnap = await db.get(`coachRequests/${requestId}`);
    if (!reqSnap) return c.json({ error: 'Solicitud no encontrada' }, 404);
    const { nombre, email } = reqSnap.data;

    await db.update(`coachRequests/${requestId}`, { status: 'rejected', rejectedAt: SERVER_TIMESTAMP });

    try {
      await sendMail(c.env, {
        to: email,
        subject: 'FitTrack Pro — Actualización de tu solicitud',
        html: `<p>Hola ${nombre}, gracias por tu interés en FitTrack Pro.</p>
          <p>Por el momento no podemos aprobar tu solicitud.${motivo ? ` Motivo: ${motivo}` : ''}</p>
          <p>Puedes volver a aplicar en el futuro.</p>`,
      });
    } catch (e) { console.error('Error enviando email rechazo:', e.message); }

    return c.json({ ok: true });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

r.get('/admin/solicitudes-coach', ...soloAdmin, async (c) => {
  try {
    const rows = await firestore(c.env).query('coachRequests', { orderBy: ['createdAt', 'desc'], limit: 50 });
    const solicitudes = rows.map(({ id, data }) => ({ id, ...data, createdAt: data.createdAt?._seconds }));
    return c.json({ solicitudes });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

r.post('/admin/dar-alta-coach', ...soloAdmin, async (c) => {
  try {
    const { email, nombre } = await c.req.json();
    if (!email || !nombre) return c.json({ error: 'Email y nombre requeridos' }, 400);
    const db = firestore(c.env);
    const rows = await db.query('users', { where: [['email', '==', email]], limit: 1 });
    if (!rows.length) return c.json({ error: 'Usuario no encontrado — debe registrarse primero' }, 404);
    await db.update(`users/${rows[0].id}`, { role: 'coach', premium: true });
    console.log(`✅ Coach dado de alta: ${email}`);
    return c.json({ ok: true, uid: rows[0].id, nombre });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

r.post('/admin/revocar-coach', ...soloAdmin, async (c) => {
  try {
    const { uid } = await c.req.json();
    if (!uid) return c.json({ error: 'uid requerido' }, 400);
    await firestore(c.env).update(`users/${uid}`, { role: 'client' });
    console.log(`✅ Coach revocado: ${uid}`);
    return c.json({ ok: true });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

r.get('/admin/coaches', ...soloAdmin, async (c) => {
  try {
    const rows = await firestore(c.env).query('users', { where: [['role', '==', 'coach']] });
    const coaches = rows.map(({ id, data: d }) => ({
      id, name: d.name, email: d.email, coachCode: d.coachCode, premium: d.premium, createdAt: d.createdAt?._seconds,
    }));
    return c.json({ coaches });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

// Formulario público "Quiero ser coach"
r.post('/solicitud-coach', async (c) => {
  try {
    const body = await c.req.json();
    const { nombre, email } = body;
    const experiencia = body.experiencia || '';
    const especialidad = body.especialidad || '';
    const telefono = body.telefono || '';
    if (!nombre || !email) return c.json({ error: 'Nombre y email requeridos' }, 400);

    const db = firestore(c.env);
    const existing = await db.query('coachRequests', { where: [['email', '==', email], ['status', '==', 'pending']], limit: 1 });
    if (existing.length) return c.json({ error: 'Ya tienes una solicitud pendiente' }, 400);

    const ref = await db.add('coachRequests', {
      nombre, email, experiencia, especialidad, telefono, status: 'pending', createdAt: SERVER_TIMESTAMP,
    });

    try {
      await sendMail(c.env, {
        to: c.env.GMAIL_USER,
        subject: `🏋️ Nueva solicitud de coach: ${nombre}`,
        html: `<h2>Nueva solicitud de coach</h2>
          <p><b>Nombre:</b> ${nombre}</p><p><b>Email:</b> ${email}</p>
          <p><b>Experiencia:</b> ${experiencia}</p><p><b>Especialidad:</b> ${especialidad}</p>
          <p><b>Teléfono:</b> ${telefono || 'No proporcionado'}</p>
          <p>Revisa y aprueba desde el Panel Admin → Coaches</p>`,
      });
    } catch (e) { console.error('Error enviando notificación:', e.message); }

    return c.json({ ok: true, id: ref.id });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

export default r;
