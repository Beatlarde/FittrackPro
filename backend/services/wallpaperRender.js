const sharp = require('sharp');

// Genera el wallpaper del día como PNG (1170×2532, proporción de iPhone) a partir
// del mismo objeto "resumen" que ya arma routes/wallpaper.js para el endpoint JSON.
// Todo el dibujo se hace construyendo un SVG a mano (sin dependencias nativas de
// canvas) y convirtiéndolo a PNG con sharp al final — es la parte más pesada pero
// sharp trae binarios precompilados, así que no debería dar problemas al instalar.

const WIDTH = 1170;
const HEIGHT = 2532;
const BG = '#0f172a';
const EMERALD = '#10b981';
const SLATE_400 = '#94a3b8';
const SLATE_600 = '#475569';
const WHITE = '#f1f5f9';

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function renderChecklistRow(y, done, label, sublabel) {
  const circleColor = done ? EMERALD : SLATE_600;
  const textColor = done ? SLATE_400 : WHITE;
  const check = done
    ? `<path d="M${60 - 10} ${y} l8 8 l14 -16" stroke="#0f172a" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';
  return `
    <circle cx="60" cy="${y}" r="22" fill="${done ? EMERALD : 'none'}" stroke="${circleColor}" stroke-width="4"/>
    ${check}
    <text x="105" y="${y + 10}" font-size="34" font-weight="700" fill="${textColor}" font-family="-apple-system,Helvetica,sans-serif" text-decoration="${done ? 'line-through' : 'none'}">${esc(label)}</text>
    ${sublabel ? `<text x="105" y="${y + 42}" font-size="24" fill="${SLATE_400}" font-family="-apple-system,Helvetica,sans-serif">${esc(sublabel)}</text>` : ''}
  `;
}

// Réplica exacta de la fórmula de src/components/shared/Ring.jsx (mismo
// componente que usa la pantalla "Hoy" de la app), para que el wallpaper se
// sienta parte de la misma marca en vez de un diseño aparte.
function renderRing(cx, cy, size, stroke, percent, color, label) {
  const r = size / 2 - stroke / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - circ * Math.min(percent, 1);
  return `
    <g transform="rotate(-90 ${cx} ${cy})">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="${stroke}"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
    </g>
    <text x="${cx}" y="${cy + 10}" font-size="34" font-weight="900" fill="${WHITE}" text-anchor="middle" font-family="-apple-system,Helvetica,sans-serif">${Math.round(percent * 100)}%</text>
    <text x="${cx}" y="${cy + size / 2 + 40}" font-size="24" font-weight="700" fill="${SLATE_400}" text-anchor="middle" font-family="-apple-system,Helvetica,sans-serif">${esc(label)}</text>
  `;
}

function buildWallpaperSVG(resumen) {
  const ejercicios = resumen.entrenamiento?.ejercicios || [];
  const comidas = resumen.dieta?.comidas || [];
  const { completados = 0, totalItems = 0, porcentaje = 0 } = resumen.resumen || {};

  const pEntreno = ejercicios.length ? ejercicios.filter((e) => e.completado).length / ejercicios.length : 0;
  const pDieta = comidas.length ? comidas.filter((c) => c.completado).length / comidas.length : 0;

  const ringSize = 220;
  const ringStroke = 20;
  const rings = `
    ${ejercicios.length ? renderRing(300, 480, ringSize, ringStroke, pEntreno, EMERALD, 'ENTRENO') : ''}
    ${comidas.length ? renderRing(WIDTH - 300, 480, ringSize, ringStroke, pDieta, '#f97316', 'DIETA') : ''}
  `;

  let y = 720;
  const rowGap = ejercicios.length > 0 || comidas.length > 0 ? 92 : 0;
  let rows = '';

  if (ejercicios.length > 0) {
    rows += `<text x="60" y="${y}" font-size="30" font-weight="900" fill="${EMERALD}" letter-spacing="2" font-family="-apple-system,Helvetica,sans-serif">ENTRENAMIENTO</text>`;
    y += 70;
    for (const ej of ejercicios) {
      rows += renderChecklistRow(y, ej.completado, ej.nombre, `${ej.series}×${ej.reps}`);
      y += rowGap;
    }
    y += 40;
  }

  if (comidas.length > 0) {
    rows += `<text x="60" y="${y}" font-size="30" font-weight="900" fill="#f97316" letter-spacing="2" font-family="-apple-system,Helvetica,sans-serif">DIETA</text>`;
    y += 70;
    for (const c of comidas) {
      rows += renderChecklistRow(y, c.completado, c.momento, null);
      y += rowGap;
    }
  }

  const sinPlan = ejercicios.length === 0 && comidas.length === 0;

  return `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>

  <!-- Encabezado -->
  <text x="60" y="220" font-size="64" font-weight="900" fill="${WHITE}" font-family="-apple-system,Helvetica,sans-serif">${esc(resumen.diaSemana || '')}</text>
  <text x="60" y="270" font-size="30" fill="${SLATE_400}" font-family="-apple-system,Helvetica,sans-serif">${esc(resumen.fecha || '')}</text>

  <!-- Anillos de progreso (mismo estilo que Ring.jsx en la pantalla "Hoy") -->
  ${resumen.bloqueado || sinPlan ? '' : rings}
  <text x="${WIDTH / 2}" y="650" font-size="26" font-weight="700" fill="${SLATE_400}" text-anchor="middle" font-family="-apple-system,Helvetica,sans-serif">${completados}/${totalItems} completados hoy</text>

  ${resumen.bloqueado
    ? `<text x="60" y="460" font-size="30" fill="${SLATE_400}" font-family="-apple-system,Helvetica,sans-serif">🔒 Día bloqueado — activa Premium para verlo aquí</text>`
    : sinPlan
      ? `<text x="60" y="460" font-size="30" fill="${SLATE_400}" font-family="-apple-system,Helvetica,sans-serif">😴 Día de descanso</text>`
      : rows}

  <text x="60" y="${HEIGHT - 50}" font-size="22" fill="${SLATE_600}" font-family="-apple-system,Helvetica,sans-serif">FitTrack Pro · actualizado</text>
</svg>`;
}

async function renderWallpaperPNG(resumen) {
  const svg = buildWallpaperSVG(resumen);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { buildWallpaperSVG, renderWallpaperPNG };
