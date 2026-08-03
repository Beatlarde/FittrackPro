import { useState, useEffect } from 'react';
import { ShoppingCart, Utensils, Loader2, Check, Lock, RefreshCw } from 'lucide-react';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { BACKEND_URL } from '../../config/constants';
import { track } from '../../utils/analytics';
import { estimarMacrosComida } from '../../utils/metrics';
import { callGemini, getAuthToken } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import MacroCircle from '../shared/MacroCircle';

const DietaTab = ({ planRaw, checkedComidas, onToggleComida, onSelectAlternativa, onListaSuper, userPremium, uid, daysUnlocked, startDayIndex, todayIndex }) => {
  const [selectedDay, setSelectedDay] = useState(todayIndex ?? 0);
  const [altComidas, setAltComidas] = useState({});
  const [usosFirestore, setUsosFirestore] = useState({});
  const [foodImages, setFoodImages] = useState({}); // { 'nombre comida': url }

  const getFoodImage = async (descripcion) => {
    // Extraer nombre corto de la comida (primeras 3 palabras)
    const key = descripcion.split(' ').slice(0, 3).join(' ').toLowerCase();
    if (foodImages[key] !== undefined) return; // Ya está en caché
    setFoodImages(prev => ({ ...prev, [key]: 'loading' }));
    try {
      const token = await getAuthToken();
      const res = await fetch(`${BACKEND_URL}/food-image?q=${encodeURIComponent(key)}`, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      setFoodImages(prev => ({ ...prev, [key]: data.url || null }));
    } catch {
      setFoodImages(prev => ({ ...prev, [key]: null }));
    }
  };
  const [gustitos, setGustitos] = useState({}); // {checkKey: {texto, guardando, guardado}}
  const showToast = useToast();

  const guardarGustito = async (checkKey, momento, textoOriginal) => {
    const texto = gustitos[checkKey]?.texto?.trim();
    if (!texto) return;
    setGustitos(prev => ({ ...prev, [checkKey]: { ...prev[checkKey], guardando: true } }));
    try {
      const token = await getAuthToken();
      // Calcular macros con IA
      const aiResponse = await callGemini(texto, `Actúa como Nutricionista IA. Analiza la descripción de comida y devuelve estrictamente un JSON válido y sin markdown: {"kcal": numero, "protein": numero, "carbs": numero, "fats": numero, "name": "nombre corto"}. Si no hay cantidades, asume porciones estándar de 150g. No devuelvas NADA MÁS que el JSON.`);
      let macros = {};
      try {
        const clean = aiResponse.replace(/```json|```/g, '').trim();
        macros = JSON.parse(clean);
      } catch {}
      const contenido = `[${momento} — Me di un gustito] ${texto}${macros.kcal ? `\n(IA: ${macros.kcal} kcal | P:${macros.protein}g C:${macros.carbs}g G:${macros.fats}g)` : ''}`;
      await addDoc(collection(db, 'logs'), {
        userId: uid, type: 'meal', content: contenido,
        aiMetadata: macros, timestamp: serverTimestamp(),
        dateString: new Date().toDateString(), esGustito: true, momento
      });
      setGustitos(prev => ({ ...prev, [checkKey]: { ...prev[checkKey], guardando: false, guardado: true, textoGuardado: texto, macros } }));
      showToast(`🍕 Gustito registrado — ${macros.kcal || 0} kcal`); track('gustito_registrado', { kcal: macros.kcal || 0 });
    } catch(e) {
      setGustitos(prev => ({ ...prev, [checkKey]: { ...prev[checkKey], guardando: false } }));
      showToast('No se pudo guardar. Intenta de nuevo.', 'error');
    }
  };

  const plan = (() => { try { return typeof planRaw === 'string' ? JSON.parse(planRaw) : planRaw; } catch { return null; } })();
  const [planLocal, setPlanLocal] = useState(plan);

  // Sincronizar planLocal cuando planRaw cambia desde Firestore
  useEffect(() => {
    const parsed = (() => { try { return typeof planRaw === 'string' ? JSON.parse(planRaw) : planRaw; } catch { return null; } })();
    setPlanLocal(parsed);
  }, [planRaw]);

  if (!planLocal) return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mb-5">
        <Utensils className="w-8 h-8 text-slate-500"/>
      </div>
      <p className="font-black text-slate-700 text-lg mb-2">Tu plan nutricional</p>
      <p className="text-slate-400 text-sm leading-relaxed mb-6">Aquí verás tu plan de comidas personalizado una vez que lo generes.</p>
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 w-full max-w-xs">
        <p className="text-emerald-700 text-xs font-bold">💡 Completa tu perfil para generar tu plan con IA en menos de 3 minutos.</p>
      </div>
    </div>
  );

  const unlockedIndices = Array.from({ length: daysUnlocked }, (_, k) => (startDayIndex + k) % 7);
  const diaActual = planLocal[selectedDay];
  const dieta = diaActual?.dieta;

  const generarAlternativaComida = async (comida, key) => {
    setAltComidas(prev => ({ ...prev, [key]: { ...(prev[key] || {}), loading: true, show: true } }));
    const token = await getAuthToken();
    const prompt = `Genera DOS alternativas equivalentes para esta comida: "${comida.descripcion}".
Mantén calorías y macros similares. Disponibles en México.
Responde SOLO con JSON sin markdown: [{"descripcion": "opción 1 con ingredientes y cantidades"}, {"descripcion": "opción 2 con ingredientes y cantidades"}]`;
    try {
      const res = await fetch(`${BACKEND_URL}/agente-nutricion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ prompt, uid })
      });
      const data = await res.json();
      const clean = data.text?.replace(/```json|```/g, '').trim();
      const alts = JSON.parse(clean);
      setAltComidas(prev => ({ ...prev, [key]: { opciones: alts, show: true, loading: false } }));
    } catch { setAltComidas(prev => ({ ...prev, [key]: { ...(prev[key] || {}), loading: false } })); }
  };

  const elegirAlternativa = async (descripcion, momento, dayIndex, comidaIndex) => {
    if (!uid) return;
    // Actualizar visualmente de inmediato
    setPlanLocal(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[dayIndex].dieta.comidas[comidaIndex].descripcion = descripcion;
      return next;
    });
    try {
      const planSnap = await getDoc(doc(db, 'plans', uid));
      if (planSnap.exists()) {
        const planArray = JSON.parse(JSON.stringify(planSnap.data().plan));
        planArray[dayIndex].dieta.comidas[comidaIndex].descripcion = descripcion;
        await updateDoc(doc(db, 'plans', uid), { plan: planArray });
      }
      onSelectAlternativa(descripcion, momento); track('alternativa_elegida', { momento });
    } catch(e) { console.error(e); }
  };

  return (
    <div>
      {/* Selector de días */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {planLocal.map((d, i) => {
          const isUnlocked = unlockedIndices.includes(i);
          const isSelected = selectedDay === i;
          const isToday = i === todayIndex;
          return (
            <button key={i} onClick={() => isUnlocked && setSelectedDay(i)}
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

      {/* Macros del día */}
      {dieta && (
        <div className="bg-slate-800 rounded-3xl p-4 mb-4">
          <p className="text-xs font-black text-slate-400 uppercase mb-3 tracking-wider">Macros del día</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Kcal', val: dieta.kcal, color: 'text-orange-400' },
              { label: 'Prot', val: `${dieta.proteina}g`, color: 'text-blue-400' },
              { label: 'Carbs', val: `${dieta.carbs}g`, color: 'text-yellow-400' },
              { label: 'Gras', val: `${dieta.grasas}g`, color: 'text-pink-400' },
            ].map(m => (
              <div key={m.label} className="bg-slate-700 rounded-2xl p-2 text-center">
                <p className={`font-black text-sm ${m.color}`}>{m.val}</p>
                <p className="text-xs text-slate-400 font-bold uppercase mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comidas */}
      {dieta?.comidas?.length > 0 && (
        <div className="bg-slate-800 rounded-3xl overflow-hidden mb-4">
          <div className="flex items-center justify-between p-4 pb-2">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Utensils className="w-3 h-3"/> Comidas
            </h4>
            <button onClick={() => userPremium ? onListaSuper() : onListaSuper('upgrade')}
              className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl transition-all active:scale-95 ${
                userPremium ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 bg-slate-700/30'
              }`}>
              {userPremium ? <ShoppingCart className="w-3 h-3"/> : <Lock className="w-3 h-3"/>}
              Lista del Súper {!userPremium && <span className="text-amber-400">⭐</span>}
            </button>
          </div>
          <div className="space-y-1 p-3 pt-0">
            {dieta.comidas.map((c, i) => {
              const checkKey = `${selectedDay}-comida-${i}`;
              const altKey = `${selectedDay}-alt-${i}`;
              const done = checkedComidas?.includes(checkKey);
              const alt = altComidas[altKey] || { opciones: [], show: false, loading: false };
              const usosTotales = usosFirestore[altKey] || 0;
              const agotado = userPremium ? false : usosTotales >= 1;
              const imgKey = c.descripcion.split(' ').slice(0, 3).join(' ').toLowerCase();
              const imgUrl = foodImages[imgKey];
              // Cargar imagen al renderizar
              if (imgUrl === undefined) getFoodImage(c.descripcion);
              return (
                <div key={i} className={`rounded-2xl overflow-hidden transition-all ${done ? 'opacity-60' : ''}`}>
                  {/* Imagen de la comida */}
                  {imgUrl && imgUrl !== 'loading' && (
                    <div className="relative h-24 overflow-hidden">
                      <img src={imgUrl} alt={c.descripcion} className="w-full h-full object-cover"/>
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"/>
                      <span className={`absolute bottom-2 left-3 text-xs font-black uppercase px-2 py-0.5 rounded-lg ${done ? 'bg-orange-900/60 text-orange-400' : 'bg-orange-500/20 text-orange-300'}`}>
                        {c.momento}
                      </span>
                      {done && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white"/>
                        </div>
                      )}
                    </div>
                  )}
                  {imgUrl === 'loading' && (
                    <div className="h-24 bg-slate-700/50 animate-pulse rounded-t-2xl flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-slate-500 animate-spin"/>
                    </div>
                  )}
                  <div onClick={() => onToggleComida(checkKey)}
                    className={`flex items-start gap-3 p-4 cursor-pointer transition-all ${done ? 'bg-orange-900/20 border border-orange-700/30' : 'bg-slate-700/50'}`}>
                    {(!imgUrl || imgUrl === 'loading') && (
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${done ? 'bg-orange-500 border-orange-500' : 'border-slate-600'}`}>
                        {done && <Check className="w-3 h-3 text-white"/>}
                      </div>
                    )}
                    <div className="flex-1">
                      {(!imgUrl || imgUrl === 'loading') && (
                        <span className={`text-xs font-black uppercase px-2 py-0.5 rounded-lg mr-2 ${done ? 'bg-orange-900/40 text-orange-600' : 'bg-orange-500/10 text-orange-400'}`}>{c.momento}</span>
                      )}
                      <p className={`text-xs font-medium leading-relaxed mt-1 ${done ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{c.descripcion}</p>
                    </div>
                    {(() => {
                      const macros = estimarMacrosComida(c.descripcion, dieta, dieta.comidas.length);
                      if (!macros) return null;
                      return (
                        <div className="flex gap-1 shrink-0">
                          <MacroCircle label="P" grams={macros.proteina} color="#60a5fa" max={dieta.proteina} completed={done}/>
                          <MacroCircle label="C" grams={macros.carbs} color="#facc15" max={dieta.carbs} completed={done}/>
                          <MacroCircle label="G" grams={macros.grasas} color="#f472b6" max={dieta.grasas} completed={done}/>
                        </div>
                      );
                    })()}
                  </div>
                  {/* Alternativa */}
                  {!alt.show ? (
                    <button onClick={() => agotado ? onListaSuper('upgrade') : generarAlternativaComida(c, altKey)}
                      className="w-full text-xs font-black text-slate-500 hover:text-emerald-400 px-4 py-2 text-left flex items-center gap-2 transition-colors">
                      {alt.loading ? <><Loader2 className="w-3 h-3 animate-spin"/> Un momento...</> : agotado ? <><Lock className="w-3 h-3 text-amber-400"/> Ver alternativa ⭐</> : <><RefreshCw className="w-3 h-3"/> Ver alternativa</>}
                    </button>
                  ) : (
                    <div className="bg-slate-700/30 border-t border-slate-700/30 p-3 space-y-2">
                      {alt.loading ? (
                        <div className="flex gap-2 items-center">
                          <Loader2 className="w-3 h-3 animate-spin text-emerald-400"/>
                          <span className="text-xs text-slate-400">Generando alternativas...</span>
                        </div>
                      ) : alt.opciones?.map((op, j) => (
                        <div key={j} className="bg-slate-800 rounded-2xl p-3">
                          <div className="flex items-start gap-2 mb-2">
                            <span className="text-emerald-400 text-xs font-black shrink-0">#{j+1}</span>
                            <p className="text-xs text-slate-300 flex-1 leading-relaxed">{op.descripcion || op}</p>
                          </div>
                          <button onClick={() => {
                            elegirAlternativa(op.descripcion || op, c.momento, selectedDay, i);
                            setAltComidas(prev => ({ ...prev, [altKey]: { show: false } }));
                          }}
                            className="w-full py-2 bg-emerald-500 text-white text-xs font-black rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1">
                            <Check className="w-3 h-3"/> Elegir esta opción
                          </button>
                        </div>
                      ))}
                      <button onClick={() => setAltComidas(prev => ({ ...prev, [altKey]: { show: false } }))}
                        className="w-full text-xs text-slate-500 font-bold py-1">
                        Cancelar
                      </button>
                    </div>
                  )}

                  {/* Me di un gustito */}
                  {(() => {
                    const g = gustitos[checkKey] || {};
                    if (g.guardado) return (
                      <div className="mx-3 mb-3 bg-pink-500/10 border border-pink-500/20 rounded-2xl p-3 animate-in fade-in">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm">🍕</span>
                          <p className="text-xs font-black text-pink-400 uppercase">Lo que comiste en cambio</p>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{g.textoGuardado}</p>
                        {g.macros?.kcal > 0 && (
                          <div className="flex gap-3 mt-2 pt-2 border-t border-pink-500/20">
                            <span className="text-xs font-black text-orange-400">{g.macros.kcal} kcal</span>
                            <span className="text-xs font-black text-blue-400">P: {g.macros.protein}g</span>
                            <span className="text-xs font-black text-yellow-400">C: {g.macros.carbs}g</span>
                            <span className="text-xs font-black text-pink-400">G: {g.macros.fats}g</span>
                          </div>
                        )}
                      </div>
                    );
                    return (
                      <div className="border-t border-slate-700/30">
                        {!g.abierto ? (
                          <button onClick={() => setGustitos(prev => ({ ...prev, [checkKey]: { ...prev[checkKey], abierto: true, texto: '' } }))}
                            className="w-full bg-pink-500/10 hover:bg-pink-500/20 px-4 py-3 text-left flex items-center gap-2 transition-colors active:scale-95">
                            <span className="text-base">🍕</span>
                            <div>
                              <p className="text-xs font-black text-pink-400">Me di un gustito</p>
                              <p className="text-xs text-slate-500">Registra lo que comiste en cambio</p>
                            </div>
                          </button>
                        ) : (
                          <div className="px-3 pb-3 pt-2 space-y-2 animate-in slide-in-from-top-2">
                            <p className="text-xs font-black text-pink-400 uppercase">¿Qué comiste en cambio?</p>
                            <input
                              autoFocus
                              placeholder={`Ej: 2 tacos de canasta, refresco 355ml...`}
                              value={g.texto || ''}
                              onChange={e => setGustitos(prev => ({ ...prev, [checkKey]: { ...prev[checkKey], texto: e.target.value } }))}
                              className="w-full bg-slate-700 text-slate-200 text-xs font-medium px-3 py-2.5 rounded-xl outline-none placeholder-slate-500 border border-slate-600 focus:border-pink-500"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => setGustitos(prev => ({ ...prev, [checkKey]: {} }))}
                                className="flex-1 py-2 bg-slate-700 text-slate-400 text-xs font-black rounded-xl active:scale-95">
                                Cancelar
                              </button>
                              <button onClick={() => guardarGustito(checkKey, c.momento, c.descripcion)}
                                disabled={!g.texto?.trim() || g.guardando}
                                className="flex-1 py-2 bg-pink-500 text-white text-xs font-black rounded-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1">
                                {g.guardando ? <Loader2 className="w-3 h-3 animate-spin"/> : '✓ Registrar'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DietaTab;
