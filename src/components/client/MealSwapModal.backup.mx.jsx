import { useState, useEffect } from 'react';
import { Sparkles, Brain, Check } from 'lucide-react';
import { SYSTEM_PROMPTS } from '../../config/constants';
import { callGemini } from '../../services/api';

const MealSwapModal = ({ onClose, currentPlan }) => {
  const [loading, setLoading] = useState(true);
  const [swaps, setSwaps] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSwaps = async () => {
      setLoading(true);
      setError('');
      const prompt = `Basándote en este plan de dieta: "${currentPlan || 'Plan de nutrición general balanceado'}"
Sugiere exactamente 3 alimentos alternativos del mercado latinoamericano.
Devuelve ESTRICTAMENTE este JSON y nada más:
[{"name":"nombre y cantidad","match":numero,"pro":numero,"cho":numero,"fat":numero,"tag":"etiqueta"},{"name":"nombre y cantidad","match":numero,"pro":numero,"cho":numero,"fat":numero,"tag":"etiqueta"},{"name":"nombre y cantidad","match":numero,"pro":numero,"cho":numero,"fat":numero,"tag":"etiqueta"}]`;
      const response = await callGemini(prompt, SYSTEM_PROMPTS.MEAL_SWAPPER);
      try {
        const clean = response.replace(/```json/g, '').replace(/```/g, '').trim();
        setSwaps(JSON.parse(clean));
      } catch (e) {
        setError('La IA no pudo generar alternativas. Intenta de nuevo.');
      }
      setLoading(false);
    };
    fetchSwaps();
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col items-center justify-end md:justify-center animate-in slide-in-from-bottom-full md:fade-in">
      <div className="bg-slate-50 w-full max-w-md md:rounded-3xl rounded-t-3xl h-[85vh] md:h-auto overflow-y-auto flex flex-col shadow-2xl">
        <div className="p-6 bg-white border-b sticky top-0 z-10 flex justify-between items-center rounded-t-3xl">
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Sparkles className="text-emerald-500"/> Intercambios IA</h1>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full active:scale-95"><Check className="w-5 h-5"/></button>
        </div>
        <div className="p-4 space-y-4 flex-1">
          {loading ? (
            <div className="py-20 flex flex-col items-center text-emerald-500">
              <Brain className="w-12 h-12 mb-4 animate-bounce"/>
              <p className="font-bold text-slate-600 animate-pulse">Buscando alternativas en Gemini...</p>
            </div>
          ) : error ? (
            <div className="py-20 flex flex-col items-center text-center px-6">
              <p className="text-red-400 font-bold mb-4">{error}</p>
              <button onClick={onClose} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold active:scale-95">Cerrar</button>
            </div>
          ) : swaps.map((item, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative">
              <span className="absolute top-4 right-4 text-xs font-black text-emerald-500">{item.match}% Match</span>
              <span className="text-xs font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase">{item.tag}</span>
              <h3 className="font-bold text-slate-800 text-lg my-3">{item.name}</h3>
              <div className="space-y-3 mb-6">
                {['pro', 'cho', 'fat'].map(macro => (
                  <div key={macro} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-8 uppercase">{macro}</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400" style={{ width: `${item[macro]}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={onClose} className="w-full py-3 bg-slate-50 hover:bg-emerald-500 hover:text-white border border-slate-200 rounded-xl font-black text-slate-700 transition-colors active:scale-95">Intercambiar</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MealSwapModal;
