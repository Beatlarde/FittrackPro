// Tareas programadas — port de backend/crons/index.js (node-cron)
//
// En el plan gratis de Workers cada ejecución puede hacer ~50 peticiones externas.
// Por eso, en vez de 6 crons diarios que procesan a todos de golpe (y se cortarían),
// un solo Cron Trigger corre cada 15 minutos y cada tarea avanza poco a poco dentro de
// su ventana de horas. Las marcas en el usuario (lastReminderDate, lastInactivityMsg,
// weekCongratsSent, lastAbsenceMsg, pendingDayReview) evitan mensajes repetidos.
import { firestore } from './lib/firestore.js';
import { sendMail } from './lib/email.js';
import { generarMensajeCoach, enviarMensajeAuto } from './lib/mensajes.js';
import { ahoraCDMX, hoyCDMX } from './lib/fechas.js';

const DIA = 24 * 60 * 60 * 1000;
const tsMs = (t) => (t?.toMillis ? t.toMillis() : 0);

// Presupuesto de peticiones externas por ejecución (deja margen bajo el límite de 50)
function crearPresupuesto(total = 42) {
  let restantes = total;
  return { gastar(n) { if (restantes < n) return false; restantes -= n; return true; }, get restantes() { return restantes; } };
}

// ---------- tareas ----------

// 9 pm+: recordatorio a quien no ha registrado comidas hoy
async function recordatorioComidas(env, db, p) {
  if (!p.gastar(2)) return;
  const hoyIso = new Date().toISOString().split('T')[0]; // misma clave que usaba el original
  const hoy = hoyCDMX();                                  // como guarda el frontend dateString
  const [usuarios, comidasHoy] = await Promise.all([
    db.query('users', { where: [['onboardingComplete', '==', true], ['planStatus', '==', 'active']] }),
    // Corrige: el original buscaba en la colección "activity", que la app nunca escribe,
    // y con la fecha UTC → mandaba el recordatorio aunque sí hubieras registrado.
    db.query('logs', { where: [['dateString', '==', hoy], ['type', '==', 'meal']] }),
  ]);
  const conComida = new Set(comidasHoy.map((d) => d.data.userId));

  for (const { id, data: u } of usuarios) {
    if (!u.email || !u.mealTimes || conComida.has(id) || u.lastReminderDate === hoyIso) continue;
    if (!p.gastar(2)) return;
    const nombre = u.name || 'Usuario';
    try {
      await sendMail(env, {
        to: u.email,
        subject: `${nombre}, ¿ya registraste tus comidas de hoy? 🥗`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#fff;border-radius:16px;padding:32px;">
            <h2 style="color:#10b981;margin-bottom:8px;">¡Hola, ${nombre}! 👋</h2>
            <p style="color:#94a3b8;margin-bottom:16px;">Notamos que hoy no has registrado ninguna de tus comidas en FitTrack Pro.</p>
            <p style="color:#fff;margin-bottom:8px;">Tus horarios configurados:</p>
            <ul style="color:#10b981;padding-left:20px;">
              <li>🌅 Desayuno: ${u.mealTimes.desayuno}</li>
              <li>☀️ Comida: ${u.mealTimes.comida}</li>
              <li>🌙 Cena: ${u.mealTimes.cena}</li>
            </ul>
            <p style="color:#94a3b8;margin-top:16px;">Registrar tus comidas te ayuda a mantenerte en el camino. ¡Tú puedes!</p>
            <a href="${env.FRONTEND_URL}" style="display:inline-block;margin-top:20px;background:#10b981;color:#000;font-weight:900;padding:12px 24px;border-radius:12px;text-decoration:none;">
              Ir a FitTrack Pro →
            </a>
          </div>`,
      });
      console.log('📧 Recordatorio enviado a:', u.email);
    } catch (e) { console.error('Error enviando recordatorio a', u.email, e.message); }
    await db.update(`users/${id}`, { lastReminderDate: hoyIso });
  }
}

// Mensaje del coach con IA a usuarios que cumplen una condición
async function mensajeCoach(env, db, p, { nombreTarea, filtro, contexto, asunto, marca }) {
  if (!p.gastar(1)) return;
  const usuarios = await db.query('users', { where: [['planStatus', '==', 'active']] });
  for (const { id, data: u } of usuarios) {
    if (!filtro(u)) continue;
    if (!p.gastar(4)) { console.log(`⏸️ ${nombreTarea}: presupuesto agotado, sigue en la próxima ejecución`); return; }
    try {
      const texto = await generarMensajeCoach(env, u.name, u.goals?.objective, contexto);
      await enviarMensajeAuto(env, id, u, texto, asunto(u));
      await db.update(`users/${id}`, marca());
    } catch (e) { console.error(`${nombreTarea} error con ${u.email}:`, e.message); }
  }
}

// 9 pm+: marcar la pregunta "¿cómo estuvo tu día?" para quien no la ha contestado
async function marcarPreguntaDelDia(env, db, p) {
  if (!p.gastar(1)) return;
  const hoy = new Date().toISOString().split('T')[0]; // el frontend compara con esta misma fecha
  const usuarios = await db.query('users', { where: [['onboardingComplete', '==', true], ['planStatus', '==', 'active']] });
  for (const { id, data: u } of usuarios) {
    if (u.dayReviews?.[hoy] || u.pendingDayReview === hoy) continue;
    if (!p.gastar(1)) return;
    await db.update(`users/${id}`, { pendingDayReview: hoy });
  }
}

// Cada ejecución: borrar sesiones demo de más de 24 h (y sus clientes de ejemplo)
async function limpiarDemos(env, db, p) {
  if (!p.gastar(1)) return;
  const viejas = await db.query('users', { where: [['isDemo', '==', true], ['demoCreatedAt', '<', Date.now() - DIA]] });
  let borradas = 0;
  for (const { id, data } of viejas) {
    if (data.role === 'coach') {
      if (!p.gastar(1)) break;
      const clientes = await db.query('users', { where: [['demoCoachId', '==', id]] });
      for (const cl of clientes) { if (!p.gastar(1)) break; await db.delete(`users/${cl.id}`); }
    }
    if (!p.gastar(1)) break;
    await db.delete(`users/${id}`);
    borradas++;
  }
  if (borradas) console.log(`🗑️ Sesiones demo limpiadas: ${borradas}`);
}

// ---------- orquestador ----------

export async function scheduled(event, env, ctx) {
  const hora = ahoraCDMX().getUTCHours(); // hora en CDMX
  const db = firestore(env);
  const p = crearPresupuesto();
  const ahora = Date.now();
  const tareas = [];

  if (hora >= 21) tareas.push(['recordatorio de comidas', () => recordatorioComidas(env, db, p)]);
  if (hora >= 21) tareas.push(['pregunta del día', () => marcarPreguntaDelDia(env, db, p)]);
  if (hora >= 20 && hora < 23) tareas.push(['3 días sin abrir', () => mensajeCoach(env, db, p, {
    nombreTarea: 'ausencia',
    filtro: (u) => (u.lastOpenTimestamp || tsMs(u.createdAt)) <= ahora - 3 * DIA && ahora - (u.lastAbsenceMsg || 0) >= 3 * DIA,
    contexto: 'El usuario lleva 3 días sin abrir la app. Recuérdale que su plan lo está esperando.',
    asunto: (u) => `${u.name}, tu plan te está esperando 🔥`,
    marca: () => ({ lastAbsenceMsg: Date.now() }),
  })]);
  if (hora >= 10 && hora < 13) tareas.push(['2 días sin actividad', () => mensajeCoach(env, db, p, {
    nombreTarea: 'inactividad',
    filtro: (u) => (u.lastActivityTimestamp || tsMs(u.createdAt)) <= ahora - 2 * DIA && ahora - (u.lastInactivityMsg || 0) >= 3 * DIA,
    contexto: 'El usuario lleva 2 o más días sin registrar actividad. Motívalo a retomar su rutina.',
    asunto: (u) => `${u.name}, ¡te extrañamos! 💪`,
    marca: () => ({ lastInactivityMsg: Date.now() }),
  })]);
  if (hora >= 11 && hora < 14) tareas.push(['primera semana', () => mensajeCoach(env, db, p, {
    nombreTarea: 'primera semana',
    filtro: (u) => !u.weekCongratsSent && tsMs(u.createdAt) > 0 && tsMs(u.createdAt) <= ahora - 7 * DIA,
    contexto: 'El usuario completó su primera semana. Felicítalo efusivamente.',
    asunto: (u) => `🏆 ${u.name}, ¡completaste tu primera semana!`,
    marca: () => ({ weekCongratsSent: true }),
  })]);
  tareas.push(['limpiar demos', () => limpiarDemos(env, db, p)]);

  for (const [nombre, tarea] of tareas) {
    try { await tarea(); } catch (e) { console.error(`Cron "${nombre}" error:`, e.message); }
  }
  console.log(`⏰ Cron ${String(hora).padStart(2, '0')}h CDMX: ${tareas.map((t) => t[0]).join(', ')} | presupuesto sobrante: ${p.restantes}`);
}
