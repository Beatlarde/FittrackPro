// Export del plan de FitTrack a un archivo .ics (formato iCalendar estándar).
// A diferencia de Google Calendar (googleCalendar.js), esto no necesita OAuth ni
// llamadas a ninguna API: genera el archivo en el navegador y dispara su descarga.
// iOS/Safari, al abrir un .ics, ofrece directo "Agregar todos" al Calendario nativo.
//
// Reutiliza la misma convención de fechas/horarios que syncGoogleCalendar en
// ClientDashboard.jsx, para que el evento se vea igual sin importar qué calendario
// use el usuario.

// Escapa texto según RFC 5545 (comas, punto y coma, backslash, saltos de línea)
const escapeICS = (text = '') =>
  String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');

// Convierte fecha + hora local de Ciudad de México (UTC-6, sin horario de verano
// desde 2022) a formato UTC de iCalendar: YYYYMMDDTHHMMSSZ
const toICSUTC = (dateStr, hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const local = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-06:00`);
  return local.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

const buildEvent = ({ uid, dateStr, startHHMM, endHHMM, summary, description }) => [
  'BEGIN:VEVENT',
  `UID:${uid}@fittrackpro.store`,
  `DTSTAMP:${toICSUTC(dateStr, startHHMM)}`,
  `DTSTART:${toICSUTC(dateStr, startHHMM)}`,
  `DTEND:${toICSUTC(dateStr, endHHMM)}`,
  `SUMMARY:${escapeICS(summary)}`,
  `DESCRIPTION:${escapeICS(description)}`,
  'END:VEVENT',
].join('\r\n');

/**
 * Genera el contenido .ics para el plan completo (misma semana que syncGoogleCalendar).
 * @param {Array} planData - el arreglo de días del plan (planData de ClientDashboard).
 * @param {Object} user - el usuario actual (para mealTimes personalizados).
 * @returns {string} contenido completo del archivo .ics
 */
export const buildPlanICS = (planData, user) => {
  const events = [];
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7;

  for (let i = 0; i < planData.length; i++) {
    const dia = planData[i];
    const daysFromToday = (i - dayOfWeek + 7) % 7;
    const date = new Date(today);
    date.setDate(today.getDate() + daysFromToday);
    const dateStr = date.toISOString().split('T')[0];

    if (dia.entrenamiento?.ejercicios?.length > 0) {
      const ejercicios = dia.entrenamiento.ejercicios.map(e => `• ${e.nombre} ${e.series}×${e.reps}`).join('\n');
      events.push(buildEvent({
        uid: `entreno-${dateStr}`,
        dateStr,
        startHHMM: '07:00',
        endHHMM: '08:00',
        summary: `🏋️ Entrenamiento FitTrack — ${dia.dia}`,
        description: `Plan de entrenamiento:\n${ejercicios}`,
      }));
    }

    if (dia.dieta?.comidas?.length > 0) {
      const mt = user.mealTimes || {};
      const horarios = {
        'Desayuno': mt.desayuno || '08:00',
        'Almuerzo': mt.comida || '14:00',
        'Comida': mt.comida || '14:00',
        'Merienda': mt.merienda || '17:00',
        'Cena': mt.cena || '20:00',
        'Post-entrenamiento/Media tarde': mt.merienda || '17:00',
      };
      for (const [idx, comida] of dia.dieta.comidas.entries()) {
        const hora = horarios[comida.momento] || '12:00';
        const [h] = hora.split(':');
        const horaFin = `${String(parseInt(h) + 1).padStart(2, '0')}:00`;
        events.push(buildEvent({
          uid: `comida-${dateStr}-${idx}`,
          dateStr,
          startHHMM: hora,
          endHHMM: horaFin,
          summary: `🥗 ${comida.momento} FitTrack`,
          description: comida.descripcion,
        }));
      }
    }
  }

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FitTrack Pro//Plan Semanal//ES',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
};

/**
 * Genera el .ics del plan y dispara su descarga en el navegador.
 * En iOS, Safari abre el archivo descargado y ofrece "Agregar todos" al
 * Calendario nativo — no requiere una app nativa ni permisos especiales.
 */
export const downloadPlanICS = (planData, user) => {
  const contenido = buildPlanICS(planData, user);
  const blob = new Blob([contenido], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fittrack-plan.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
