// Coach: códigos de referido, clientes y métricas — port de backend/routes/coach.js
// Corrige: .exists() como función (siempre fallaba) y fechas en UTC en vez de CDMX.
import { Hono } from 'hono';
import { authMiddleware } from '../lib/auth.js';
import { firestore } from '../lib/firestore.js';
import { sendMail } from '../lib/email.js';
import { hoyCDMX, isoHoyCDMX, ultimosDias, fmtMX } from '../lib/fechas.js';

const r = new Hono();
const tsSeg = (t) => t?._seconds || t?.seconds || 0;

r.post('/coach/generar-codigo', authMiddleware, async (c) => {
  try {
    const db = firestore(c.env);
    const userSnap = await db.get(`users/${c.get('uid')}`);
    if (!userSnap || userSnap.data.role !== 'coach') {
      return c.json({ error: 'Solo coaches pueden generar códigos' }, 403);
    }
    const existing = userSnap.data.coachCode;
    if (existing) return c.json({ code: existing, url: `https://fittrackpro.store?ref=${existing}` });

    const name = userSnap.data.name?.toLowerCase().replace(/\s+/g, '') || 'coach';
    const random = Math.random().toString(36).substring(2, 6);
    const code = `${name}${random}`;
    await db.update(`users/${c.get('uid')}`, { coachCode: code });
    return c.json({ code, url: `https://fittrackpro.store?ref=${code}` });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

r.post('/notificar-nuevo-cliente', async (c) => {
  try {
    const { coachId, clientName, clientEmail } = await c.req.json();
    if (!coachId) return c.json({ error: 'coachId requerido' }, 400);
    const coachSnap = await firestore(c.env).get(`users/${coachId}`);
    if (!coachSnap) return c.json({ error: 'Coach no encontrado' }, 404);
    const coachData = coachSnap.data;
    if (!coachData.email) return c.json({ ok: false });

    await sendMail(c.env, {
      to: coachData.email,
      subject: `🎉 Nuevo cliente: ${clientName}`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#fff;border-radius:16px;">
        <h2 style="color:#10b981;">🎉 Nuevo cliente registrado</h2>
        <p>Hola ${coachData.name},</p>
        <p><strong style="color:#10b981;">${clientName}</strong> (${clientEmail}) acaba de registrarse usando tu link de referido.</p>
        <p style="color:#94a3b8;">Ya completó su perfil y está esperando su plan personalizado.</p>
        <a href="https://fittrackpro.store/coaches" style="display:inline-block;margin-top:16px;background:#10b981;color:#000;font-weight:900;padding:12px 24px;border-radius:12px;text-decoration:none;">
          Ver mis clientes →
        </a>
      </div>`,
    });
    console.log(`📧 Coach ${coachData.email} notificado de nuevo cliente: ${clientName}`);
    return c.json({ ok: true });
  } catch (e) {
    console.error('notificar-nuevo-cliente error:', e.message);
    return c.json({ ok: false });
  }
});

r.get('/join/:code', async (c) => {
  try {
    const rows = await firestore(c.env).query('users', {
      where: [['coachCode', '==', c.req.param('code')], ['role', '==', 'coach']], limit: 1,
    });
    if (!rows.length) return c.json({ error: 'Código inválido' }, 404);
    const coach = rows[0].data;
    return c.json({ coachId: rows[0].id, coachName: coach.name, coachCode: coach.coachCode, orgName: coach.orgName || 'FitTrack Pro' });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

r.get('/coach/clientes', authMiddleware, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const all = await firestore(c.env).query('users', {
      where: [['modalidad', '==', 'coach'], ['refCoachId', '==', c.get('uid')]],
    });
    const start = (page - 1) * limit;
    const docs = all.slice(start, start + limit);
    const hasMore = all.length > start + limit;
    const clientes = docs.map(({ id, data: d }) => ({
      id, name: d.name, email: d.email, goals: d.goals, planStatus: d.planStatus,
      coachDeadline: d.coachDeadline, modalidad: d.modalidad, premium: d.premium,
      lastOpenTimestamp: d.lastOpenTimestamp, coachNotes: d.coachNotes, photoRequest: d.photoRequest,
      meetLink: d.meetLink, tecnicaVideos: d.tecnicaVideos, createdAt: d.createdAt?._seconds,
    }));
    return c.json({ clientes, hasMore, lastId: docs[docs.length - 1]?.id || null });
  } catch (e) { console.error('coach clientes error:', e); return c.json({ error: e.message }, 500); }
});

r.get('/coach/cliente-metricas/:clienteId', authMiddleware, async (c) => {
  try {
    const clienteId = c.req.param('clienteId');
    const db = firestore(c.env);
    const hoy = hoyCDMX();

    const [logsRows, userSnap, planSnap, fotosRows] = await Promise.all([
      db.query('logs', { where: [['userId', '==', clienteId]] }),
      db.get(`users/${clienteId}`),
      db.get(`plans/${clienteId}`),
      // Sin orderBy: las fotos subidas por el backend guardan `createdAt` y las antiguas `timestamp`;
      // ordenar en Firestore por un campo descarta los documentos que no lo tienen.
      db.query('photos', { where: [['userId', '==', clienteId]] }).catch(() => []),
    ]);
    const logs = logsRows.map((d) => ({ id: d.id, ...d.data }));

    const logsHoy = logs.filter((l) => l.dateString === hoy);
    const ejerciciosHoy = logsHoy.filter((l) => l.type === 'workout').length;
    const comidasHoy = logsHoy.filter((l) => l.type === 'meal').length;
    const kcalHoy = logsHoy.filter((l) => l.type === 'meal').reduce((s, l) => s + (l.aiMetadata?.kcal || 0), 0);

    const diasUnicos = new Set(logs.map((l) => l.dateString));
    const racha = diasUnicos.size;
    const hace7 = ultimosDias(7);
    const adherenciaSemana = Math.round((hace7.filter((d) => diasUnicos.has(d)).length / 7) * 100);

    const userData = userSnap?.data || {};
    const ultimoAcceso = userData.lastOpenTimestamp
      ? fmtMX(new Date(userData.lastOpenTimestamp), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : 'Sin datos';

    const planData = planSnap ? planSnap.data : null;
    const todayIndex = (new Date(Date.now() - 6 * 3600 * 1000).getUTCDay() + 6) % 7;
    const planHoy = planData?.plan?.[todayIndex];
    const totalEjHoy = planHoy?.entrenamiento?.ejercicios?.length || 0;
    const totalComidasHoy = planHoy?.dieta?.comidas?.length || 0;
    const kcalMeta = userData.goals?.targetKcal || 0;

    const actividadSemana = [...hace7].reverse().map((d) => ({
      dia: new Date(d).toLocaleDateString('es-MX', { weekday: 'short' }),
      fecha: d,
      ejercicios: logs.filter((l) => l.dateString === d && l.type === 'workout').length,
      comidas: logs.filter((l) => l.dateString === d && l.type === 'meal').length,
      activo: diasUnicos.has(d),
    }));

    const pesos = logs
      .filter((l) => l.type === 'weight' && l.content)
      .sort((a, b) => tsSeg(b.timestamp) - tsSeg(a.timestamp))
      .slice(0, 10)
      .map((l) => ({
        fecha: new Date(l.dateString).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }),
        peso: parseFloat(l.content) || 0,
        nota: l.nota || '',
      }));

    const logsHoyDetalle = logsHoy
      .sort((a, b) => tsSeg(b.timestamp) - tsSeg(a.timestamp))
      .map((l) => ({
        type: l.type, content: l.content, momento: l.momento,
        esGustito: l.esGustito || false, esAlternativa: l.esAlternativa || false, kcal: l.aiMetadata?.kcal || 0,
      }));

    const fechaFoto = (d) => d.createdAt || d.timestamp;
    const fotos = fotosRows
      .filter(({ data: d }) => d.url && d.category !== 'tecnica_video')
      .sort((a, b) => tsSeg(fechaFoto(b.data)) - tsSeg(fechaFoto(a.data)))
      .slice(0, 4)
      .map(({ id, data: d }) => ({
        id, url: d.url,
        fecha: fechaFoto(d)?.toDate ? fmtMX(fechaFoto(d).toDate(), { day: '2-digit', month: 'short', year: '2-digit' }) : (d.dateString || ''),
        analisis: d.analisis || '',
      }));

    const reviewHoy = userData.dayReviews?.[isoHoyCDMX()];

    return c.json({
      racha, adherenciaSemana, ultimoAcceso,
      hoy: {
        ejerciciosCompletados: ejerciciosHoy, totalEjercicios: totalEjHoy,
        comidasRegistradas: comidasHoy, totalComidas: totalComidasHoy,
        kcalRegistradas: kcalHoy, kcalMeta, logs: logsHoyDetalle, review: reviewHoy || null,
      },
      actividadSemana, pesos, fotos, totalLogs: logs.length,
    });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

// Métricas generales del coach. Optimizado: en vez de 2 consultas por cliente
// (el plan gratis de Workers permite 50 subpeticiones por request), trae los logs
// de hasta 30 clientes por consulta con el operador "in".
r.get('/coach/dashboard-metricas', authMiddleware, async (c) => {
  try {
    const db = firestore(c.env);
    const hoy = hoyCDMX();
    const hace7 = ultimosDias(7);

    const clientesRows = await db.query('users', {
      where: [['refCoachId', '==', c.get('uid')], ['modalidad', '==', 'coach']],
    });
    const clientes = clientesRows.map((d) => ({ id: d.id, ...d.data }));
    const totalClientes = clientes.length;
    const activos = clientes.filter((cl) => cl.planStatus === 'active').length;
    const pendientes = totalClientes - activos;

    const logsPorCliente = new Map(clientes.map((cl) => [cl.id, []]));
    for (let i = 0; i < clientes.length; i += 30) {
      const ids = clientes.slice(i, i + 30).map((cl) => cl.id);
      const rows = await db.query('logs', { where: [['userId', 'in', ids]] });
      for (const { data } of rows) logsPorCliente.get(data.userId)?.push(data);
    }

    let entrenaronHoy = 0, registraronComidaHoy = 0, adherenciaTotal = 0;
    for (const cl of clientes) {
      const logs = logsPorCliente.get(cl.id) || [];
      const logsHoy = logs.filter((l) => l.dateString === hoy);
      if (logsHoy.some((l) => l.type === 'workout')) entrenaronHoy++;
      if (logsHoy.some((l) => l.type === 'meal')) registraronComidaHoy++;
      const diasUnicos = new Set(logs.map((l) => l.dateString));
      adherenciaTotal += (hace7.filter((d) => diasUnicos.has(d)).length / 7) * 100;
    }

    return c.json({
      totalClientes, activos, pendientes,
      hoy: {
        // Se conserva la clave original (con caracteres cirílicos) que lee el frontend
        'entrenarонHoy': entrenaronHoy,
        registraronComidaHoy,
        sinActividad: totalClientes - entrenaronHoy,
      },
      adherenciaPromedio: totalClientes > 0 ? Math.round(adherenciaTotal / totalClientes) : 0,
    });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

export default r;
