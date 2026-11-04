// Fechas en hora de Ciudad de México (UTC-6, sin horario de verano).
// El Worker corre en UTC; restar 6 h y usar toDateString() da la misma cadena
// que genera el navegador del usuario en México ("Wed Nov 04 2026").
const OFFSET_MS = 6 * 3600 * 1000;

export const ahoraCDMX = () => new Date(Date.now() - OFFSET_MS);
export const hoyCDMX = () => ahoraCDMX().toDateString();
export const isoHoyCDMX = () => ahoraCDMX().toISOString().split('T')[0];

// Últimos n días (hoy primero) como toDateString()
export const ultimosDias = (n) => Array.from({ length: n }, (_, i) => {
  const d = ahoraCDMX(); d.setUTCDate(d.getUTCDate() - i); return d.toDateString();
});

export const fmtMX = (date, opts) =>
  date.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', ...opts });
