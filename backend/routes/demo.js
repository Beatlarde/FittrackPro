const express = require('express');
const { admin, db } = require('../config/firebase');
const router = express.Router();

const CLIENTES_DEMO = [
  { name: 'Ana García', email: 'ana.demo@fittrack.com', objective: 'Pérdida de Grasa', weight: '68', height: '165', age: '28', equipment: 'Gym Completo', activity: 'Moderado', targetKcal: 1650, planStatus: 'active', premium: true },
  { name: 'Carlos Mendoza', email: 'carlos.demo@fittrack.com', objective: 'Ganancia Muscular', weight: '75', height: '178', age: '32', equipment: 'Gym Completo', activity: 'Activo', targetKcal: 2800, planStatus: 'active', premium: true },
  { name: 'María López', email: 'maria.demo@fittrack.com', objective: 'Recomposición', weight: '62', height: '160', age: '25', equipment: 'En casa (con pesas)', activity: 'Moderado', targetKcal: 1900, planStatus: 'pending', premium: false },
  { name: 'Roberto Silva', email: 'roberto.demo@fittrack.com', objective: 'Pérdida de Grasa', weight: '92', height: '180', age: '45', equipment: 'Gym Completo', activity: 'Sedentario', targetKcal: 1800, planStatus: 'active', premium: false },
  { name: 'Laura Torres', email: 'laura.demo@fittrack.com', objective: 'Mantenimiento', weight: '58', height: '162', age: '30', equipment: 'En casa (sin equipo)', activity: 'Activo', targetKcal: 2100, planStatus: 'active', premium: true },
];

router.post('/demo/crear-sesion', async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ error: 'uid requerido' });

    const batch = db.batch();
    const clienteIds = [];

    const coachRef = db.collection('users').doc(uid);
    batch.set(coachRef, {
      name: 'Coach Demo',
      email: 'demo@fittrackpro.store',
      role: 'coach',
      isDemo: true,
      demoCreatedAt: Date.now(),
      coachCode: `demo${uid.slice(0, 6)}`,
      onboardingComplete: true,
      premium: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    for (const cliente of CLIENTES_DEMO) {
      const clienteRef = db.collection('users').doc();
      clienteIds.push(clienteRef.id);
      batch.set(clienteRef, {
        ...cliente,
        modalidad: 'coach',
        refCoachId: uid,
        isDemo: true,
        demoCoachId: uid,
        onboardingComplete: true,
        goals: {
          name: cliente.name,
          objective: cliente.objective,
          weight: cliente.weight,
          height: cliente.height,
          age: cliente.age,
          equipment: cliente.equipment,
          activity: cliente.activity,
          targetKcal: cliente.targetKcal,
        },
        coachDeadline: Date.now() + 24 * 60 * 60 * 1000,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    await batch.commit();
    console.log(`🎭 Sesión demo creada para: ${uid}`);
    res.json({ ok: true, clienteIds });
  } catch (e) { console.error('Demo error:', e); res.status(500).json({ error: e.message }); }
});

module.exports = router;
