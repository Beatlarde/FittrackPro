const express = require('express');
const { db } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.post('/calcular-macros', authMiddleware, async (req, res) => {
  try {
    const { weight, height, age, gender, activity, objective, bodyType } = req.body;
    if (!weight || !height || !age) return res.status(400).json({ error: 'Faltan datos' });

    const bmr = gender === 'femenino'
      ? (10 * weight) + (6.25 * height) - (5 * age) - 161
      : (10 * weight) + (6.25 * height) - (5 * age) + 5;

    const mult = { 'Sedentario': 1.2, 'Poca actividad': 1.375, 'Moderado': 1.55, 'Activo': 1.725, 'Atleta': 1.9 };
    const tdee = Math.round(bmr * (mult[activity] || 1.55));

    const ajuste = { 'Pérdida de Grasa': -400, 'Ganancia Muscular': 300, 'Recomposición': -150, 'Mantenimiento': 0 };
    const kcal = tdee + (ajuste[objective] || 0);

    const macrosDist = {
      'Pérdida de Grasa':  { prot: 2.2, grasas: 0.8 },
      'Ganancia Muscular': { prot: 2.0, grasas: 1.0 },
      'Recomposición':     { prot: 2.4, grasas: 0.9 },
      'Mantenimiento':     { prot: 1.8, grasas: 1.0 }
    };
    const dist = macrosDist[objective] || macrosDist['Mantenimiento'];
    const proteina = Math.round(weight * dist.prot);
    const grasas = Math.round(weight * dist.grasas);
    const carbs = Math.max(Math.round((kcal - (proteina * 4) - (grasas * 9)) / 4), 50);

    res.json({ kcal, proteina, carbs, grasas, tdee, bmr: Math.round(bmr) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/registrar-esfuerzo', authMiddleware, async (req, res) => {
  try {
    const { ejercicioKey, ejercicio, rpe, rir } = req.body;
    if (!ejercicioKey || !ejercicio) return res.status(400).json({ error: 'Faltan datos' });
    const today = new Date().toISOString().split('T')[0];
    await db.collection('users').doc(req.uid).update({
      [`esfuerzo.${today}.${ejercicioKey}`]: { ejercicio, rpe, rir, ts: Date.now() }
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
