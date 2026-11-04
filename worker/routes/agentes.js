// Agentes de IA — port de backend/routes/agentes.js
import { Hono } from 'hono';
import { authMiddleware } from '../lib/auth.js';
import { firestore } from '../lib/firestore.js';
import { callGemini, toBase64 } from '../lib/gemini.js';
import { AGENTE_NUTRICION, getAgenteConObjetivo } from '../prompts.js';

const r = new Hono();

r.post('/agente-nutricion', authMiddleware, async (c) => {
  try {
    const { prompt, contextoUsuario = {}, uid = null } = await c.req.json();

    let historial = '';
    if (uid) {
      try {
        const logs = await firestore(c.env).query('logs', {
          where: [['userId', '==', uid]], orderBy: ['timestamp', 'desc'], limit: 14,
        });
        if (logs.length) {
          const lineas = logs.map(({ data: l }) =>
            `${l.date || 'fecha?'}: ${l.name || l.food || ''} — ${l.kcal || 0}kcal, P:${l.protein || 0}g C:${l.carbs || 0}g G:${l.fats || 0}g`);
          historial = `\nHISTORIAL RECIENTE DE COMIDAS (últimos 14 registros):\n${lineas.join('\n')}`;
        }
      } catch (e) { /* sin historial */ }
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
    const text = await callGemini(c.env, { parts: [{ text: fullPrompt }] });
    return c.json({ text });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

r.post('/agente-entrenamiento', authMiddleware, async (c) => {
  try {
    const { prompt, contextoUsuario = {}, uid = null } = await c.req.json();
    const db = firestore(c.env);

    let historialPlan = '';
    if (uid) {
      try {
        const planSnap = await db.get(`plans/${uid}`);
        if (planSnap) {
          const planData = planSnap.data;
          const daysUnlocked = planData.daysUnlocked || 3;
          const plan = planData.plan || [];
          const resumen = plan.slice(0, 7).map((d) =>
            `${d.dia}: ${d.entrenamiento?.ejercicios?.map((e) => `${e.nombre} ${e.series}x${e.reps}`).join(', ') || 'Descanso'}`
          ).join('\n');
          historialPlan = `\nPLAN ACTUAL DEL USUARIO:\n${resumen}\nDías desbloqueados: ${daysUnlocked}/7`;
        }

        const userSnap = await db.get(`users/${uid}`);
        if (userSnap && userSnap.data.esfuerzo) {
          const esfuerzo = userSnap.data.esfuerzo;
          const dias = Object.keys(esfuerzo).sort().slice(-7);
          const resumenEsfuerzo = dias.map((dia) => {
            const ejercicios = Object.values(esfuerzo[dia]);
            return `${dia}: ${ejercicios.map((e) => `${e.ejercicio} RPE:${e.rpe || '-'} RIR:${e.rir ?? '-'}`).join(', ')}`;
          }).join('\n');
          if (resumenEsfuerzo) historialPlan += `\n\nHISTORIAL DE ESFUERZO RPE/RIR (últimos 7 días — ajustar intensidad del próximo plan):\n${resumenEsfuerzo}`;
        }
      } catch (e) { /* sin plan */ }
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
    const text = await callGemini(c.env, {
      model: 'gemini-2.5-flash', retryModel: 'gemini-2.5-flash-lite', parts: [{ text: fullPrompt }],
    });
    return c.json({ text });
  } catch (e) {
    console.error('🏋️ agente-entrenamiento error:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

r.post('/gemini', authMiddleware, async (c) => {
  try {
    const { prompt, systemInstruction = '', model = 'gemini-2.5-flash-lite' } = await c.req.json();
    const fullPrompt = systemInstruction ? `${systemInstruction}\n\nUsuario: ${prompt}` : prompt;
    const text = await callGemini(c.env, { model, parts: [{ text: fullPrompt }], retryDelayMs: 3000 });
    return c.json({ text });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

r.post('/gemini-images', authMiddleware, async (c) => {
  try {
    const { prompt, imageUrls = [] } = await c.req.json();
    const imageParts = await Promise.all(imageUrls.map(async (url) => {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      return { inlineData: { data: toBase64(buf), mimeType: 'image/jpeg' } };
    }));
    const text = await callGemini(c.env, { parts: [...imageParts, { text: prompt }] });
    return c.json({ text });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

export default r;
