// Sesión demo para coaches — port de backend/routes/demo.js
// Corrige hueco de seguridad: antes cualquiera podía mandar el uid de OTRO usuario
// y sobrescribirlo como coach premium. Ahora exige el token de la sesión anónima
// recién creada y que el uid coincida.
import { Hono } from 'hono';
import { authMiddleware } from '../lib/auth.js';
import { firestore, SERVER_TIMESTAMP } from '../lib/firestore.js';

const r = new Hono();

const CLIENTES_DEMO = [
  { name: 'Ana García', email: 'ana.demo@fittrack.com', objective: 'Pérdida de Grasa', weight: '68', height: '165', age: '28', equipment: 'Gym Completo', activity: 'Moderado', targetKcal: 1650, planStatus: 'active', premium: true },
  { name: 'Carlos Mendoza', email: 'carlos.demo@fittrack.com', objective: 'Ganancia Muscular', weight: '75', height: '178', age: '32', equipment: 'Gym Completo', activity: 'Activo', targetKcal: 2800, planStatus: 'active', premium: true },
  { name: 'María López', email: 'maria.demo@fittrack.com', objective: 'Recomposición', weight: '62', height: '160', age: '25', equipment: 'En casa (con pesas)', activity: 'Moderado', targetKcal: 1900, planStatus: 'pending', premium: false },
  { name: 'Roberto Silva', email: 'roberto.demo@fittrack.com', objective: 'Pérdida de Grasa', weight: '92', height: '180', age: '45', equipment: 'Gym Completo', activity: 'Sedentario', targetKcal: 1800, planStatus: 'active', premium: false },
  { name: 'Laura Torres', email: 'laura.demo@fittrack.com', objective: 'Mantenimiento', weight: '58', height: '162', age: '30', equipment: 'En casa (sin equipo)', activity: 'Activo', targetKcal: 2100, planStatus: 'active', premium: true },
];

r.post('/demo/crear-sesion', authMiddleware, async (c) => {
  try {
    const { uid } = await c.req.json();
    if (!uid) return c.json({ error: 'uid requerido' }, 400);
    if (uid !== c.get('uid')) return c.json({ error: 'No autorizado' }, 403);
    if (c.get('authProvider') !== 'anonymous') return c.json({ error: 'La demo solo es para sesiones anónimas' }, 403);

    const db = firestore(c.env);
    await db.set(`users/${uid}`, {
      name: 'Coach Demo', email: 'demo@fittrackpro.store', role: 'coach', isDemo: true,
      demoCreatedAt: Date.now(), coachCode: `demo${uid.slice(0, 6)}`, onboardingComplete: true,
      premium: true, createdAt: SERVER_TIMESTAMP,
    });

    const clienteIds = [];
    await Promise.all(CLIENTES_DEMO.map(async (cliente) => {
      const id = db.newId();
      clienteIds.push(id);
      await db.set(`users/${id}`, {
        ...cliente, modalidad: 'coach', refCoachId: uid, isDemo: true, demoCoachId: uid, onboardingComplete: true,
        goals: {
          name: cliente.name, objective: cliente.objective, weight: cliente.weight, height: cliente.height,
          age: cliente.age, equipment: cliente.equipment, activity: cliente.activity, targetKcal: cliente.targetKcal,
        },
        coachDeadline: Date.now() + 24 * 60 * 60 * 1000,
        createdAt: SERVER_TIMESTAMP,
      });
    }));

    console.log(`🎭 Sesión demo creada para: ${uid}`);
    return c.json({ ok: true, clienteIds });
  } catch (e) { console.error('Demo error:', e); return c.json({ error: e.message }, 500); }
});

export default r;
