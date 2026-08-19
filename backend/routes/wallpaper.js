const crypto = require('crypto');
const express = require('express');
const { db } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const { renderWallpaperPNG } = require('../services/wallpaperRender');
const router = express.Router();

// ---------------------------------------------------------------------------
// Fuente única de verdad para el Shortcut de wallpaper (JSON y ahora también
// imagen PNG). Combina:
//   - plans/{uid}.plan[todayIndex]      → ejercicios y comidas planeados
//   - users/{uid}.dailyProgress[fecha]  → qué se marcó como completado hoy
//
// La fecha ("fecha") usa el mismo formato que ya escribe el frontend en
// dailyProgress y dayReviews: new Date().toISOString().split('T')[0] (UTC).
// El día de la semana ("todayIndex", para indexar plan[]) se calcula en
// America/Mexico_City, la misma zona horaria ya hardcodeada en el resto de
// la app (sincronización de Google Calendar). Si en el futuro FitTrack
// soporta usuarios en otras zonas horarias, esto necesita volverse dinámico
// por usuario.
// ---------------------------------------------------------------------------

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function getTodayIndexMexico() {
  const weekdayShort = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    weekday: 'short',
  }).format(new Date());
  const map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[weekdayShort];
}

function getFechaUTC() {
  return new Date().toISOString().split('T')[0];
}

// Arma el objeto "resumen" del día para un uid dado. Lanza un error con
// .code = 'sin_plan' si el usuario no tiene plan generado todavía, para que
// cada endpoint (JSON o imagen) decida cómo responder eso a su manera.
async function getResumenDia(uid) {
  const todayIndex = getTodayIndexMexico();
  const fecha = getFechaUTC();

  const [planSnap, userSnap] = await Promise.all([
    db.collection('plans').doc(uid).get(),
    db.collection('users').doc(uid).get(),
  ]);

  if (!planSnap.exists || !planSnap.data()?.plan) {
    const err = new Error('El usuario no ha generado un plan todavía.');
    err.code = 'sin_plan';
    throw err;
  }

  const { plan, daysUnlocked = 3, startDayIndex = 0 } = planSnap.data();
  const userData = userSnap.exists ? userSnap.data() : {};

  // Respeta el mismo gating de Premium que ya aplica dentro de la app: si el
  // día de hoy no está entre los días desbloqueados, no revelamos el detalle
  // del plan a través de este endpoint tampoco (ni en JSON ni en la imagen).
  const unlockedIndices = Array.from({ length: daysUnlocked }, (_, k) => (startDayIndex + k) % 7);
  if (!unlockedIndices.includes(todayIndex)) {
    return {
      fecha,
      diaSemana: DIAS_SEMANA[todayIndex],
      generatedAt: new Date().toISOString(),
      bloqueado: true,
      entrenamiento: null,
      dieta: null,
      notas: [],
      resumen: { totalItems: 0, completados: 0, porcentaje: 0 },
    };
  }

  const diaPlan = plan[todayIndex] || {};
  const progresoHoy = userData.dailyProgress?.[fecha] || {};
  const ejerciciosCompletados = progresoHoy.ejercicios || [];
  const comidasCompletadas = progresoHoy.comidas || [];

  const ejercicios = (diaPlan.entrenamiento?.ejercicios || []).map((ej, i) => {
    const key = `${todayIndex}-ej-${i}`;
    return {
      key,
      nombre: ej.nombre,
      series: ej.series,
      reps: ej.reps,
      completado: ejerciciosCompletados.includes(key),
    };
  });

  const comidas = (diaPlan.dieta?.comidas || []).map((c, i) => {
    const key = `${todayIndex}-comida-${i}`;
    return {
      key,
      momento: c.momento,
      descripcion: c.descripcion,
      completado: comidasCompletadas.includes(key),
    };
  });

  // Notas laborales/proyectos/rutina: colección todavía no existe (paso 5 del
  // roadmap). Se deja el campo ya presente en el contrato para que, cuando se
  // construya, no haya que cambiar el shape que ya consume el Shortcut.
  const notas = [];

  const totalItems = ejercicios.length + comidas.length + notas.length;
  const completados =
    ejercicios.filter((e) => e.completado).length +
    comidas.filter((c) => c.completado).length +
    notas.filter((n) => n.completado).length;

  return {
    fecha,
    diaSemana: DIAS_SEMANA[todayIndex],
    generatedAt: new Date().toISOString(),
    bloqueado: false,
    entrenamiento: { tipo: diaPlan.entrenamiento?.tipo || null, ejercicios },
    dieta: { comidas },
    notas,
    resumen: {
      totalItems,
      completados,
      porcentaje: totalItems ? Math.round((completados / totalItems) * 100) : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// GET /api/wallpaper/resumen-dia — requiere sesión normal (Firebase ID token).
// Pensado para depuración/uso dentro de la app misma, no para el Shortcut.
// ---------------------------------------------------------------------------
router.get('/wallpaper/resumen-dia', authMiddleware, async (req, res) => {
  try {
    const resumen = await getResumenDia(req.uid);
    res.json(resumen);
  } catch (e) {
    if (e.code === 'sin_plan') return res.status(404).json({ error: 'sin_plan', mensaje: e.message });
    console.error('resumen-dia error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/wallpaper/generar-link — requiere sesión normal (se llama desde
// dentro de la app). Genera (o regenera, invalidando el anterior) un token
// permanente y no-adivinable para acceder a la imagen del wallpaper sin
// necesitar el token de Firebase Auth, que expira cada hora y no sirve para
// una automatización de Shortcuts que corre sola.
// ---------------------------------------------------------------------------
router.post('/wallpaper/generar-link', authMiddleware, async (req, res) => {
  try {
    const token = crypto.randomBytes(24).toString('hex');
    await db.collection('users').doc(req.uid).update({ wallpaperToken: token });
    res.json({ token });
  } catch (e) {
    console.error('generar-link error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/wallpaper/imagen.png?token=... — SIN authMiddleware a propósito:
// el Shortcut de iOS (acción genérica "Obtener contenido de URL") no puede
// mandar el token de sesión de Firebase, así que esta ruta se protege con el
// token permanente generado arriba. Es "seguridad por no-adivinable" (como un
// link de calendario compartido) — quien tenga el link puede ver el estado
// del día, no puede modificar nada. Regenerar el link (arriba) revoca el
// anterior automáticamente, porque se sobreescribe.
// ---------------------------------------------------------------------------
router.get('/wallpaper/imagen.png', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(401).send('Falta token');

    const snap = await db.collection('users').where('wallpaperToken', '==', token).limit(1).get();
    if (snap.empty) return res.status(401).send('Token inválido o revocado');

    const uid = snap.docs[0].id;
    const resumen = await getResumenDia(uid);
    const png = await renderWallpaperPNG(resumen);

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-store'); // siempre la versión más reciente, nunca cacheada
    res.send(png);
  } catch (e) {
    if (e.code === 'sin_plan') return res.status(404).send('Sin plan generado todavía');
    console.error('imagen.png error:', e.message);
    res.status(500).send('Error generando la imagen');
  }
});

module.exports = router;
