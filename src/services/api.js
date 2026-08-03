import { auth } from '../firebase';
import { BACKEND_URL, ACTIVE_GEMINI_MODEL } from '../config/constants';
import { track } from '../utils/analytics';

export const getAuthToken = async () => {
  try {
    let user = auth.currentUser;
    if (!user) {
      await new Promise(resolve => {
        const unsub = auth.onAuthStateChanged(u => {
          unsub();
          resolve(u);
        });
        setTimeout(() => resolve(null), 3000);
      });
      user = auth.currentUser;
    }
    if (!user) return null;
    return await user.getIdToken(true);
  } catch { return null; }
};

export const sendEmailNotification = async ({ clientName, clientEmail, coachName }) => {
  try {
    const token = await getAuthToken();
    const res = await fetch(`${BACKEND_URL}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        to: clientEmail,
        subject: `Tu coach ${coachName} tiene algo para ti`,
        html: `<p>Hola ${clientName}, tu coach <b>${coachName}</b> te ha enviado un mensaje en FitTrack Pro.</p>
               <a href="https://fittrackpro.store" style="background:#10b981;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin-top:16px;">Ver mensaje →</a>`
      })
    });
    return res.ok;
  } catch (e) {
    console.error('Email error:', e);
    return false;
  }
};

export const callGemini = async (prompt, systemInstruction = "") => {
  try {
    const token = await getAuthToken();
    const res = await fetch(`${BACKEND_URL}/gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ prompt, systemInstruction, model: ACTIVE_GEMINI_MODEL })
    });
    const data = await res.json();
    if (!res.ok) return `⚠️ Error de IA: ${data.error || res.statusText}`;
    return data.text || "⚠️ La IA no generó respuesta.";
  } catch (error) {
    return `⚠️ Error de conexión con IA: ${error.message}`;
  }
};

export const callAgenteNutricion = async (prompt, contextoUsuario = {}, uid = null) => {
  try {
    track('ia_nutricion_request', { objetivo: contextoUsuario.objetivo });
    const token = await getAuthToken();
    const res = await fetch(`${BACKEND_URL}/agente-nutricion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ prompt, contextoUsuario, uid })
    });
    const data = await res.json();
    if (!res.ok) return `⚠️ Error de IA: ${data.error || res.statusText}`;
    return data.text || "⚠️ Sin respuesta.";
  } catch (e) { return `⚠️ Error: ${e.message}`; }
};

export const callAgenteEntrenamiento = async (prompt, contextoUsuario = {}, uid = null) => {
  try {
    track('ia_entrenamiento_request', { objetivo: contextoUsuario.objetivo });
    const token = await getAuthToken();
    const res = await fetch(`${BACKEND_URL}/agente-entrenamiento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ prompt, contextoUsuario, uid })
    });
    const data = await res.json();
    if (!res.ok) return `⚠️ Error de IA: ${data.error || res.statusText}`;
    return data.text || "⚠️ Sin respuesta.";
  } catch (e) { return `⚠️ Error: ${e.message}`; }
};

export const callGeminiWithImages = async (prompt, imageUrls = []) => {
  try {
    const res = await fetch(`${BACKEND_URL}/gemini-images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, imageUrls })
    });
    const data = await res.json();
    if (!res.ok) return `⚠️ Error: ${data.error}`;
    return data.text || "⚠️ Sin respuesta.";
  } catch (e) {
    return `⚠️ Error: ${e.message}`;
  }
};
