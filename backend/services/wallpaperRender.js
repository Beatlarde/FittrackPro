const sharp = require('sharp');

// Genera el wallpaper del día como PNG (1170×2532, proporción de iPhone) a partir
// del mismo objeto "resumen" que ya arma routes/wallpaper.js para el endpoint JSON.
// Todo el dibujo se hace construyendo un SVG a mano (sin dependencias nativas de
// canvas) y convirtiéndolo a PNG con sharp al final — es la parte más pesada pero
// sharp trae binarios precompilados, así que no debería dar problemas al instalar.

const WIDTH = 1170;
const HEIGHT = 2532;
const BG = '#0b0f10';
const TRACK = '#191c1e';
const CYAN = '#22d3ee';
const ORANGE = '#fb923c';
const SLATE_400 = '#94a3b8';
const SLATE_600 = '#475569';

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Filtro de "glow" (neón) reutilizable — difumina una copia del trazo y la
// combina con el original encima, igual que el drop-shadow del mockup.
const GLOW_DEFS = `
  <defs>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
`;

// Anillo doble con glow, calcado del mockup que compartió el usuario: dos
// pistas concéntricas de fondo + dos arcos activos (mismo % en ambas, para
// que se vea grueso e "iluminado") en vez de un solo trazo delgado.
function renderRing(cx, cy, outerR, stroke, percent, color, label) {
  const gap = 12;
  const innerR = outerR - stroke - gap;
  const p = Math.min(Math.max(percent, 0), 1);

  const circOuter = 2 * Math.PI * outerR;
  const circInner = 2 * Math.PI * innerR;
  const offsetOuter = circOuter - circOuter * p;
  const offsetInner = circInner - circInner * p;

  return `
    <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="none" stroke="${TRACK}" stroke-width="${stroke}"/>
    <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="none" stroke="${TRACK}" stroke-width="${stroke}"/>
    <g transform="rotate(-90 ${cx} ${cy})">
      <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-dasharray="${circOuter}" stroke-dashoffset="${offsetOuter}" stroke-linecap="round" filter="url(#glow)"/>
      <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-dasharray="${circInner}" stroke-dashoffset="${offsetInner}" stroke-linecap="round" filter="url(#glow)"/>
    </g>
    <text x="${cx}" y="${cy + 14}" font-size="38" font-weight="800" fill="${color}" text-anchor="middle" font-family="-apple-system,Helvetica,sans-serif">${Math.round(p * 100)}%</text>
    <text x="${cx}" y="${cy + outerR + 46}" font-size="24" font-weight="700" fill="${SLATE_400}" text-anchor="middle" letter-spacing="2" font-family="-apple-system,Helvetica,sans-serif">${esc(label)}</text>
  `;
}

function buildWallpaperSVG(resumen) {
  const ejercicios = resumen.entrenamiento?.ejercicios || [];
  const comidas = resumen.dieta?.comidas || [];
  const { completados = 0, totalItems = 0 } = resumen.resumen || {};

  const pEntreno = ejercicios.length ? ejercicios.filter((e) => e.completado).length / ejercicios.length : 0;
  const pDieta = comidas.length ? comidas.filter((c) => c.completado).length / comidas.length : 0;
  const sinPlan = ejercicios.length === 0 && comidas.length === 0;

  // --- Diseño minimalista ---------------------------------------------------
  // Solo los dos anillos de progreso + el resumen, pegados justo debajo del
  // reloj del sistema. Sin lista de ejercicios/comidas: el detalle vive en
  // la app — el wallpaper es nada más un vistazo rápido a simple vista.
  //
  // SAFE_TOP: la hora + fecha del sistema (y notificaciones, si las hay)
  // ocupan normalmente los primeros ~600px de la pantalla bloqueada.
  const SAFE_TOP = 650;

  const RING_CY = SAFE_TOP + 175;
  const ringOuterR = 95;
  const ringStroke = 14;
  const rings = `
    ${ejercicios.length ? renderRing(300, RING_CY, ringOuterR, ringStroke, pEntreno, CYAN, 'ENTRENO') : ''}
    ${comidas.length ? renderRing(WIDTH - 300, RING_CY, ringOuterR, ringStroke, pDieta, ORANGE, 'DIETA') : ''}
  `;
  const resumenTextY = RING_CY + ringOuterR + 80;
  const footerY = resumenTextY + 260;

  return `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  ${GLOW_DEFS}
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>

  <!-- Sin encabezado propio de día/fecha: iOS ya lo muestra con su reloj del
       sistema en la pantalla bloqueada. -->

  <!-- Anillos de progreso con glow (estilo de referencia del usuario) -->
  ${resumen.bloqueado || sinPlan ? '' : rings}
  ${resumen.bloqueado || sinPlan ? '' : `<text x="${WIDTH / 2}" y="${resumenTextY}" font-size="26" font-weight="700" fill="${SLATE_400}" text-anchor="middle" font-family="-apple-system,Helvetica,sans-serif">${completados}/${totalItems} completados hoy</text>`}

  ${resumen.bloqueado
    ? `<text x="60" y="${RING_CY}" font-size="30" fill="${SLATE_400}" font-family="-apple-system,Helvetica,sans-serif">🔒 Día bloqueado — activa Premium para verlo aquí</text>`
    : sinPlan
      ? `<text x="60" y="${RING_CY}" font-size="30" fill="${SLATE_400}" font-family="-apple-system,Helvetica,sans-serif">😴 Día de descanso</text>`
      : ''}

  <text x="60" y="${footerY}" font-size="22" fill="${SLATE_600}" font-family="-apple-system,Helvetica,sans-serif">FitTrack Pro · actualizado</text>
</svg>`;
}

async function renderWallpaperPNG(resumen) {
  const svg = buildWallpaperSVG(resumen);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { buildWallpaperSVG, renderWallpaperPNG };
