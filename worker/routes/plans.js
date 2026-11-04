// Planes — port de backend/routes/plans.js
// Corrige: .exists() como función en guardar-plan-cliente (siempre respondía 500).
import { Hono } from 'hono';
import { authMiddleware } from '../lib/auth.js';
import { firestore, SERVER_TIMESTAMP } from '../lib/firestore.js';
import { sendMail } from '../lib/email.js';
import { fmtMX } from '../lib/fechas.js';

const r = new Hono();

// Coach: guardar plan de cliente vía backend (evita reglas de Firestore)
r.post('/coach/guardar-plan-cliente', authMiddleware, async (c) => {
  try {
    const coachUid = c.get('uid');
    const { clienteId, plan, daysUnlocked = 7 } = await c.req.json();
    if (!clienteId || !plan) return c.json({ error: 'Faltan datos' }, 400);
    const db = firestore(c.env);

    const clienteSnap = await db.get(`users/${clienteId}`);
    if (!clienteSnap) return c.json({ error: 'Cliente no encontrado' }, 404);
    const clienteData = clienteSnap.data;
    if (clienteData.refCoachId !== coachUid && clienteData.role !== 'coach') {
      return c.json({ error: 'No autorizado' }, 403);
    }

    const planSnap = await db.get(`plans/${clienteId}`);
    if (planSnap && planSnap.data.plan) {
      await db.set(`planHistorial/${clienteId}_${Date.now()}`, {
        userId: clienteId, plan: planSnap.data.plan, archivedAt: SERVER_TIMESTAMP,
        semana: fmtMX(new Date(), { day: '2-digit', month: 'short', year: 'numeric' }),
      });
    }

    await db.set(`plans/${clienteId}`, { plan, daysUnlocked, updatedAt: SERVER_TIMESTAMP }, { merge: true });
    await db.update(`users/${clienteId}`, { planStatus: 'active' });

    console.log(`✅ Plan guardado por coach ${coachUid} para cliente ${clienteId}`);
    return c.json({ ok: true });
  } catch (e) {
    console.error('guardar-plan-cliente error:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

r.post('/guardar-plan', authMiddleware, async (c) => {
  try {
    const { plan, daysUnlocked = 3, startDayIndex = 0 } = await c.req.json();
    if (!plan || !Array.isArray(plan)) return c.json({ error: 'Plan inválido' }, 400);
    await firestore(c.env).set(`plans/${c.get('uid')}`, { plan, daysUnlocked, startDayIndex, updatedAt: SERVER_TIMESTAMP }, { merge: true });
    return c.json({ ok: true });
  } catch (e) { return c.json({ error: e.message }, 500); }
});

// Helper: emoji según momento de comida
const emojiComida = (momento) => {
  const m = momento?.toLowerCase() || '';
  if (m.includes('desayuno')) return '🌅';
  if (m.includes('almuerzo') || m.includes('comida')) return '☀️';
  if (m.includes('cena')) return '🌙';
  if (m.includes('snack') || m.includes('merienda')) return '🍎';
  if (m.includes('post') || m.includes('pre')) return '💪';
  return '🍽️';
};

// Enviar plan por email al cliente (el correo se habilita en la Fase 2)
r.post('/enviar-plan-email', authMiddleware, async (c) => {
  try {
    const { clienteId } = await c.req.json();
    const db = firestore(c.env);
    const [userSnap, planSnap] = await Promise.all([db.get(`users/${clienteId}`), db.get(`plans/${clienteId}`)]);
    if (!userSnap || !planSnap) return c.json({ error: 'Usuario o plan no encontrado' }, 404);

    const userData = userSnap.data;
    const planData = planSnap.data.plan;
    if (!userData.email) return c.json({ error: 'El usuario no tiene email' }, 400);

    const diasHtml = planData.map(dia => {
      const esDescanso = !dia.entrenamiento?.ejercicios?.length;
      const ejerciciosHtml = esDescanso
        ? '<p style="color:#94a3b8;font-style:italic;">😴 Día de descanso — aprovecha para recuperarte</p>'
        : dia.entrenamiento.ejercicios.map(e =>
            `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #1e293b;">
              <span style="color:#10b981;font-weight:900;width:20px;">💪</span>
              <span style="color:#e2e8f0;flex:1;">${e.nombre}</span>
              <span style="color:#10b981;font-weight:700;">${e.series}×${e.reps}</span>
            </div>`
          ).join('');

      const comidasHtml = dia.dieta?.comidas?.map(c =>
        `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #1e293b;">
          <span style="font-size:18px;">${emojiComida(c.momento)}</span>
          <div>
            <span style="color:#f97316;font-weight:700;font-size:11px;text-transform:uppercase;">${c.momento}</span>
            <p style="color:#cbd5e1;margin:2px 0 0;font-size:13px;">${c.descripcion}</p>
          </div>
        </div>`
      ).join('') || '';

      const macros = dia.dieta ? `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px;">
          <div style="background:#1e293b;border-radius:8px;padding:8px;text-align:center;">
            <div style="color:#f97316;font-weight:900;">${dia.dieta.kcal}</div>
            <div style="color:#64748b;font-size:10px;">kcal</div>
          </div>
          <div style="background:#1e293b;border-radius:8px;padding:8px;text-align:center;">
            <div style="color:#60a5fa;font-weight:900;">${dia.dieta.proteina}g</div>
            <div style="color:#64748b;font-size:10px;">prot</div>
          </div>
          <div style="background:#1e293b;border-radius:8px;padding:8px;text-align:center;">
            <div style="color:#facc15;font-weight:900;">${dia.dieta.carbs}g</div>
            <div style="color:#64748b;font-size:10px;">carbs</div>
          </div>
          <div style="background:#1e293b;border-radius:8px;padding:8px;text-align:center;">
            <div style="color:#f472b6;font-weight:900;">${dia.dieta.grasas}g</div>
            <div style="color:#64748b;font-size:10px;">grasas</div>
          </div>
        </div>` : '';

      return `
        <div style="margin-bottom:24px;background:#131929;border-radius:16px;overflow:hidden;">
          <div style="background:#0f172a;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;">
            <span style="color:#10b981;font-weight:900;font-size:13px;text-transform:uppercase;letter-spacing:1px;">${dia.dia}</span>
            <span style="color:#64748b;font-size:11px;">${esDescanso ? '😴 Descanso' : '🏋️ Entreno'}</span>
          </div>
          <div style="padding:16px;">
            ${ejerciciosHtml}
            ${comidasHtml ? `<div style="margin-top:12px;">${comidasHtml}</div>` : ''}
            ${macros}
          </div>
        </div>`;
    }).join('');

    await sendMail(c.env, {
      to: userData.email,
      subject: `🏋️ Tu plan personalizado está listo, ${userData.name}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#fff;border-radius:20px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#10b981,#059669);padding:32px;text-align:center;">
            <div style="font-size:48px;margin-bottom:8px;">🏋️</div>
            <h1 style="margin:0;font-size:24px;font-weight:900;">Tu plan está listo</h1>
            <p style="margin:8px 0 0;opacity:0.85;">Hola ${userData.name}, aquí está tu programa personalizado</p>
          </div>
          <div style="padding:24px;">
            <div style="background:#1e293b;border-radius:12px;padding:16px;margin-bottom:24px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:13px;">Objetivo: <strong style="color:#10b981;">${userData.goals?.objective || 'Fitness'}</strong> · ${planData.length} días</p>
            </div>
            ${diasHtml}
            <div style="text-align:center;margin-top:24px;">
              <a href="https://fittrackpro.store" style="display:inline-block;background:#10b981;color:#000;font-weight:900;padding:14px 32px;border-radius:12px;text-decoration:none;font-size:15px;">
                Ver mi plan en la app →
              </a>
            </div>
            <p style="color:#475569;font-size:11px;text-align:center;margin-top:16px;">FitTrack Pro · fittrackpro.store</p>
          </div>
        </div>`
    });

    console.log(`📧 Plan enviado por email a: ${userData.email}`);
    return c.json({ ok: true });
  } catch (e) {
    console.error('enviar-plan-email error:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

export default r;
