import { useState } from 'react';
import { MessageSquare, Send, Sparkles, Loader2 } from 'lucide-react';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { callGemini } from '../../services/api';
import { useToast } from '../../hooks/useToast';

const CoachMessageWidget = ({ client, coachName }) => {
  const [generando, setGenerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const showToast = useToast();

  const generarMensaje = async () => {
    setGenerando(true);
    setShowEditor(false);
    try {
      const prompt = `Eres un coach de fitness. Genera un mensaje motivacional corto y personalizado para tu cliente basándote en su perfil.

Cliente: ${client.name}
Objetivo: ${client.goals?.objective}
Nivel actividad: ${client.goals?.activity}
Estado del plan: ${client.currentPlan?.startsWith('⏳') ? 'Plan pendiente de entrega' : 'Plan activo'}
Notas del cliente: ${client.coachNotes || 'Sin notas'}

El mensaje debe ser:
- Máximo 3 oraciones
- Personal y motivador, usando su nombre
- Relevante a su objetivo
- Tono cercano pero profesional
- Sin emojis excesivos, máximo 1-2
Solo escribe el mensaje, sin introducción ni explicación.`;

      const res = await callGemini(prompt);
      setMensaje(res.trim());
      setShowEditor(true);
    } catch (e) {
      showToast('Error al generar mensaje');
    }
    setGenerando(false);
  };

  const enviarMensaje = async () => {
    if (!mensaje.trim()) return;
    setEnviando(true);
    try {
      await addDoc(collection(db, 'messages'), {
        userId: client.id,
        coachName,
        text: mensaje.trim(),
        createdAt: serverTimestamp(),
        read: false,
        timestamp: Date.now()
      });
      showToast(`✅ Mensaje enviado a ${client.name}`);
      setMensaje('');
      setShowEditor(false);
    } catch (e) {
      showToast('No se pudo enviar el mensaje. Intenta de nuevo.', 'error');
    }
    setEnviando(false);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-purple-100 p-2 rounded-xl"><MessageSquare className="w-4 h-4 text-purple-600"/></div>
          <p className="font-black text-slate-800 text-sm">Mensaje al cliente</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setMensaje(''); setShowEditor(true); }}
            className="flex items-center gap-1.5 text-xs font-black text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl hover:bg-slate-200 transition-all active:scale-95">
            ✏️ Manual
          </button>
          <button onClick={generarMensaje} disabled={generando}
            className="flex items-center gap-1.5 text-xs font-black text-purple-600 bg-purple-50 px-3 py-1.5 rounded-xl hover:bg-purple-100 transition-all disabled:opacity-50 active:scale-95">
            {generando ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
            {generando ? 'Un momento...' : 'Generar con IA'}
          </button>
        </div>
      </div>

      {showEditor && (
        <div className="p-5 space-y-3 animate-in fade-in slide-in-from-top-2">
          <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Edita antes de enviar</p>
          <textarea
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            rows={4}
            className="w-full bg-slate-50 border border-slate-200 focus:border-purple-400 rounded-2xl px-4 py-3 text-sm font-medium outline-none resize-none transition-colors"
          />
          <div className="flex gap-2">
            <button onClick={() => { setShowEditor(false); setMensaje(''); }}
              className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-bold text-sm active:scale-95">
              Cancelar
            </button>
            <button onClick={enviarMensaje} disabled={enviando || !mensaje.trim()}
              className="flex-1 py-3 bg-purple-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">
              {enviando ? <Loader2 className="w-4 h-4 animate-spin"/> : <><Send className="w-3.5 h-3.5"/> Enviar</>}
            </button>
          </div>
        </div>
      )}

      {!showEditor && !generando && (
        <div className="p-5">
          <p className="text-slate-400 text-xs font-medium text-center">Genera un mensaje personalizado con IA para motivar a tu cliente</p>
        </div>
      )}
    </div>
  );
};

export default CoachMessageWidget;
