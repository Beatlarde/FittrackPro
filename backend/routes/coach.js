const express = require('express');
const { db } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const { transporter } = require('../services/email');
const router = express.Router();

// Generar código único para coach
router.post('/coach/generar-codigo', authMiddleware, async (req, res) => {
  try {
    const userSnap = await db.collection('users').doc(req.uid).get();
    if (!userSnap.exists || userSnap.data().role !== 'coach') {
      return res.status(403).json({ error: 'Solo coaches pueden generar códigos' });
    }
    const existing = userSnap.data().coachCode;
    if (existing) return res.json({ code: existing, url: `https://fittrackpro.store?ref=${existing}` });

    const name = userSnap.data().name?.toLowerCase().replace(/\s+/g, '') || 'coach';
    const random = Math.random().toString(36).substring(2, 6);
    const code = `${name}${random}`;

    await db.collection('users').doc(req.uid).update({ coachCode: code });
    res.json({ code, url: `https://fittrackpro.store?ref=${code}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Notificar al coach de nuevo cliente
router.post('/notificar-nuevo-cliente', async (req, res) => {
  try {
    const { coachId, clientName, clientEmail } = req.body;
    if (!coachId) return res.status(400).json({ error: 'coachId requerido' });
    const coachSnap = await db.collection('users').doc(coachId).get();
    if (!coachSnap.exists()) return res.status(404).json({ error: 'Coach no encontrado' });
    const coachData = coachSnap.data();
    if (!coachData.email) return res.json({ ok: false });

    await transporter.sendMail({
      from: `"FitTrack Pro" <${process.env.GMAIL_USER}>`,
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
      </div>`
    });
    console.log(`📧 Coach ${coachData.email} notificado de nuevo cliente: ${clientName}`);
    res.json({ ok: true });
  } catch(e) {
    console.error('notificar-nuevo-cliente error:', e.message);
    res.json({ ok: false });
  }
});

// Resolver código de referido → info del coach
router.get('/join/:code', async (req, res) => {
  try {
    const snap = await db.collection('users')
      .where('coachCode', '==', req.params.code)
      .where('role', '==', 'coach')
      .limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'Código inválido' });
    const coach = snap.docs[0].data();
    res.json({
      coachId: snap.docs[0].id,
      coachName: coach.name,
      coachCode: coach.coachCode,
      orgName: coach.orgName || 'FitTrack Pro'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Clientes del coach paginados
router.get('/coach/clientes', authMiddleware, async (req, res) => {
  try {
    const coachUid = req.uid;
    const { page = 1, limit = 10 } = req.query;
    const snap = await db.collection('users')
      .where('modalidad', '==', 'coach')
      .where('refCoachId', '==', coachUid)
      .get();
    const allDocs = snap.docs;
    const page_num = parseInt(page) - 1;
    const start = page_num * parseInt(limit);
    const docs = allDocs.slice(start, start + parseInt(limit));
    const hasMore = allDocs.length > start + parseInt(limit);

    const clientes = docs.map(d => ({
      id: d.id,
      name: d.data().name,
      email: d.data().email,
      goals: d.data().goals,
      planStatus: d.data().planStatus,
      coachDeadline: d.data().coachDeadline,
      modalidad: d.data().modalidad,
      premium: d.data().premium,
      lastOpenTimestamp: d.data().lastOpenTimestamp,
      coachNotes: d.data().coachNotes,
      photoRequest: d.data().photoRequest,
      meetLink: d.data().meetLink,
      tecnicaVideos: d.data().tecnicaVideos,
      createdAt: d.data().createdAt?._seconds
    }));

    res.json({ clientes, hasMore, lastId: docs[docs.length - 1]?.id || null });
  } catch (e) { console.error('coach clientes error:', e); res.status(500).json({ error: e.message }); }
});

// Métricas de un cliente individual
router.get('/coach/cliente-metricas/:clienteId', authMiddleware, async (req, res) => {
  try {
    const { clienteId } = req.params;
    const hoy = new Date().toDateString();

    const logsSnap = await db.collection('logs').where('userId', '==', clienteId).get();
    const logs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const logsHoy = logs.filter(l => l.dateString === hoy);
    const ejerciciosHoy = logsHoy.filter(l => l.type === 'workout').length;
    const comidasHoy = logsHoy.filter(l => l.type === 'meal').length;
    const kcalHoy = logsHoy.filter(l => l.type === 'meal').reduce((s, l) => s + (l.aiMetadata?.kcal || 0), 0);

    const diasUnicos = new Set(logs.map(l => l.dateString));
    const racha = diasUnicos.size;

    const hace7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i);
      return d.toDateString();
    });
    const diasActivosSemana = hace7.filter(d => diasUnicos.has(d)).length;
    const adherenciaSemana = Math.round((diasActivosSemana / 7) * 100);

    const userSnap = await db.collection('users').doc(clienteId).get();
    const userData = userSnap.data() || {};
    const ultimoAcceso = userData.lastOpenTimestamp
      ? new Date(userData.lastOpenTimestamp).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : 'Sin datos';

    const planSnap = await db.collection('plans').doc(clienteId).get();
    const planData = planSnap.exists() ? planSnap.data() : null;
    const todayIndex = (new Date().getDay() + 6) % 7;
    const planHoy = planData?.plan?.[todayIndex];
    const totalEjHoy = planHoy?.entrenamiento?.ejercicios?.length || 0;
    const totalComidasHoy = planHoy?.dieta?.comidas?.length || 0;
    const kcalMeta = userData.goals?.targetKcal || 0;

    const actividadSemana = hace7.reverse().map(d => ({
      dia: new Date(d).toLocaleDateString('es-MX', { weekday: 'short' }),
      fecha: d,
      ejercicios: logs.filter(l => l.dateString === d && l.type === 'workout').length,
      comidas: logs.filter(l => l.dateString === d && l.type === 'meal').length,
      activo: diasUnicos.has(d)
    }));

    const pesosLogs = logs
      .filter(l => l.type === 'weight' && l.content)
      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
      .slice(0, 10)
      .map(l => ({
        fecha: new Date(l.dateString).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }),
        peso: parseFloat(l.content) || 0,
        nota: l.nota || ''
      }));

    const logsHoyDetalle = logsHoy
      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
      .map(l => ({
        type: l.type,
        content: l.content,
        momento: l.momento,
        esGustito: l.esGustito || false,
        esAlternativa: l.esAlternativa || false,
        kcal: l.aiMetadata?.kcal || 0
      }));

    const fotosSnap = await db.collection('photos')
      .where('userId', '==', clienteId)
      .orderBy('timestamp', 'desc')
      .limit(4)
      .get();
    const fotos = fotosSnap.docs.map(d => ({
      id: d.id,
      url: d.data().url,
      fecha: d.data().timestamp?.toDate?.()?.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }) || '',
      analisis: d.data().analisis || ''
    }));

    const reviewHoy = userData.dayReviews?.[new Date().toISOString().split('T')[0]];

    res.json({
      racha,
      adherenciaSemana,
      ultimoAcceso,
      hoy: {
        ejerciciosCompletados: ejerciciosHoy,
        totalEjercicios: totalEjHoy,
        comidasRegistradas: comidasHoy,
        totalComidas: totalComidasHoy,
        kcalRegistradas: kcalHoy,
        kcalMeta,
        logs: logsHoyDetalle,
        review: reviewHoy || null
      },
      actividadSemana,
      pesos: pesosLogs,
      fotos,
      totalLogs: logs.length,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Métricas generales del coach — todos sus clientes
router.get('/coach/dashboard-metricas', authMiddleware, async (req, res) => {
  try {
    const coachUid = req.uid;
    const hoy = new Date().toDateString();

    const clientesSnap = await db.collection('users')
      .where('refCoachId', '==', coachUid)
      .where('modalidad', '==', 'coach')
      .get();

    const clientes = clientesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const totalClientes = clientes.length;
    const activos = clientes.filter(c => c.planStatus === 'active').length;
    const pendientes = clientes.filter(c => c.planStatus !== 'active').length;

    let entrenarонHoy = 0;
    let registraronComidaHoy = 0;
    let adherenciaTotal = 0;

    await Promise.all(clientes.map(async (cliente) => {
      const logsSnap = await db.collection('logs')
        .where('userId', '==', cliente.id)
        .where('dateString', '==', hoy)
        .get();
      const logsHoy = logsSnap.docs.map(d => d.data());
      if (logsHoy.some(l => l.type === 'workout')) entrenarонHoy++;
      if (logsHoy.some(l => l.type === 'meal')) registraronComidaHoy++;

      const hace7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - i);
        return d.toDateString();
      });
      const todosLogs = await db.collection('logs').where('userId', '==', cliente.id).get();
      const diasUnicos = new Set(todosLogs.docs.map(d => d.data().dateString));
      const diasActivos = hace7.filter(d => diasUnicos.has(d)).length;
      adherenciaTotal += (diasActivos / 7) * 100;
    }));

    const adherenciaPromedio = totalClientes > 0 ? Math.round(adherenciaTotal / totalClientes) : 0;

    res.json({
      totalClientes,
      activos,
      pendientes,
      hoy: {
        entrenarонHoy,
        registraronComidaHoy,
        sinActividad: totalClientes - entrenarонHoy,
      },
      adherenciaPromedio,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
