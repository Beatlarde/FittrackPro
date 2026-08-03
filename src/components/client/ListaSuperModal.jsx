import { useState, useEffect } from 'react';
import { MessageSquare, ShoppingCart, Loader2, FileText, Check } from 'lucide-react';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { BACKEND_URL } from '../../config/constants';
import { callGemini } from '../../services/api';
import { useToast } from '../../hooks/useToast';

const ListaSuperModal = ({ plan, uid, savedLista, onClose, userEmail, userName }) => {
  const [lista, setLista] = useState(savedLista || null);
  const [loading, setLoading] = useState(false);
  const [checkedItems, setCheckedItems] = useState({});
  const [diasSeleccionados, setDiasSeleccionados] = useState(7);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const showToast = useToast();

  const generarLista = async (force = false) => {
    if (lista && !force) return;
    if (!plan) return;
    setLoading(true);
    try {
      let planArray = [];
      try {
        planArray = typeof plan === 'string'
          ? JSON.parse(plan.replace(/```json/g, '').replace(/```/g, '').trim())
          : plan;
      } catch { }

      const diasPlan = Array.isArray(planArray) ? planArray.slice(0, diasSeleccionados) : [];
      const planText = diasPlan.map(d =>
        `${d.dia}: ${d.dieta?.comidas?.map(c => c.descripcion).join(', ')}`
      ).join('\n') || JSON.stringify(plan);

      const prompt = `Basándote en este plan de comidas de ${diasSeleccionados} días, genera una lista del súper organizada por categorías con cantidades. Plan:\n${planText}\n\nResponde ÚNICAMENTE con JSON válido sin markdown:\n{"categorias":[{"nombre":"🥩 Proteínas","items":["Pechuga de pollo 1kg"]},{"nombre":"🥦 Verduras","items":["Brócoli 500g"]},{"nombre":"🍚 Carbohidratos","items":["Arroz integral 1kg"]},{"nombre":"🥛 Lácteos","items":["Yogur griego x4"]},{"nombre":"🫒 Grasas y otros","items":["Aceite de oliva 500ml"]}]}`;

      const res = await callGemini(prompt);
      const clean = res.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);
      setLista(parsed);
      await updateDoc(doc(db, 'users', uid), { listaSuper: parsed });
    } catch (e) {
      showToast('No pudimos generar la lista. Intenta de nuevo.', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { if (savedLista) generarLista(); }, []);

  const toggleItem = (catIdx, item) => {
    const key = `${catIdx}-${item}`;
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const totalItems = lista?.categorias?.reduce((sum, c) => sum + c.items.length, 0) || 0;
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;

  const listaTexto = lista?.categorias?.map(cat =>
    `${cat.nombre}\n${cat.items.map(i => `• ${i}`).join('\n')}`
  ).join('\n\n') || '';

  const compartirWhatsApp = () => {
    const texto = `🛒 *Mi Lista del Súper - FitTrack*\n\n${listaTexto}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const copiarAlPortapapeles = async () => {
    const texto = `🛒 Mi Lista del Súper\n\n${listaTexto}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const ta = document.createElement('textarea');
        ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
      showToast('✅ Lista copiada al portapapeles');
    } catch (e) { showToast('No se pudo copiar — usa WhatsApp'); }
  };

  const enviarEmail = async () => {
    if (!userEmail) return showToast('No hay email configurado');
    setEnviandoEmail(true);
    try {
      const htmlCategorias = lista.categorias.map(cat => `
        <div style="margin-bottom:16px;">
          <p style="color:#10b981;font-weight:900;margin-bottom:8px;">${cat.nombre}</p>
          <ul style="color:#e2e8f0;padding-left:20px;">
            ${cat.items.map(i => `<li style="margin-bottom:4px;">${i}</li>`).join('')}
          </ul>
        </div>`).join('');
      await fetch(`${BACKEND_URL}/send-email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: userEmail,
          subject: `🛒 Tu lista del súper — FitTrack Pro`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#fff;border-radius:16px;padding:32px;">
            <h2 style="color:#10b981;margin-bottom:4px;">🛒 Lista del Súper</h2>
            <p style="color:#94a3b8;margin-bottom:24px;">Para ${diasSeleccionados} días — generada por FitTrack Pro</p>
            ${htmlCategorias}
            <a href="${window.location.origin}" style="display:inline-block;margin-top:24px;background:#10b981;color:#000;font-weight:900;padding:12px 24px;border-radius:12px;text-decoration:none;">Abrir FitTrack Pro →</a>
          </div>`
        })
      });
      showToast(`✅ Lista enviada a ${userEmail}`);
    } catch (e) { showToast('Error al enviar email'); }
    setEnviandoEmail(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-[32px] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-black text-slate-800 text-lg flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-emerald-500"/> Lista del Súper</h2>
            {lista && <p className="text-slate-400 text-xs font-medium mt-0.5">{checkedCount}/{totalItems} productos</p>}
          </div>
          <div className="flex items-center gap-2">
            {lista && (
              <button onClick={() => generarLista(true)} className="text-xs font-black text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl hover:bg-slate-200">
                🔄 Regenerar
              </button>
            )}
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-2xl text-slate-600 font-bold text-lg active:scale-95">✕</button>
          </div>
        </div>

        {/* Selector de días */}
        {!lista && !loading && (
          <div className="p-5 border-b border-slate-100 shrink-0">
            <p className="text-slate-600 text-xs font-black uppercase tracking-wider mb-3">¿Para cuántos días?</p>
            <div className="flex gap-2">
              {[1, 3, 5, 7].map(d => (
                <button key={d} onClick={() => setDiasSeleccionados(d)}
                  className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 ${diasSeleccionados === d ? 'bg-emerald-500 text-slate-900' : 'bg-slate-100 text-slate-500'}`}>
                  {d}d
                </button>
              ))}
            </div>
            <button onClick={() => generarLista(true)}
              className="w-full mt-3 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm active:scale-95">
              Generar lista del súper →
            </button>
          </div>
        )}

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin"/>
              <p className="text-slate-500 font-bold text-sm">Generando tu lista del súper...</p>
              <p className="text-slate-400 text-xs">Solo se genera una vez y se guarda</p>
            </div>
          )}
          {lista && lista.categorias.map((cat, ci) => (
            <div key={ci} className="bg-slate-50 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-100">
                <p className="font-black text-slate-700 text-sm">{cat.nombre}</p>
              </div>
              <div className="divide-y divide-slate-100">
                {cat.items.map((item, ii) => {
                  const key = `${ci}-${item}`;
                  const checked = checkedItems[key];
                  return (
                    <button key={ii} onClick={() => toggleItem(ci, item)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-100 transition-all active:scale-95 text-left">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                        {checked && <Check className="w-3 h-3 text-white"/>}
                      </div>
                      <span className={`text-sm font-medium transition-all ${checked ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {lista && (
          <div className="p-4 border-t border-slate-100 shrink-0 space-y-3">
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${totalItems ? (checkedCount / totalItems) * 100 : 0}%` }}/>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={compartirWhatsApp}
                className="py-3 bg-green-500 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 active:scale-95">
                <MessageSquare className="w-3.5 h-3.5"/> WhatsApp
              </button>
              <button onClick={copiarAlPortapapeles}
                className="py-3 bg-slate-100 text-slate-700 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 active:scale-95">
                <FileText className="w-3.5 h-3.5"/> Copiar
              </button>
              <button onClick={enviarEmail} disabled={enviandoEmail}
                className="py-3 bg-blue-500 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50">
                {enviandoEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : '📧'} Email
              </button>
            </div>
            <button onClick={() => setCheckedItems({})}
              className="w-full py-2 text-slate-400 text-xs font-bold active:scale-95">
              Limpiar selección
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListaSuperModal;
