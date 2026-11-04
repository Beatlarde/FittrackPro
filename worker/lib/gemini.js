// Llamada a Gemini con un reintento si el modelo responde 503 (saturado).
export async function callGemini(env, { model = 'gemini-2.5-flash', parts, retryModel = model, retryDelayMs = 2000 }) {
  const run = (m) => fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${env.GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) }
  );
  let response = await run(model);
  if (response.status === 503) {
    await new Promise((r) => setTimeout(r, retryDelayMs));
    response = await run(retryModel);
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `Gemini ${response.status}`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Convierte un ArrayBuffer a base64 sin Buffer de Node
export function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}
