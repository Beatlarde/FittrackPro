// Cálculo de macros (onboarding) y registro de esfuerzo RPE/RIR — port de backend/routes/metrics.js
import { Hono } from 'hono';
import { authMiddleware } from '../lib/auth.js';
import { firestore } from '../lib/firestore.js';

const r = new Hono();

r.post('/calcular-macros', authMiddleware, async (c) => {
  try {
    const { weight, height, age, gender, activity, objective } = await c.req.json();
    if (!weight || !height || !age) return c.json({ error: 'Faltan datos' }, 400);

    const bmr = gender === 'femenino'
      ? (10 * weight) + (6.25 * height) - (5 * age) - 161
      : (10 * weight) + (6.25 * height) - (5 * age) + 5;

    const mult = { 'Sedentario': 1.2, 'Poca actividad': 1.375, 'Moderado': 1.55, 'Activo': 1.725, 'Atleta': 1.9 };
    const tdee = Math.round(bmr * (mult[activity] || 1.55));

    const ajuste = { 'Pérdida de Grasa': -400, 'Ganancia Muscular': 300, 'Recomposición': -150, 'Mantenimiento': 0 };
    const kcal = tdee + (ajuste[objective] || 0);

    const macrosDist = {
      'Pérdida de Grasa': { prot: 2.2, grasas: 0.8 },
      'Ganancia Muscular': { prot: 2.0, grasas: 1.0 },
      'Recomposición': { prot: 2.4, grasas: 0.9 },
      'Mantenimiento': { prot: 1.8, grasas: 1.0 },
    };
    const dist = macrosDist[objective] || macrosDist['Mantenimiento'];
    const proteina = Math.round(weight * dist.prot);
    const grasas = Math.round(weight * dist.grasas);
    const carbs = Math.max(Math.round((kcal - (proteina * 4) - (grasas * 9)) / 4), 50);

    return c.json({ kcal, proteina, carbs, grasas, tdee, bmr: Math.round(bmr) });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

r.post('/registrar-esfuerzo', authMiddleware, async (c) => {
  try {
    const { ejercicioKey, ejercicio, rpe, rir } = await c.req.json();
    if (!ejercicioKey || !ejercicio) return c.json({ error: 'Faltan datos' }, 400);
    // Fecha en hora de CDMX (en el VPS era la del servidor)
    const today = new Date(Date.now() - 6 * 3600 * 1000).toISOString().split('T')[0];
    await firestore(c.env).update(`users/${c.get('uid')}`, {
      [`esfuerzo.${today}.${ejercicioKey}`]: { ejercicio, rpe, rir, ts: Date.now() },
    });
    return c.json({ ok: true });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

export default r;
