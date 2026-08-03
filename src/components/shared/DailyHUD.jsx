import { useState } from 'react';
import { Flame } from 'lucide-react';
import Ring from './Ring';

const DailyHUD = ({ entrenoTotal, entrenoDone, dietaTotal, dietaDone, pesoRegistrado, kcalConsumidas = 0, kcalMeta = 2000, mealLogs = [], userGoals = {} }) => {
  const [showKcalDetail, setShowKcalDetail] = useState(false);
  const pEntreno = entrenoTotal > 0 ? entrenoDone / entrenoTotal : 0;
  const pDieta = dietaTotal > 0 ? dietaDone / dietaTotal : 0;
  const pPeso = pesoRegistrado ? 1 : 0;
  const totalPercent = Math.round(((pEntreno + pDieta + pPeso) / 3) * 100);

  return (
    <div className="bg-slate-900 rounded-3xl p-6 shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-0.5">Central del Día</p>
          <p className="text-white font-black text-lg">{totalPercent === 100 ? '🎉 ¡Día Completado!' : `${totalPercent}% completado`}</p>
        </div>
        <div className="bg-slate-800 px-4 py-2 rounded-2xl border border-slate-700">
          <span className="text-white font-black text-xl">{totalPercent}%</span>
        </div>
      </div>

      {/* 3 Anillos lado a lado */}
      <div className="flex justify-around items-center mb-6">
        {/* Entreno */}
        <div className="flex flex-col items-center gap-2">
          <Ring percent={pEntreno} color="#10b981" size={78} stroke={9}>
            <div className="text-center">
              <p className="text-white font-black text-sm leading-none">{entrenoDone}<span className="text-slate-500 text-xs">/{entrenoTotal}</span></p>
            </div>
          </Ring>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-slate-400 text-xs font-black uppercase">Entreno</span>
          </div>
          <span className="text-emerald-400 font-black text-xs">{Math.round(pEntreno * 100)}%</span>
        </div>

        {/* Anillo total central más grande */}
        <div className="flex flex-col items-center gap-2">
          <Ring percent={(pEntreno + pDieta + pPeso) / 3} color="#f59e0b" size={100} stroke={11}>
            <div className="text-center">
              <Flame className="w-5 h-5 text-orange-400 mx-auto mb-0.5" />
              <p className="text-white font-black text-sm">{totalPercent}%</p>
            </div>
          </Ring>
          <span className="text-slate-400 text-xs font-black uppercase">Total</span>
        </div>

        {/* Dieta */}
        <div className="flex flex-col items-center gap-2">
          <Ring percent={pDieta} color="#f97316" size={78} stroke={9}>
            <div className="text-center">
              <p className="text-white font-black text-sm leading-none">{dietaDone}<span className="text-slate-500 text-xs">/{dietaTotal}</span></p>
            </div>
          </Ring>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            <span className="text-slate-400 text-xs font-black uppercase">Dieta</span>
          </div>
          <span className="text-orange-400 font-black text-xs">{Math.round(pDieta * 100)}%</span>
        </div>
      </div>

      {/* Barra peso */}
      <div className="bg-slate-800 rounded-2xl p-3 flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Ring percent={pPeso} color="#60a5fa" size={28} stroke={4}>
            <span className="text-[11px] text-white font-black">{pPeso === 1 ? '✓' : '?'}</span>
          </Ring>
          <span className="text-slate-400 text-xs font-black uppercase">Peso del día</span>
        </div>
        {pesoRegistrado
          ? <span className="text-blue-400 text-xs font-black">✅ Registrado</span>
          : <span className="text-slate-500 text-xs font-bold">⏳ Pendiente</span>}
      </div>

      {/* Barra kcal reales vs meta */}
      <div className="bg-slate-800 rounded-2xl p-3">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-xs font-black uppercase">Kcal del día</span>
            <button onClick={() => setShowKcalDetail(p => !p)}
              className="w-4 h-4 rounded-full bg-slate-700 text-slate-400 text-xs font-black flex items-center justify-center hover:bg-slate-600 transition-all">
              {showKcalDetail ? '▲' : 'i'}
            </button>
          </div>
          <span className="text-white font-black text-xs">{kcalConsumidas} <span className="text-slate-500 font-normal">/ {kcalMeta}</span></span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${kcalConsumidas > kcalMeta ? 'bg-red-500' : 'bg-orange-400'}`}
            style={{ width: `${Math.min((kcalConsumidas / kcalMeta) * 100, 100)}%` }}
          />
        </div>
        {kcalConsumidas > kcalMeta && (
          <p className="text-red-400 text-xs font-bold mt-1">⚠️ +{kcalConsumidas - kcalMeta} kcal sobre la meta</p>
        )}

        {/* Desglose expandible */}
        {showKcalDetail && (
          <div className="mt-3 space-y-2 border-t border-slate-700 pt-3 animate-in fade-in slide-in-from-top-2">
            {/* Explicación de la meta */}
            <div className="bg-slate-700/50 rounded-xl p-3">
              <p className="text-xs font-black text-slate-400 uppercase mb-1.5">¿Por qué {kcalMeta} kcal?</p>
              <p className="text-slate-300 text-xs font-medium leading-relaxed">
                Meta calculada con la fórmula <span className="text-orange-400 font-black">Mifflin-St Jeor</span> según tu peso ({userGoals.weight}kg), altura ({userGoals.height}cm), edad ({userGoals.age} años) y nivel de actividad ({userGoals.activity}){userGoals.objective !== 'Mantenimiento' ? `, ajustada para tu objetivo de ${userGoals.objective}` : ''}.
              </p>
            </div>

            {/* Logs de comidas del día */}
            <div className="bg-slate-700/50 rounded-xl p-3">
              <p className="text-xs font-black text-slate-400 uppercase mb-2">Registros de hoy</p>
              {mealLogs.length === 0 ? (
                <p className="text-slate-500 text-xs font-medium">Sin comidas registradas aún</p>
              ) : (
                <div className="space-y-1.5">
                  {mealLogs.map((log, i) => (
                    <div key={i} className="flex justify-between items-start gap-2">
                      <p className="text-slate-400 text-xs font-medium flex-1 leading-tight truncate">{log.content?.split('\n')[0] || 'Comida'}</p>
                      <span className="text-orange-400 font-black text-xs shrink-0">{log.aiMetadata?.kcal || 0} kcal</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center border-t border-slate-600 pt-1.5 mt-1.5">
                    <span className="text-slate-400 text-xs font-black">Total</span>
                    <span className="text-white font-black text-xs">{kcalConsumidas} kcal</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyHUD;
