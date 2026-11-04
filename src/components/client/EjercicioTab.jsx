import { useState, useEffect } from 'react';
import { Dumbbell, Loader2, Check, Play } from 'lucide-react';
import { BACKEND_URL } from '../../config/constants';
import { getAuthToken } from '../../services/api';

const EjercicioTab = ({ planRaw, checkedEjercicios, onToggleEjercicio, userPremium, uid, daysUnlocked, startDayIndex, todayIndex, userEquipment, onUnlockDay }) => {
  const [selectedDay, setSelectedDay] = useState(todayIndex ?? 0);
  // Mismo arreglo que en DietaTab: si la app se queda abierta de un día para
  // otro, resincronizamos la pestaña seleccionada a "hoy" para no seguir
  // guardando los checks bajo el índice de ayer.
  useEffect(() => {
    setSelectedDay(todayIndex ?? 0);
  }, [todayIndex]);
  const [altEjercicio, setAltEjercicio] = useState({});
  const [editandoEj, setEditandoEj] = useState(null);
  const [showEsfuerzo, setShowEsfuerzo] = useState(null);
  const [esfuerzoData, setEsfuerzoData] = useState({});
  // Demostración por ejercicio: { [key]: { show, loading, gif, videoId, musculo, error } }
  const [demo, setDemo] = useState({});

  const plan = (() => { try { return typeof planRaw === 'string' ? JSON.parse(planRaw) : planRaw; } catch { return null; } })();
  if (!plan) return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mb-5">
        <Dumbbell className="w-8 h-8 text-slate-500"/>
      </div>
      <p className="font-black text-slate-700 text-lg mb-2">Tu plan de ejercicios</p>
      <p className="text-slate-400 text-sm leading-relaxed mb-6">Aquí verás tu rutina semanal personalizada una vez generada.</p>
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 w-full max-w-xs">
        <p className="text-emerald-700 text-xs font-bold">💡 Completa tu perfil para generar tu plan con IA en menos de 3 minutos.</p>
      </div>
    </div>
  );

  const unlockedIndices = Array.from({ length: daysUnlocked }, (_, k) => (startDayIndex + k) % 7);
  const diaActual = plan[selectedDay];
  const ejercicios = diaActual?.entrenamiento?.ejercicios || [];
  const isLocked = !unlockedIndices.includes(selectedDay);

  const generarAlternativaEjercicio = async (ej, key) => {
    setAltEjercicio(prev => ({ ...prev, [key]: { loading: true } }));
    const token = await getAuthToken();
    const prompt = `El usuario no tiene acceso al equipo para: "${ej.nombre}" (${ej.series}x${ej.reps}).
Equipo disponible: ${userEquipment}.
Genera UNA alternativa que trabaje el MISMO grupo muscular.
Responde SOLO con JSON: {"nombre":"...","series":${ej.series},"reps":"${ej.reps}","nota":"..."}`;
    try {
      const res = await fetch(`${BACKEND_URL}/agente-entrenamiento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ prompt, uid })
      });
      const data = await res.json();
      const clean = data.text?.replace(/```json|```/g, '').trim();
      const alt = JSON.parse(clean);
      setAltEjercicio(prev => ({ ...prev, [key]: { loading: false, alternativa: alt } }));
    } catch { setAltEjercicio(prev => ({ ...prev, [key]: { loading: false, error: true } })); }
  };

  // Demostración: primero el GIF de ExerciseDB; solo si no existe, un video corto de YouTube.
  // Se carga al tocar el botón y el backend guarda cada búsqueda en caché.
  const verComoSeHace = async (ej, key) => {
    const actual = demo[key];
    if (actual && !actual.loading) {
      setDemo(prev => ({ ...prev, [key]: { ...actual, show: !actual.show } }));
      return;
    }
    setDemo(prev => ({ ...prev, [key]: { show: true, loading: true } }));
    // Tiempo límite: si una API no contesta, se sigue con lo que haya en vez de quedarse cargando
    const conLimite = (url, opts = {}) =>
      fetch(url, { ...opts, signal: AbortSignal.timeout(15000) }).then(r => r.json()).catch(() => ({}));
    try {
      const exRes = await conLimite(`${BACKEND_URL}/ejercicio?q=${encodeURIComponent(ej.nombre)}`);
      if (exRes.gif) {
        setDemo(prev => ({ ...prev, [key]: { show: true, loading: false, gif: exRes.gif, musculo: exRes.musculo || null } }));
        return;
      }
      // Sin GIF → video corto
      setDemo(prev => ({ ...prev, [key]: { show: true, loading: true, sinGif: true } }));
      const token = await getAuthToken();
      const nombreEs = ej.nombre.replace(/\([^)]*\)/g, '').trim();
      const ytRes = await conLimite(
        `${BACKEND_URL}/youtube?q=${encodeURIComponent(nombreEs)}&equipo=${encodeURIComponent(userEquipment || '')}`,
        { headers: token ? { 'Authorization': `Bearer ${token}` } : {} }
      );
      setDemo(prev => ({ ...prev, [key]: { show: true, loading: false, sinGif: true, videoId: ytRes.videoId || null } }));
    } catch {
      setDemo(prev => ({ ...prev, [key]: { show: true, loading: false, error: true } }));
    }
  };

  return (
    <div>
      {/* Selector de días */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {plan.map((d, i) => {
          const isUnlocked = unlockedIndices.includes(i);
          const isSelected = selectedDay === i;
          const isToday = i === todayIndex;
          return (
            <button key={i} onClick={() => { if (isUnlocked) setSelectedDay(i); else onUnlockDay?.(); }}
              className={`shrink-0 flex flex-col items-center px-3 py-2 rounded-2xl transition-all ${
                isSelected ? 'bg-emerald-500 text-white' :
                isUnlocked ? 'bg-white border border-slate-100 text-slate-600' :
                'bg-slate-100 text-slate-300'
              }`}>
              <span className="text-xs font-bold uppercase">{d.dia?.slice(0,3)}</span>
              {isToday && <span className="text-[11px] font-black mt-0.5">HOY</span>}
              {!isUnlocked && <span className="text-xs">🔒</span>}
            </button>
          );
        })}
      </div>

      {isLocked ? (
        <div className="bg-slate-800 rounded-3xl p-8 text-center">
          <span className="text-4xl">🔒</span>
          <p className="text-white font-black mt-3">Día bloqueado</p>
          <p className="text-slate-400 text-sm mt-1">Activa Premium para ver todos los días</p>
          <button onClick={onUnlockDay} className="mt-4 bg-emerald-500 text-white font-black px-6 py-3 rounded-2xl active:scale-95">Ver planes Premium</button>
        </div>
      ) : ejercicios.length === 0 ? (
        <div className="bg-slate-800 rounded-3xl p-8 text-center">
          <span className="text-4xl">😴</span>
          <p className="text-white font-black mt-3">Día de descanso</p>
          <p className="text-slate-400 text-sm mt-1">Aprovecha para recuperarte</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-3xl overflow-hidden">
          <div className="p-4 pb-2">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Dumbbell className="w-3 h-3"/> {diaActual?.entrenamiento?.tipo || 'Entrenamiento'}
            </h4>
          </div>
          <div className="space-y-1 p-3 pt-0">
            {ejercicios.map((ej, i) => {
              const key = `${selectedDay}-ej-${i}`;
              const done = checkedEjercicios?.includes(key);
              const alt = altEjercicio[key];
              const d = demo[key];
              return (
                <div key={i} className={`rounded-2xl overflow-hidden transition-all ${done ? 'opacity-60' : ''}`}>
                  <div onClick={() => { onToggleEjercicio(key); if (!done) setTimeout(() => setShowEsfuerzo(key), 300); else setShowEsfuerzo(null); }}
                    className={`flex items-start gap-3 p-4 cursor-pointer transition-all ${done ? 'bg-emerald-900/30 border border-emerald-700/30' : 'bg-slate-700/50'}`}>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                      {done && <Check className="w-3 h-3 text-white"/>}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-black leading-snug ${done ? 'text-slate-500 line-through' : 'text-white'}`}>{ej.nombre}</p>
                      {ej.nota && <p className="text-xs text-slate-500 mt-0.5">{ej.nota}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0 max-w-[6.5rem]">
                      <span className={`font-black text-sm text-right leading-tight ${done ? 'text-slate-600' : 'text-emerald-400'}`}>{ej.series}×{ej.reps}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); verComoSeHace(ej, key); }}
                        aria-label={d?.show ? `Ocultar demostración de ${ej.nombre}` : `Ver cómo se hace ${ej.nombre}`}
                        aria-expanded={!!d?.show}
                        className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all active:scale-95 ${
                          d?.show ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                        }`}>
                        {d?.loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4 ml-0.5" fill="currentColor"/>}
                      </button>
                    </div>
                  </div>

                  {/* Panel de demostración: GIF, o video corto si no hay GIF */}
                  {d?.show && (
                    <div className="mx-3 mb-3 bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-3">
                      {d.sinGif && (
                        <p className="text-xs text-amber-300 font-bold">No encontramos GIF de este ejercicio. Aquí tienes un video corto:</p>
                      )}
                      {d.loading ? (
                        <div className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin text-emerald-400"/><span className="text-xs text-slate-400">{d.sinGif ? 'Buscando video...' : 'Buscando demostración...'}</span></div>
                      ) : d.gif ? (
                        <>
                          <div className="bg-white rounded-xl overflow-hidden flex justify-center">
                            <img src={d.gif} alt={`Demostración de ${ej.nombre}`} loading="lazy" className="max-h-56 object-contain"/>
                          </div>
                          {d.musculo && <p className="text-[11px] text-slate-500 font-bold uppercase">Músculo: {d.musculo}</p>}
                        </>
                      ) : d.videoId ? (
                        <div className="aspect-video rounded-xl overflow-hidden bg-black">
                          <iframe
                            src={`https://www.youtube-nocookie.com/embed/${d.videoId}`}
                            title={`Video: ${ej.nombre}`}
                            className="w-full h-full"
                            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">Tampoco encontramos un video para este ejercicio. Pregúntale a tu coach o usa la alternativa.</p>
                      )}
                    </div>
                  )}

                  {/* Widget RPE/RIR */}
                  {done && showEsfuerzo === key && (
                    <div className="px-4 pb-3 bg-slate-700/30">
                      <div className="bg-slate-800 rounded-2xl p-3 space-y-3 mt-2">
                        <p className="text-xs font-black text-slate-300 uppercase">¿Cómo estuvo?</p>
                        <div>
                          <p className="text-xs text-slate-400 font-bold mb-1.5">RPE (1-10)</p>
                          <div className="flex gap-1">
                            {[6,7,8,9,10].map(v => (
                              <button key={v} onClick={() => setEsfuerzoData(prev => ({ ...prev, [key]: { ...prev[key], rpe: v } }))}
                                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${esfuerzoData[key]?.rpe === v ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>{v}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-bold mb-1.5">RIR (reps restantes)</p>
                          <div className="flex gap-1">
                            {[0,1,2,3,4].map(v => (
                              <button key={v} onClick={() => setEsfuerzoData(prev => ({ ...prev, [key]: { ...prev[key], rir: v } }))}
                                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${esfuerzoData[key]?.rir === v ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}>{v}</button>
                            ))}
                          </div>
                        </div>
                        <button onClick={async () => {
                          if (!uid || !esfuerzoData[key]) return;
                          try {
                            const token = await getAuthToken();
                            await fetch(`${BACKEND_URL}/registrar-esfuerzo`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                              body: JSON.stringify({ ejercicioKey: key, ejercicio: ej.nombre, ...esfuerzoData[key] })
                            });
                          } catch {}
                          setShowEsfuerzo(null);
                        }} className="w-full bg-emerald-500 text-white font-black text-xs py-2.5 rounded-xl active:scale-95">
                          Guardar ✓
                        </button>
                      </div>
                    </div>
                  )}
                  {done && esfuerzoData[key] && showEsfuerzo !== key && (
                    <div className="px-4 pb-2">
                      <span className="text-xs font-black text-emerald-400">✓ RPE: {esfuerzoData[key].rpe || '—'} · RIR: {esfuerzoData[key].rir ?? '—'}</span>
                    </div>
                  )}

                  {/* Alternativa por equipo */}
                  {!alt && (
                    <button onClick={() => generarAlternativaEjercicio(ej, key)}
                      className="w-full text-xs font-black text-slate-500 hover:text-amber-400 px-4 py-2 text-left flex items-center gap-2 transition-colors">
                      ❓ Mi gym no tiene este equipo
                    </button>
                  )}
                  {alt?.loading ? (
                    <div className="px-4 pb-2 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin text-amber-400"/><span className="text-xs text-slate-400">Buscando alternativa...</span></div>
                  ) : alt?.alternativa ? (
                    <div className="mx-3 mb-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                      <p className="text-xs font-black text-amber-400 uppercase mb-1">✅ Alternativa</p>
                      <p className="text-sm font-black text-white">{alt.alternativa.nombre}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{alt.alternativa.series}×{alt.alternativa.reps} — {alt.alternativa.nota}</p>
                      <button onClick={() => setAltEjercicio(prev => ({ ...prev, [key]: null }))}
                        className="text-xs text-slate-500 mt-1">Descartar ✕</button>
                    </div>
                  ) : alt?.error ? (
                    <div className="px-4 pb-2 flex items-center gap-3">
                      <span className="text-xs text-red-400">No se pudo generar la alternativa.</span>
                      <button onClick={() => setAltEjercicio(prev => ({ ...prev, [key]: null }))} className="text-xs text-slate-500">Reintentar</button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default EjercicioTab;
