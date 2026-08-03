const express = require('express');
const { db } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const { AGENTE_NUTRICION, getAgenteConObjetivo } = require('../services/gemini');
const router = express.Router();

router.post('/agente-nutricion', authMiddleware, async (req, res) => {
  try {
    const { prompt, contextoUsuario = {}, uid = null } = req.body;

    let historial = '';
    if (uid) {
      try {
        const logsSnap = await db.collection('logs').where('userId', '==', uid)
          .orderBy('timestamp', 'desc').limit(14).get();
        if (!logsSnap.empty) {
          const logs = logsSnap.docs.map(d => {
            const l = d.data();
            return `${l.date || 'fecha?'}: ${l.name || l.food || ''} — ${l.kcal || 0}kcal, P:${l.protein || 0}g C:${l.carbs || 0}g G:${l.fats || 0}g`;
          });
          historial = `\nHISTORIAL RECIENTE DE COMIDAS (últimos 14 registros):\n${logs.join('\n')}`;
        }
      } catch(e) { /* sin historial */ }
    }

    const contexto = contextoUsuario.nombre ? `
CONTEXTO DEL USUARIO:
- Nombre: ${contextoUsuario.nombre}
- Objetivo: ${contextoUsuario.objetivo || 'no especificado'}
- Peso: ${contextoUsuario.peso || '?'}kg, Altura: ${contextoUsuario.altura || '?'}cm
- Nivel actividad: ${contextoUsuario.actividad || 'no especificado'}
- Kcal objetivo: ${contextoUsuario.kcal || 'no especificado'}
- Restricciones: ${contextoUsuario.restricciones || 'ninguna'}
${historial}` : historial;

    const fullPrompt = `${AGENTE_NUTRICION}\n${contexto}\n\nConsulta: ${prompt}`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }) }
    );
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message });
    res.json({ text: data.candidates?.[0]?.content?.parts?.[0]?.text || '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/agente-entrenamiento', authMiddleware, async (req, res) => {
  try {
    const { prompt, contextoUsuario = {}, uid = null } = req.body;

    let historialPlan = '';
    if (uid) {
      try {
        const planSnap = await db.collection('plans').doc(uid).get();
        if (planSnap.exists) {
          const planData = planSnap.data();
          const daysUnlocked = planData.daysUnlocked || 3;
          const plan = planData.plan || [];
          const resumen = plan.slice(0, 7).map(d =>
            `${d.dia}: ${d.entrenamiento?.ejercicios?.map(e => `${e.nombre} ${e.series}x${e.reps}`).join(', ') || 'Descanso'}`
          ).join('\n');
          historialPlan = `\nPLAN ACTUAL DEL USUARIO:\n${resumen}\nDías desbloqueados: ${daysUnlocked}/7`;
        }

        const userSnap = await db.collection('users').doc(uid).get();
        if (userSnap.exists && userSnap.data().esfuerzo) {
          const esfuerzo = userSnap.data().esfuerzo;
          const dias = Object.keys(esfuerzo).sort().slice(-7);
          const resumenEsfuerzo = dias.map(dia => {
            const ejercicios = Object.values(esfuerzo[dia]);
            return `${dia}: ${ejercicios.map(e => `${e.ejercicio} RPE:${e.rpe || '-'} RIR:${e.rir ?? '-'}`).join(', ')}`;
          }).join('\n');
          if (resumenEsfuerzo) historialPlan += `\n\nHISTORIAL DE ESFUERZO RPE/RIR (últimos 7 días — ajustar intensidad del próximo plan):\n${resumenEsfuerzo}`;
        }
      } catch(e) { /* sin plan */ }
    }

    const contexto = contextoUsuario.nombre ? `
CONTEXTO DEL USUARIO:
- Nombre: ${contextoUsuario.nombre}
- Objetivo: ${contextoUsuario.objetivo || 'no especificado'}
- Peso: ${contextoUsuario.peso || '?'}kg, Altura: ${contextoUsuario.altura || '?'}cm
- Nivel actividad: ${contextoUsuario.actividad || 'no especificado'}
- Equipamiento: ${contextoUsuario.equipo || 'no especificado'}
- Lesiones: ${contextoUsuario.lesiones || 'ninguna'}
${historialPlan}` : historialPlan;

    const agenteEspecializado = getAgenteConObjetivo(contextoUsuario.objetivo || 'Mantenimiento');
    const fullPrompt = `${agenteEspecializado}\n${contexto}\n\nConsulta: ${prompt}`;

    const llamarGemini = async (modelo) => {
      return await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }) }
      );
    };

    let response = await llamarGemini('gemini-2.5-flash');
    if (response.status === 503) {
      console.log('🏋️ Gemini 2.5-flash 503 — reintentando con 2.5-flash-lite...');
      await new Promise(r => setTimeout(r, 2000));
      response = await llamarGemini('gemini-2.5-flash-lite');
    }

    const data = await response.json();
    console.log('🏋️ Gemini status:', response.status, '| error:', data.error?.message || 'OK');
    if (!response.ok) return res.status(500).json({ error: data.error?.message });
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text: texto });
  } catch (e) { console.error('🏋️ agente-entrenamiento error:', e.message); res.status(500).json({ error: e.message }); }
});

router.post('/gemini', authMiddleware, async (req, res) => {
  try {
    const { prompt, systemInstruction = '', model = 'gemini-2.5-flash-lite' } = req.body;
    const fullPrompt = systemInstruction ? `${systemInstruction}\n\nUsuario: ${prompt}` : prompt;
    let response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }) }
    );
    if (response.status === 503) {
      await new Promise(r => setTimeout(r, 3000));
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }) }
      );
    }
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message });
    res.json({ text: data.candidates?.[0]?.content?.parts?.[0]?.text || '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/gemini-images', authMiddleware, async (req, res) => {
  try {
    const { prompt, imageUrls = [] } = req.body;
    const imageParts = await Promise.all(imageUrls.map(async (url) => {
      const r = await fetch(url);
      const buf = await r.arrayBuffer();
      return { inlineData: { data: Buffer.from(buf).toString('base64'), mimeType: 'image/jpeg' } };
    }));
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [...imageParts, { text: prompt }] }] }) }
    );
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message });
    res.json({ text: data.candidates?.[0]?.content?.parts?.[0]?.text || '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
