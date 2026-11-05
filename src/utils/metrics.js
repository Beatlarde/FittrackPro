export const calculate1RM = (weight, reps) => {
  if (!weight || !reps || reps === 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight / (1.0278 - 0.0278 * reps));
};

export const isPremium = (user) => user?.premium === true;

// Macros de UNA comida del plan.
// 1) Si la IA ya los dio por comida (planes nuevos), se usan tal cual (real: true).
// 2) Si no (planes viejos), se reparten los macros del día según el MOMENTO de cada comida
//    (antes se dividía igual entre todas y salían idénticas — bug reportado 2026-11-04).
const PESOS_MOMENTO = [
  [/desayuno/, 0.25],
  [/media ma|colaci|snack|merienda|refrigerio|entre ?comida|pre.?entren|post.?entren/, 0.08],
  [/comida|almuerzo/, 0.35],
  [/cena/, 0.25],
];
const pesoMomento = (momento = '') => {
  const t = String(momento).toLowerCase();
  for (const [re, p] of PESOS_MOMENTO) if (re.test(t)) return p;
  return 0.2;
};
const num = (v) => (typeof v === 'number' && isFinite(v)) ? v
  : (typeof v === 'string' && v.trim() !== '' && isFinite(+v)) ? +v : null;

export const macrosDeComida = (comida, dieta) => {
  if (!comida || !dieta) return null;
  const p = num(comida.proteina), c = num(comida.carbs), g = num(comida.grasas);
  if (p !== null && c !== null && g !== null) {
    return { proteina: Math.round(p), carbs: Math.round(c), grasas: Math.round(g),
      kcal: Math.round(num(comida.kcal) ?? (p * 4 + c * 4 + g * 9)), real: true };
  }
  const comidas = dieta.comidas || [];
  if (!comidas.length || !dieta.proteina) return null;
  const total = comidas.reduce((s, x) => s + pesoMomento(x.momento), 0) || 1;
  const f = pesoMomento(comida.momento) / total;
  return { proteina: Math.round(dieta.proteina * f), carbs: Math.round(dieta.carbs * f),
    grasas: Math.round(dieta.grasas * f), kcal: Math.round((dieta.kcal || 0) * f), real: false };
};

export const parsearRespuestaIA = (res) => {
  let clean = res.replace(/```json/gi, '').replace(/```/g, '').trim();
  const arrayMatch = clean.match(/\[[\s\S]*\]/);
  if (!arrayMatch) throw new Error('No se encontró array JSON en la respuesta');
  return JSON.parse(arrayMatch[0]);
};
