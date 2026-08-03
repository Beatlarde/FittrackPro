import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BACKEND_URL } from '../../config/constants';

const SolicitudCoachForm = ({ onClose }) => {
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', especialidad: '', experiencia: '' });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const enviar = async () => {
    if (!form.nombre || !form.email) return;
    setEnviando(true);
    try {
      const res = await fetch(`${BACKEND_URL}/solicitud-coach`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.ok) setEnviado(true);
    } catch(e) {}
    setEnviando(false);
  };

  if (enviado) return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full">
        <span className="text-5xl">✅</span>
        <h3 className="font-black text-xl mt-4">¡Solicitud enviada!</h3>
        <p className="text-slate-400 text-sm mt-2">Te contactaremos en menos de 24 horas.</p>
        <button onClick={onClose} className="w-full mt-6 bg-emerald-500 text-white font-black py-3 rounded-2xl active:scale-95">Entendido</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-end justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-black text-xl">Quiero ser Coach</h2>
          <button onClick={onClose} className="text-slate-400 text-2xl font-bold">✕</button>
        </div>
        <div className="space-y-3">
          <input placeholder="Nombre completo *" value={form.nombre} onChange={e => setForm(p => ({...p, nombre: e.target.value}))}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-emerald-400"/>
          <input type="email" placeholder="Email *" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-emerald-400"/>
          <input placeholder="Teléfono (opcional)" value={form.telefono} onChange={e => setForm(p => ({...p, telefono: e.target.value}))}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-emerald-400"/>
          <input placeholder="Especialidad (ej: Hipertrofia, Pérdida de peso)" value={form.especialidad} onChange={e => setForm(p => ({...p, especialidad: e.target.value}))}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-emerald-400"/>
          <textarea placeholder="Experiencia y certificaciones" rows={3} value={form.experiencia} onChange={e => setForm(p => ({...p, experiencia: e.target.value}))}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-emerald-400 resize-none"/>
          <button onClick={enviar} disabled={enviando}
            className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
            {enviando ? <><Loader2 className="w-4 h-4 animate-spin"/> Enviando...</> : 'Enviar solicitud →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SolicitudCoachForm;
