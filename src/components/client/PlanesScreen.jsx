import { useState } from 'react';
import { Loader2, Check, ChevronLeft } from 'lucide-react';
import { BACKEND_URL } from '../../config/constants';
import { track } from '../../utils/analytics';
import { getAuthToken } from '../../services/api';
import { useToast } from '../../hooks/useToast';

const PlanesScreen = ({ user, onClose }) => {
  const [loading, setLoading] = useState(false);
  const showToast = useToast();

  const iniciarSuscripcion = async () => {
    track('checkout_started', { method: 'mercadopago', value: 99 });
    setLoading(true);
    try {
      const backUrl = encodeURIComponent(`https://fittrackpro.store?pago=exitoso&uid=${user.uid}`);
      const initPoint = `https://www.mercadopago.com.mx/subscriptions/checkout?preapproval_plan_id=${import.meta.env.VITE_MP_PLAN_ID}&back_url=${backUrl}&payer_email=${encodeURIComponent(user.email)}&public_key=${import.meta.env.VITE_MP_PUBLIC_KEY}`;
      // Guardar intento de pago en Firestore para rastreo
      try {
        const token = await getAuthToken();
        await fetch(`${BACKEND_URL}/registrar-intento-pago`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
          body: JSON.stringify({ uid: user.uid, email: user.email, ts: Date.now() })
        });
      } catch {}
      window.location.href = initPoint;
    } catch (e) {
      showToast('No pudimos iniciar el pago. Intenta de nuevo.', 'error');
    }
    setLoading(false);
  };

  const featuresLibre = [
    { icon: '📋', title: 'Plan de entrenamiento y dieta', desc: 'Acceso durante 1 mes' },
    { icon: '📅', title: '3 días visibles del plan', desc: 'Lunes, Martes y Miércoles' },
    { icon: '🍽️', title: '1 alternativa de comida', desc: 'Por semana' },
    { icon: '📊', title: 'Registro de macros', desc: 'Tracker básico de comidas' },
  ];

  const featuresPremium = [
    { icon: '📅', title: 'Plan completo 7 días', desc: 'Todos los días desbloqueados' },
    { icon: '🔄', title: 'Alternativas ilimitadas', desc: 'Cambia comidas y ejercicios sin límite' },
    { icon: '🛒', title: 'Lista del súper', desc: 'Generada automáticamente desde tu plan' },
    { icon: '📸', title: 'Fotos de progreso', desc: 'Análisis con IA y seguimiento visual' },
    { icon: '🤖', title: 'Regenerar plan con IA', desc: 'Ajusta entrenamiento o nutrición cuando quieras' },
    { icon: '💬', title: 'Chat ilimitado con coach', desc: 'Mensajes y soporte sin restricciones' },
    { icon: '▶️', title: 'Videos de ejercicios', desc: 'Guía visual para cada movimiento' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-end justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 my-4">
        {/* Header */}
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-8 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full"/>
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-white/5 rounded-full"/>
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 text-2xl font-bold">✕</button>
          <button onClick={onClose} className="absolute top-4 left-4 text-white/70 flex items-center gap-1 text-sm font-bold">
            <ChevronLeft className="w-4 h-4"/> Volver
          </button>
          <div className="relative z-10">
            <span className="text-3xl">⭐</span>
            <h2 className="text-white font-black text-2xl mt-2">FitTrack Premium</h2>
            <p className="text-white/80 text-sm mt-1">Todo lo que necesitas para transformar tu cuerpo</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Plan Free */}
          <div className="border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Plan Gratuito — Lo que tienes ahora</p>
            <div className="space-y-2">
              {featuresLibre.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-base">{f.icon}</span>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-600">{f.title} </span>
                    <span className="text-xs text-slate-400">{f.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Plan Premium */}
          <div className="border-2 border-amber-400 rounded-2xl p-4 bg-amber-50/50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-black text-amber-600 uppercase tracking-wider">⭐ Plan Premium</p>
              <span className="bg-amber-400 text-white text-xs font-black px-2 py-0.5 rounded-full">TODO INCLUIDO</span>
            </div>
            <div className="space-y-2">
              {featuresPremium.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-base">{f.icon}</span>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-700">{f.title} </span>
                    <span className="text-xs text-slate-400">{f.desc}</span>
                  </div>
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0"/>
                </div>
              ))}
            </div>
          </div>

          {/* Precio y CTA */}
          <div className="flex items-baseline gap-1 justify-center pt-2">
            <span className="text-4xl font-black text-slate-900">$99</span>
            <span className="text-slate-400 font-medium">MXN / mes</span>
          </div>
          <button onClick={iniciarSuscripcion} disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black text-lg rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-5 h-5 animate-spin"/> Procesando...</> : <>Pagar con Mercado Pago →</>}
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-slate-200"/>
            <span className="text-slate-400 text-xs font-bold">o</span>
            <div className="flex-1 h-px bg-slate-200"/>
          </div>

          <button onClick={() => {
            const url = `https://pay.hotmart.com/U106114157J?email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name || '')}`;
            track('checkout_hotmart', { email: user.email }); window.location.href = url;
          }}
            className="w-full py-4 bg-slate-900 text-white font-black text-lg rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
            Pagar con Hotmart →
          </button>

          <p className="text-center text-slate-400 text-xs">Cancela cuando quieras · Pago 100% seguro</p>
        </div>
      </div>
    </div>
  );
};

export default PlanesScreen;
