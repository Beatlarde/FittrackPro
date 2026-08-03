import { useState } from 'react';
import { useInstallPWA } from '../../hooks/useInstallPWA';

const InstallBanner = ({ onDismiss }) => {
  const { installPrompt, isInstalled, isIOS, install } = useInstallPWA();
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa_dismissed') === '1');

  if (isInstalled || dismissed) return null;
  if (!installPrompt && !isIOS) return null;

  const dismiss = () => {
    localStorage.setItem('pwa_dismissed', '1');
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <>
      <div className="fixed bottom-24 left-4 right-4 z-30 animate-in slide-in-from-bottom-4 fade-in">
        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="bg-emerald-500 w-10 h-10 rounded-2xl flex items-center justify-center shrink-0">
              <span className="text-white font-black text-sm">F</span>
            </div>
            <div className="flex-1">
              <p className="font-black text-white text-sm">Instala FitTrack Pro</p>
              <p className="text-slate-400 text-xs mt-0.5">Acceso rápido desde tu pantalla de inicio, sin navegador.</p>
            </div>
            <button onClick={dismiss} className="text-slate-500 text-lg leading-none shrink-0">✕</button>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={dismiss}
              className="flex-1 py-2.5 bg-slate-800 text-slate-400 rounded-2xl text-xs font-black active:scale-95 transition-all">
              Ahora no
            </button>
            <button onClick={isIOS ? () => setShowIOSInstructions(true) : install}
              className="flex-1 py-2.5 bg-emerald-500 text-white rounded-2xl text-xs font-black active:scale-95 transition-all">
              {isIOS ? 'Cómo instalar' : '⬇️ Instalar'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal instrucciones iOS */}
      {showIOSInstructions && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-end justify-center p-4"
          onClick={() => setShowIOSInstructions(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-slate-800 text-lg mb-4">Instalar en iPhone</h3>
            <div className="space-y-4">
              {[
                { step: '1', icon: '⬆️', text: 'Toca el botón Compartir en Safari' },
                { step: '2', icon: '➕', text: 'Selecciona "Agregar a pantalla de inicio"' },
                { step: '3', icon: '✅', text: 'Toca "Agregar" para confirmar' },
              ].map(s => (
                <div key={s.step} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-white font-black text-xs">{s.step}</span>
                  </div>
                  <p className="text-slate-700 text-sm font-medium">{s.icon} {s.text}</p>
                </div>
              ))}
            </div>
            <button onClick={() => { setShowIOSInstructions(false); dismiss(); }}
              className="w-full mt-6 py-3 bg-emerald-500 text-white font-black rounded-2xl active:scale-95">
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallBanner;
