import { useState } from 'react';
import { Wrench } from 'lucide-react';
import { ACTIVE_GEMINI_MODEL } from '../../config/constants';

const GeminiDiagnosticTool = ({ onClose }) => {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(ACTIVE_GEMINI_MODEL);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const getAvailableModels = async () => {
    if (!apiKey) { setResult("Por favor, ingresa una API Key para probar."); return; }
    setLoading(true);
    setResult("Consultando a Google...");
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await res.json();
      if (data.models) {
        const models = data.models.map(m => m.name.replace('models/', '')).filter(n => n.includes('gemini'));
        setResult("✅ ÉXITO. Tu clave es válida.\nModelos permitidos:\n\n" + models.join('\n'));
      } else {
        setResult("❌ FALLO.\n\nRespuesta de Google:\n" + JSON.stringify(data, null, 2));
      }
    } catch (err) { setResult("Error Crítico de Red: " + err.message); }
    setLoading(false);
  };

  const testConnection = async () => {
    if (!apiKey) { setResult("Por favor, ingresa una API Key para probar."); return; }
    setLoading(true);
    setResult("Enviando mensaje de prueba a Gemini...");
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Responde únicamente con la palabra: Conectado" }] }] })
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
      if (res.ok) console.log('Modelo activo:', model);
    } catch (err) { setResult("Error Crítico de Red: " + err.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col p-4 font-mono animate-in fade-in overflow-y-auto">
      <div className="flex justify-between items-center mb-6 text-emerald-400 border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold flex items-center gap-2"><Wrench className="w-5 h-5"/> Diagnóstico Gemini</h2>
        <button onClick={onClose} className="bg-slate-800 p-2 rounded-lg text-white hover:bg-slate-700 active:scale-95 transition-all">Cerrar</button>
      </div>
      <div className="space-y-4 max-w-2xl w-full mx-auto">
        <div>
          <label className="text-xs text-slate-400">Pegar API Key de Prueba:</label>
          <input type="text" placeholder="AIzaSy..." value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-slate-800 text-green-400 p-3 rounded-lg border border-slate-700 outline-none mt-1" />
        </div>
        <div>
          <label className="text-xs text-slate-400">Modelo a probar:</label>
          <select value={model} onChange={e => setModel(e.target.value)} className="w-full bg-slate-800 text-green-400 p-3 rounded-lg border border-slate-700 outline-none mt-1">
            <option value="gemini-2.5-flash">gemini-2.5-flash (Recomendado)</option>
            <option value="gemini-2.0-flash">gemini-2.0-flash</option>
            <option value="gemini-1.5-flash">gemini-1.5-flash</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={getAvailableModels} disabled={loading} className="flex-1 bg-blue-600 text-white font-bold p-3 rounded-xl active:scale-95 disabled:opacity-50">1. Verificar Clave</button>
          <button onClick={testConnection} disabled={loading} className="flex-1 bg-emerald-600 text-slate-900 font-bold p-3 rounded-xl active:scale-95 disabled:opacity-50">2. Probar Mensaje</button>
        </div>
        <div>
          <label className="text-xs text-slate-400">Respuesta Cruda:</label>
          <textarea readOnly value={result} className="w-full h-64 bg-black text-emerald-400 p-4 rounded-xl border border-slate-700 font-mono text-xs outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent mt-1" />
        </div>
      </div>
    </div>
  );
};

export default GeminiDiagnosticTool;
