import { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../config/constants';
import { getAuthToken } from '../../services/api';

const ReferidoWidget = ({ coachUid }) => {
  const [coachLink, setCoachLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generarLink = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${BACKEND_URL}/coach/generar-codigo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data.url) setCoachLink(data.url);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (coachUid) generarLink(); }, [coachUid]);

  const copiar = () => {
    navigator.clipboard.writeText(coachLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const compartir = () => {
    if (navigator.share) {
      navigator.share({ title: 'Únete a mi programa de fitness', text: 'Regístrate con mi link personalizado', url: coachLink });
    } else copiar();
  };

  if (!coachLink) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-4 mb-4 text-white">
      <p className="font-black text-sm mb-1">🔗 Tu link de referido</p>
      <p className="text-emerald-100 text-xs mb-3">Comparte este link — tus clientes quedarán vinculados a ti automáticamente</p>
      <div className="bg-white/20 rounded-2xl px-3 py-2 mb-3">
        <p className="text-xs font-bold truncate">{coachLink}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={copiar} className="flex-1 bg-white text-emerald-700 font-black text-xs py-2.5 rounded-2xl active:scale-95 transition-all">
          {copied ? '✅ Copiado' : '📋 Copiar link'}
        </button>
        <button onClick={compartir} className="flex-1 bg-emerald-700 text-white font-black text-xs py-2.5 rounded-2xl active:scale-95 transition-all">
          📤 Compartir
        </button>
      </div>
    </div>
  );
};

export default ReferidoWidget;
