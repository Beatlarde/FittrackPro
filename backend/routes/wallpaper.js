const express = require('express');
const { db } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/wallpaper/resumen-dia
//
// Fuente única de verdad para el futuro Shortcut de wallpaper (y a futuro
// cualquier widget/live wallpaper). Combina:
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

router.get('/wallpaper/resumen-dia', authMiddleware, async (req, res) => {
  try {
    const uid = req.uid;
    const todayIndex = getTodayIndexMexico();
    const fecha = getFechaUTC();

    const [planSnap, userSnap] = await Promise.all([
      db.collection('plans').doc(uid).get(),
      db.collection('users').doc(uid).get(),
    ]);

    if (!planSnap.exists || !planSnap.data()?.plan) {
      return res.status(404).json({ error: 'sin_plan', mensaje: 'El usuario no ha generado un plan todavía.' });
    }

    const { plan, daysUnlocked = 3, startDayIndex = 0 } = planSnap.data();
    const userData = userSnap.exists ? userSnap.data() : {};

    // Respeta el mismo gating de Premium que ya aplica dentro de la app:
    // si el día de hoy no está entre los días desbloqueados, no revelamos
    // el detalle del plan a través de este endpoint tampoco.
    const unlockedIndices = Array.from({ length: daysUnlocked }, (_, k) => (startDayIndex + k) % 7);
    if (!unlockedIndices.includes(todayIndex)) {
      return res.json({
        fecha,
        diaSemana: DIAS_SEMANA[todayIndex],
        generatedAt: new Date().toISOString(),
        bloqueado: true,
        entrenamiento: null,
        dieta: null,
        notas: [],
        resumen: { totalItems: 0, completados: 0, porcentaje: 0 },
      });
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

    // Notas laborales/proyectos/rutina: colección todavía no existe (paso 5
    // del roadmap). Se deja el campo ya presente en el contrato para que,
    // cuando se construya, no haya que cambiar el shape que ya consume el
    // Shortcut — solo empezará a llegar con datos reales.
    const notas = [];

    const totalItems = ejercicios.length + comidas.length + notas.length;
    const completados =
      ejercicios.filter((e) => e.completado).length +
      comidas.filter((c) => c.completado).length +
      notas.filter((n) => n.completado).length;

    res.json({
      fecha,
      diaSemana: DIAS_SEMANA[todayIndex],
      generatedAt: new Date().toISOString(),
      bloqueado: false,
      entrenamiento: {
        tipo: diaPlan.entrenamiento?.tipo || null,
        ejercicios,
      },
      dieta: {
        comidas,
      },
      notas,
      resumen: {
        totalItems,
        completados,
        porcentaje: totalItems ? Math.round((completados / totalItems) * 100) : 0,
      },
    });
  } catch (e) {
    console.error('resumen-dia error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
