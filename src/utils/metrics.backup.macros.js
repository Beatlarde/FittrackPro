export const calculate1RM = (weight, reps) => {
  if (!weight || !reps || reps === 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight / (1.0278 - 0.0278 * reps));
};

export const isPremium = (user) => user?.premium === true;

export const estimarMacrosComida = (descripcion, macrosDia, totalComidas) => {
  if (!macrosDia || !totalComidas) return null;
  const desc = descripcion.toLowerCase();
  let peso = 1;
  if (desc.includes('desayuno') || desc.includes('merienda') || desc.includes('snack')) peso = 0.7;
  if (desc.includes('almuerzo') || desc.includes('comida') || desc.includes('cena')) peso = 1.3;
  const base = 1 / totalComidas;
  return {
    proteina: Math.round((macrosDia.proteina * base * peso)),
    carbs: Math.round((macrosDia.carbs * base * peso)),
    grasas: Math.round((macrosDia.grasas * base * peso)),
  };
};

export const parsearRespuestaIA = (res) => {
  let clean = res.replace(/```json/gi, '').replace(/```/g, '').trim();
  const arrayMatch = clean.match(/\[[\s\S]*\]/);
  if (!arrayMatch) throw new Error('No se encontró array JSON en la respuesta');
  return JSON.parse(arrayMatch[0]);
};
