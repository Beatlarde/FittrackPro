import { useState, useEffect } from 'react';
import { Users, Camera, ChevronRight, Utensils, LogOut, Send, Plus, Dumbbell, Sparkles, Loader2, FileText, Clock, Check, Minus, User, ChevronLeft, Search } from 'lucide-react';
import { auth, db } from '../../firebase';
import { doc, setDoc, updateDoc, serverTimestamp, limit } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { BACKEND_URL } from '../../config/constants';
import { track } from '../../utils/analytics';
import { parsearRespuestaIA } from '../../utils/metrics';
import { callAgenteNutricion, callAgenteEntrenamiento, getAuthToken, sendEmailNotification } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import CountdownTimer from '../shared/CountdownTimer';
import PhotosSection from '../shared/PhotosSection';
import SkeletonCard from '../shared/SkeletonCard';
import CoachMessageWidget from './CoachMessageWidget';
import HistorialPlanes from './HistorialPlanes';
import SectionCollapse from './SectionCollapse';
import ReferidoWidget from './ReferidoWidget';

const CoachDashboard = ({ user }) => {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [generatedPlan, setGeneratedPlan] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingEntrenamiento, setIsGeneratingEntrenamiento] = useState(false);
  const [isGeneratingNutricion, setIsGeneratingNutricion] = useState(false);
  const [coachInstrucciones, setCoachInstrucciones] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [modoManual, setModoManual] = useState(false);
  const [planManual, setPlanManual] = useState({ dias: [] });
  const showToast = useToast();

  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroObjetivo, setFiltroObjetivo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroPremium, setFiltroPremium] = useState('');
  const PAGE_SIZE = 10;

  const [dashMetricas, setDashMetricas] = useState(null);

  useEffect(() => {
    const cargarMetricas = async () => {
      try {
        const token = await getAuthToken();
        const res = await fetch(`${BACKEND_URL}/coach/dashboard-metricas`, {
          headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
        });
        const data = await res.json();
        if (!data.error) setDashMetricas(data);
      } catch(e) {}
    };
    cargarMetricas();
  }, []);

  const cargarClienteMetricas = async (clienteId) => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`${BACKEND_URL}/coach/cliente-metricas/${clienteId}`, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (!data.error) return data;
    } catch(e) {}
    return null;
  };

  const cargarClientes = async (reset = false) => {
    const page = reset ? 1 : currentPage + 1;
    if (reset) setLoadingClientes(true);
    else setLoadingMore(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${BACKEND_URL}/coach/clientes?page=${page}&limit=${PAGE_SIZE}`, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data.error) { console.error('Error clientes:', data.error); return; }
      if (reset) {
        setClients(data.clientes);
        setCurrentPage(1);
      } else {
        setClients(prev => [...prev, ...data.clientes]);
        setCurrentPage(page);
      }
      setHasMore(data.hasMore);
    } catch(e) { console.error('Error cargando clientes:', e); }
    setLoadingClientes(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    cargarClientes(true);
  }, []);

  const generatePlan = async () => {
    if (!selectedClient) return;
    setIsGenerating(true);
    setGeneratedPlan('');
    const c = selectedClient;
    const lesionesTexto = c.goals?.injuries?.trim();
    const instruccionesTexto = coachInstrucciones?.trim();
    
    // Combinar lesiones del perfil + instrucciones del coach en restricciones críticas
    const todasLasRestricciones = [lesionesTexto, instruccionesTexto].filter(Boolean).join('\n');
    const restriccionesCoach = todasLasRestricciones ? `
⚠️ RESTRICCIONES CRÍTICAS — OBLIGATORIO RESPETAR EN TODOS LOS DÍAS:
${todasLasRestricciones}
- PROHIBIDO incluir cualquier ejercicio que contradiga las restricciones anteriores
- SUSTITUIR siempre por alternativas seguras y de bajo impacto donde corresponda` : '';

    const prompt = `Crea un plan de entrenamiento y nutrición semanal para este cliente. Responde ÚNICAMENTE con el JSON, sin texto adicional, sin markdown.
- Nombre: ${c.name}, ${c.goals?.age} años
- Objetivo: ${c.goals?.objective} (${c.goals?.targetKcal} kcal/día)
- Peso: ${c.goals?.weight}kg, Altura: ${c.goals?.height}cm
- Actividad: ${c.goals?.activity}, Equipo: ${c.goals?.equipment}
- Tipo de cuerpo: ${c.goals?.bodyType || 'No especificado'}
- Lesiones: ${c.goals?.injuries || 'Ninguna'}, Estrés: ${c.goals?.stressLevel}
${restriccionesCoach}
Genera los 7 días (Lunes a Domingo). Estructura exacta con calentamiento SEPARADO de ejercicios:
{"dia":"Lunes","entrenamiento":{"calentamiento":[{"nombre":"Rotación de cadera","duracion":"30 seg"}],"ejercicios":[{"nombre":"Sentadilla","series":4,"reps":"8-10","nota":""}]},"dieta":{...}}
CRÍTICO: "calentamiento" y "ejercicios" son arrays SEPARADOS. Solo el JSON.`;
    const plan = await callAgenteEntrenamiento(prompt, {
      nombre: c.name, objetivo: c.goals?.objective, peso: c.goals?.weight,
      altura: c.goals?.height, actividad: c.goals?.activity, equipo: c.goals?.equipment,
      lesiones: c.goals?.injuries
    }, c.id);
    setGeneratedPlan(plan); track('plan_generated', { clientId: selectedClient?.id });
    setIsGenerating(false);
  };

  const regenerarEntrenamiento = async () => {
    if (!selectedClient || !planEditado) return;
    setIsGeneratingEntrenamiento(true);
    const c = selectedClient;
    const prompt = `Crea SOLO el plan de entrenamiento semanal para este cliente.
IMPORTANTE: Responde ÚNICAMENTE con un array JSON de 7 objetos, SIN markdown, SIN texto, empezando directo con "[".
Estructura exacta con calentamiento SEPARADO: {"dia":"Lunes","entrenamiento":{"calentamiento":[{"nombre":"Rotación de cadera","duracion":"30 seg"}],"ejercicios":[{"nombre":"Ejercicio","series":4,"reps":"8-10","nota":""}]},"dieta":{"kcal":0,"proteina":0,"carbs":0,"grasas":0,"comidas":[]}}
CRÍTICO: "calentamiento" y "ejercicios" son arrays SEPARADOS. Calentamiento = activación/movilidad. Ejercicios = fuerza/hipertrofia con series y reps.
- Nombre: ${c.name}, Objetivo: ${c.goals?.objective}
- Peso: ${c.goals?.weight}kg, Actividad: ${c.goals?.activity}, Equipo: ${c.goals?.equipment}
- Lesiones: ${c.goals?.injuries || 'Ninguna'}
${coachInstrucciones ? `\nINSTRUCCIONES ESPECIALES DEL COACH (prioridad alta):\n${coachInstrucciones}\n` : ''}Genera los 7 días (Lunes a Domingo). El campo "dieta" ponlo vacío.`;
    try {
      const res = await callAgenteEntrenamiento(prompt, {
        nombre: c.name, objetivo: c.goals?.objective, peso: c.goals?.weight,
        altura: c.goals?.height, actividad: c.goals?.activity, equipo: c.goals?.equipment,
        lesiones: c.goals?.injuries
      }, c.id);
      const nuevoPlan = parsearRespuestaIA(res);
      const planMezclado = planEditado.map((dia, i) => ({
        ...dia,
        entrenamiento: nuevoPlan[i]?.entrenamiento || dia.entrenamiento
      }));
      setPlanEditado(planMezclado);
      setGeneratedPlan(JSON.stringify(planMezclado));
      await setDoc(doc(db, 'plans', c.id), { plan: planMezclado, updatedAt: serverTimestamp() }, { merge: true });
      showToast('🏋️ Entrenamiento regenerado y guardado');
    } catch(e) { console.error('Error entrenamiento:', e); showToast('❌ Error al regenerar entrenamiento', 'error'); }
    setIsGeneratingEntrenamiento(false);
  };

  const regenerarNutricion = async () => {
    if (!selectedClient || !planEditado) return;
    setIsGeneratingNutricion(true);
    const c = selectedClient;
    const prompt = `Crea SOLO el plan de nutrición semanal para este cliente. 
IMPORTANTE: Responde ÚNICAMENTE con un array JSON de 7 objetos, SIN markdown, SIN texto, SIN wrapper, empezando directo con "[".
Estructura exacta por día: {"dia":"Lunes","entrenamiento":{"calentamiento":[],"ejercicios":[]},"dieta":{"kcal":2000,"proteina":150,"carbs":200,"grasas":60,"comidas":[{"momento":"Desayuno","descripcion":"descripcion"}]}}
⚠️ CRÍTICO: El campo "entrenamiento" SIEMPRE debe ser {"calentamiento":[],"ejercicios":[]} — NO generes ejercicios, SOLO nutrición.
- Nombre: ${c.name}, Objetivo: ${c.goals?.objective}
- Kcal objetivo: ${c.goals?.targetKcal} kcal/día
- Peso: ${c.goals?.weight}kg, Actividad: ${c.goals?.activity}
${coachInstrucciones ? `\nINSTRUCCIONES ESPECIALES DEL COACH (prioridad alta):\n${coachInstrucciones}\n` : ''}Genera los 7 días (Lunes a Domingo). SOLO nutrición, entrenamiento siempre vacío.`;
    try {
      const res = await callAgenteNutricion(prompt, {
        nombre: c.name, objetivo: c.goals?.objective, peso: c.goals?.weight,
        altura: c.goals?.height, actividad: c.goals?.activity,
        kcal: c.goals?.targetKcal
      }, c.id);
      const nuevoPlan = parsearRespuestaIA(res);
      const planMezclado = planEditado.map((dia, i) => ({
        ...dia,
        dieta: nuevoPlan[i]?.dieta || dia.dieta
      }));
      setPlanEditado(planMezclado);
      setGeneratedPlan(JSON.stringify(planMezclado));
      await setDoc(doc(db, 'plans', c.id), { plan: planMezclado, updatedAt: serverTimestamp() }, { merge: true });
      showToast('🥗 Nutrición regenerada y guardada');
    } catch(e) { console.error('Error nutrición:', e); showToast('❌ Error al regenerar nutrición', 'error'); }
    setIsGeneratingNutricion(false);
  };

  // Editor de plan por días
  const [planEditado, setPlanEditado] = useState(null);
  const [selectedDayCoach, setSelectedDayCoach] = useState(0);
  const [clienteMetricas, setClienteMetricas] = useState(null);
  const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const diasCortos = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // Cuando se genera el plan, parsearlo
  useEffect(() => {
    if (!generatedPlan) { setPlanEditado(null); return; }
    try {
      const clean = generatedPlan.replace(/```json/g, '').replace(/```/g, '').trim();
      setPlanEditado(JSON.parse(clean));
    } catch { setPlanEditado(null); }
  }, [generatedPlan]);

  // Al seleccionar cliente, cargar plan existente si tiene
  useEffect(() => {
    if (!selectedClient) return;
    setClienteMetricas(null);
    cargarClienteMetricas(selectedClient.id).then(m => { if (m) setClienteMetricas(m); });
    if (selectedClient.currentPlan) {
      try {
        const clean = selectedClient.currentPlan.replace(/```json/g, '').replace(/```/g, '').trim();
        setPlanEditado(JSON.parse(clean));
        setGeneratedPlan(selectedClient.currentPlan);
      } catch { setPlanEditado(null); }
    } else {
      setPlanEditado(null);
      setGeneratedPlan('');
    }
  }, [selectedClient]);

  const updateEjercicio = (dayI, ejI, field, val) => {
    setPlanEditado(prev => {
      const p = JSON.parse(JSON.stringify(prev));
      p[dayI].entrenamiento.ejercicios[ejI][field] = val;
      return p;
    });
  };

  const addEjercicio = (dayI) => {
    setPlanEditado(prev => {
      const p = JSON.parse(JSON.stringify(prev));
      p[dayI].entrenamiento.ejercicios.push({ nombre: '', series: 3, reps: '10-12', nota: '' });
      return p;
    });
  };

  const removeEjercicio = (dayI, ejI) => {
    setPlanEditado(prev => {
      const p = JSON.parse(JSON.stringify(prev));
      p[dayI].entrenamiento.ejercicios.splice(ejI, 1);
      return p;
    });
  };

  const updateComida = (dayI, comI, field, val) => {
    setPlanEditado(prev => {
      const p = JSON.parse(JSON.stringify(prev));
      p[dayI].dieta.comidas[comI][field] = val;
      return p;
    });
  };

  const updateMacro = (dayI, field, val) => {
    setPlanEditado(prev => {
      const p = JSON.parse(JSON.stringify(prev));
      p[dayI].dieta[field] = parseInt(val) || 0;
      return p;
    });
  };

  const sendPlanEditado = async () => {
    if (!selectedClient || !planEditado) return;
    setIsSending(true);
    try {
      const token = await getAuthToken();
      // Usar backend con Admin SDK — bypasea reglas de Firestore
      const res = await fetch(`${BACKEND_URL}/coach/guardar-plan-cliente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ clienteId: selectedClient.id, plan: planEditado, daysUnlocked: 7 })
      });
      const data = await res.json();
      if (!data.ok) { showToast('Error al guardar plan: ' + (data.error || ''), 'error'); setIsSending(false); return; }

      // Email con plan formateado
      if (selectedClient.email) {
        try {
          await fetch(`${BACKEND_URL}/enviar-plan-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
            body: JSON.stringify({ clienteId: selectedClient.id })
          });
        } catch(e) {}
        showToast(`✅ Plan enviado y email notificado a ${selectedClient.name}`);
      } else {
        showToast(`✅ Plan enviado a ${selectedClient.name}`);
      }
      track('plan_generated', { clientId: selectedClient.id });
    } catch(e) {
      showToast('No se pudo enviar el plan. Intenta de nuevo.', 'error');
    }
    setIsSending(false);
    setSelectedClient(null);
    setPlanEditado(null);
    setGeneratedPlan('');
  };

  if (selectedClient) return (
    <div className="min-h-screen bg-slate-50 font-sans pb-10">
      {/* Header */}
      <div className="bg-white p-5 shadow-sm sticky top-0 z-20 flex items-center gap-4">
        <button onClick={() => { setSelectedClient(null); setGeneratedPlan(''); setPlanEditado(null); }} className="p-2 bg-slate-100 rounded-2xl"><ChevronLeft className="w-5 h-5"/></button>
        <div className="flex-1">
          <h1 className="font-black text-slate-800">{selectedClient.name}</h1>
          <p className="text-xs text-slate-400 uppercase font-bold">{selectedClient.goals?.objective}</p>
        </div>
        {planEditado && (
          <button onClick={sendPlanEditado} disabled={isSending}
            className="bg-emerald-500 text-white px-4 py-2 rounded-2xl font-black text-sm flex items-center gap-2 active:scale-95 disabled:opacity-50">
            {isSending ? <Loader2 className="w-4 h-4 animate-spin"/> : <><Send className="w-4 h-4"/> Enviar</>}
          </button>
        )}
      </div>

      <div className="p-4 max-w-xl mx-auto space-y-4">
        {/* Métricas del cliente */}
        {clienteMetricas && (
          <div className="space-y-4">
            {/* KPIs principales */}
            <div className="bg-slate-900 rounded-3xl p-5">
              <p className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-4">📊 Seguimiento del cliente</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-slate-800 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-black text-orange-400">🔥{clienteMetricas.racha}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase mt-1">Racha</p>
                </div>
                <div className="bg-slate-800 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-black text-emerald-400">{clienteMetricas.adherenciaSemana}%</p>
                  <p className="text-xs text-slate-400 font-bold uppercase mt-1">Adherencia</p>
                </div>
                <div className="bg-slate-800 rounded-2xl p-3 text-center">
                  <p className="text-xs font-black text-blue-400 leading-tight">{clienteMetricas.ultimoAcceso}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase mt-1">Último acceso</p>
                </div>
              </div>

              {/* Progreso de hoy */}
              <div className="bg-slate-800 rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-black text-slate-400 uppercase">Hoy</p>
                  {clienteMetricas.hoy.review && (
                    <span className="text-lg">{clienteMetricas.hoy.review.label}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">💪 Ejercicios</span>
                      <span className="text-xs font-black text-white">{clienteMetricas.hoy.ejerciciosCompletados}/{clienteMetricas.hoy.totalEjercicios}</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${clienteMetricas.hoy.totalEjercicios > 0 ? (clienteMetricas.hoy.ejerciciosCompletados / clienteMetricas.hoy.totalEjercicios) * 100 : 0}%` }}/>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">🥗 Comidas</span>
                      <span className="text-xs font-black text-white">{clienteMetricas.hoy.comidasRegistradas}/{clienteMetricas.hoy.totalComidas}</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full transition-all"
                        style={{ width: `${clienteMetricas.hoy.totalComidas > 0 ? (clienteMetricas.hoy.comidasRegistradas / clienteMetricas.hoy.totalComidas) * 100 : 0}%` }}/>
                    </div>
                  </div>
                </div>
                {clienteMetricas.hoy.kcalMeta > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                    <span className="text-xs text-slate-400">🔥 Kcal</span>
                    <span className={`text-xs font-black ${clienteMetricas.hoy.kcalRegistradas > clienteMetricas.hoy.kcalMeta ? 'text-red-400' : 'text-orange-400'}`}>
                      {clienteMetricas.hoy.kcalRegistradas} / {clienteMetricas.hoy.kcalMeta}
                    </span>
                  </div>
                )}
              </div>

              {/* Logs de hoy detallados */}
              {clienteMetricas.hoy.logs?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-black text-slate-400 uppercase mb-2">Registros de hoy</p>
                  <div className="space-y-2">
                    {clienteMetricas.hoy.logs.map((log, i) => (
                      <div key={i} className={`rounded-2xl p-3 flex items-center gap-2 ${log.esGustito ? 'bg-pink-500/10 border border-pink-500/20' : log.esAlternativa ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-800'}`}>
                        <span className="text-base">{log.type === 'meal' ? (log.esGustito ? '🍕' : log.esAlternativa ? '🔄' : '🥗') : log.type === 'workout' ? '💪' : '⚖️'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-300 truncate">{log.content?.split('\n')[0]}</p>
                          {log.kcal > 0 && <p className="text-xs text-slate-500">{log.kcal} kcal</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actividad de la semana */}
              {clienteMetricas.actividadSemana?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-black text-slate-400 uppercase mb-2">Actividad — 7 días</p>
                  <div className="flex gap-1">
                    {clienteMetricas.actividadSemana.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className={`w-full h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all ${d.activo ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'}`}>
                          {d.activo ? (d.ejercicios > 0 ? '💪' : '🥗') : '—'}
                        </div>
                        <span className="text-slate-500 text-xs capitalize">{d.dia}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Registros de peso */}
              {clienteMetricas.pesos?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-black text-slate-400 uppercase mb-2">📉 Peso registrado</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {clienteMetricas.pesos.map((p, i) => (
                      <div key={i} className="bg-slate-800 rounded-xl p-2 text-center shrink-0">
                        <p className="text-sm font-black text-white">{p.peso}<span className="text-slate-400 text-xs">kg</span></p>
                        <p className="text-xs text-slate-500">{p.fecha}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fotos de progreso */}
              {clienteMetricas.fotos?.length > 0 && (
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase mb-2">📸 Fotos de progreso</p>
                  <div className="grid grid-cols-2 gap-2">
                    {clienteMetricas.fotos.map((f, i) => (
                      <div key={i} className="relative rounded-2xl overflow-hidden">
                        <img src={f.url} alt="Progreso" className="w-full h-28 object-cover"/>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-white text-xs font-bold">{f.fecha}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Datos del cliente */}
        <SectionCollapse title="Datos del Cliente" icon="👤" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Nombre', val: selectedClient.name },
              { label: 'Edad', val: `${selectedClient.goals?.age} años` },
              { label: 'Peso', val: `${selectedClient.goals?.weight} kg` },
              { label: 'Altura', val: `${selectedClient.goals?.height} cm` },
              { label: 'Actividad', val: selectedClient.goals?.activity },
              { label: 'Equipo', val: selectedClient.goals?.equipment },
              { label: 'Estrés', val: selectedClient.goals?.stressLevel },
              { label: 'Lesiones', val: selectedClient.goals?.injuries || 'Ninguna' },
            ].map(item => (
              <div key={item.label} className="bg-slate-50 p-3 rounded-2xl">
                <p className="text-xs font-bold text-slate-400 uppercase">{item.label}</p>
                <p className="font-black text-slate-700 text-sm mt-0.5">{item.val}</p>
              </div>
            ))}
          </div>
        </SectionCollapse>

        {/* Tiempo límite de entrega */}
        {selectedClient.coachDeadline && selectedClient.currentPlan?.startsWith('⏳') && (() => {
          const now = Date.now();
          const deadline = selectedClient.coachDeadline;
          const isExpired = now > deadline;
          const registeredAt = deadline - 24 * 60 * 60 * 1000;
          const registeredDate = new Date(registeredAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
          const deadlineDate = new Date(deadline).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
          return (
            <div className={`rounded-3xl p-5 border ${isExpired ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-4">
                <Clock className={`w-4 h-4 ${isExpired ? 'text-red-500' : 'text-amber-600'}`} />
                <p className={`text-xs font-black uppercase tracking-widest ${isExpired ? 'text-red-500' : 'text-amber-600'}`}>
                  {isExpired ? '🚨 Tiempo vencido' : '⏳ Compromiso de entrega'}
                </p>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">Se registró:</span>
                  <span className="text-xs font-black text-slate-700">{registeredDate}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">Límite de entrega:</span>
                  <span className={`text-xs font-black ${isExpired ? 'text-red-600' : 'text-slate-700'}`}>{deadlineDate}</span>
                </div>
              </div>
              {isExpired ? (
                <div className="bg-red-100 rounded-2xl p-3 text-center">
                  <p className="text-red-600 font-black text-sm">⚠️ Plan vencido — envíalo cuanto antes</p>
                </div>
              ) : (
                <CountdownTimer deadline={deadline} />
              )}
            </div>
          );
        })()}

        {/* Notas del cliente */}
        {selectedClient.coachNotes && (
          <SectionCollapse title="Notas del Cliente" icon="📝" defaultOpen={false}>
            <p className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">{selectedClient.coachNotes}</p>
          </SectionCollapse>
        )}

        {/* Fotos del cliente */}
        <SectionCollapse title="Fotos de Progreso" icon="📸" defaultOpen={false}>
          <div className="flex justify-end mb-3">
            <button onClick={async () => {
              const cat = prompt('¿Qué categoría de fotos necesitas?\nEj: Avance 1 mes, Fotos laterales...');
              if (!cat) return;
              await updateDoc(doc(db, 'users', selectedClient.id), { photoRequest: cat });
              showToast(`📸 Solicitud enviada — ${cat}`);
            }}
              className="text-xs font-black text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-1">
              <Camera className="w-3 h-3"/> Solicitar fotos
            </button>
          </div>
          <PhotosSection uid={selectedClient.id} isCoach={true} />
        </SectionCollapse>

        {/* Videollamada y Videos */}
        <SectionCollapse title="Videollamada y Videos" icon="📹" defaultOpen={false}>
          <div className="space-y-4 mt-2">
            {/* Configurar enlace Meet/Zoom */}
            <div>
              <p className="text-xs font-black text-slate-500 uppercase mb-2">Enlace de videollamada</p>
              <div className="flex gap-2">
                <input type="url" placeholder="https://meet.google.com/xxx o https://zoom.us/j/xxx"
                  defaultValue={selectedClient.meetLink || ''}
                  id={`meet-${selectedClient.id}`}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-sm font-medium outline-none focus:border-emerald-400"/>
                <button onClick={async () => {
                  const link = document.getElementById(`meet-${selectedClient.id}`)?.value;
                  await updateDoc(doc(db, 'users', selectedClient.id), { meetLink: link });
                  showToast('✅ Enlace guardado');
                }} className="bg-emerald-500 text-white font-black text-xs px-4 rounded-2xl active:scale-95">
                  Guardar
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">El usuario verá este enlace en su sección de chat</p>
            </div>

            {/* Videos de técnica del cliente */}
            {selectedClient.tecnicaVideos?.length > 0 && (
              <div>
                <p className="text-xs font-black text-slate-500 uppercase mb-2">Videos enviados por el cliente ({selectedClient.tecnicaVideos.length})</p>
                <div className="space-y-2">
                  {selectedClient.tecnicaVideos.map((v, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 rounded-2xl p-3">
                      <div>
                        <p className="text-xs font-bold text-slate-700">Video {i + 1}</p>
                        <p className="text-xs text-slate-400">{new Date(v.ts).toLocaleDateString('es-MX')}</p>
                      </div>
                      <a href={v.url} target="_blank" rel="noopener noreferrer"
                        className="bg-blue-500 text-white text-xs font-black px-3 py-2 rounded-xl active:scale-95">
                        Ver video
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!selectedClient.tecnicaVideos?.length && (
              <p className="text-xs text-slate-400 text-center py-2">El cliente aún no ha enviado videos</p>
            )}
          </div>
        </SectionCollapse>

        {/* Mensaje al cliente */}
        <SectionCollapse title="Mensaje al Cliente" icon="💬" defaultOpen={false}>
          <div className="mt-2">
            <CoachMessageWidget client={selectedClient} coachName={user.name || 'Tu Coach'} />
          </div>
        </SectionCollapse>

        {/* Instrucciones del Coach para la IA */}
        <SectionCollapse title="Instrucciones para la IA" icon="🧠" defaultOpen={true}>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-slate-500">Escribe indicaciones específicas que la IA debe considerar al generar el plan.</p>
            
            {/* Combos autopredictivos */}
            <div className="flex flex-wrap gap-1.5">
              {[
                '🔼 Aumentar volumen 20%',
                '🔽 Reducir intensidad esta semana',
                '🦵 Enfocarse en tren inferior',
                '💪 Enfocarse en tren superior',
                '⚡ Semana de descarga',
                '🍗 Aumentar proteína +20g',
                '🚫 Sin sentadillas ni peso muerto',
                '🏠 Solo ejercicios en casa',
                '📈 Progresión de cargas agresiva',
                '🧘 Incluir trabajo de movilidad',
              ].map(combo => (
                <button key={combo} onClick={() => setCoachInstrucciones(prev => prev ? `${prev}\n${combo}` : combo)}
                  className="text-xs font-black bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-slate-600 px-2.5 py-1.5 rounded-xl transition-all active:scale-95">
                  {combo}
                </button>
              ))}
            </div>

            <textarea
              value={coachInstrucciones}
              onChange={e => setCoachInstrucciones(e.target.value)}
              rows={4}
              placeholder="Ej: Esta semana enfócate en hipertrofia de tren superior. Evita sentadillas por dolor de rodilla..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-400 rounded-2xl px-4 py-3 text-sm font-medium outline-none resize-none transition-colors"
            />
            {coachInstrucciones && (
              <button onClick={() => setCoachInstrucciones('')}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold">
                Limpiar instrucciones ✕
              </button>
            )}
          </div>
        </SectionCollapse>

        {/* Historial de Planes */}
        <SectionCollapse title="Historial de Planes" icon="📋" defaultOpen={false}>
          <HistorialPlanes clientId={selectedClient.id} onCargar={(plan) => {
            setPlanEditado(plan);
            setGeneratedPlan(JSON.stringify(plan));
            showToast('✅ Plan anterior cargado');
          }}/>
        </SectionCollapse>

        {/* Botones: Generar con IA / Hacer Manual */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setModoManual(false); generatePlan(); }} disabled={isGenerating}
              className="bg-slate-900 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 text-sm">
              {isGenerating && !modoManual
                ? <><Loader2 className="w-4 h-4 animate-spin"/> Un momento...</>
                : <><Sparkles className="w-4 h-4"/> {planEditado && !modoManual ? 'Regenerar todo' : 'Generar con IA'}</>}
            </button>
            <button onClick={() => {
              setModoManual(true);
            if (!planManual.dias.length) {
              const diasNombres = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
              setPlanManual({
                dias: diasNombres.map(dia => ({
                  dia,
                  entrenamiento: '',
                  dieta: '',
                  kcal: selectedClient.goals?.targetKcal || 2000
                }))
              });
            }
          }}
            className={`py-4 rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95 text-sm border-2 transition-all ${modoManual ? 'bg-emerald-500 text-slate-900 border-emerald-500' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`}>
            <FileText className="w-4 h-4"/> {modoManual ? 'Modo Manual ✓' : 'Hacer Manual'}
          </button>
        </div>

          {/* Botones regenerar por separado — solo si ya hay plan */}
          {planEditado && !modoManual && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={regenerarEntrenamiento} disabled={isGeneratingEntrenamiento}
                className="py-3 bg-blue-500/10 text-blue-600 border border-blue-200 rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 text-xs">
                {isGeneratingEntrenamiento
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/> Un momento...</>
                  : <><Dumbbell className="w-3.5 h-3.5"/> Solo Entrenamiento</>}
              </button>
              <button onClick={regenerarNutricion} disabled={isGeneratingNutricion}
                className="py-3 bg-emerald-500/10 text-emerald-600 border border-emerald-200 rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 text-xs">
                {isGeneratingNutricion
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/> Un momento...</>
                  : <><span>🥗</span> Solo Nutrición</>}
              </button>
            </div>
          )}

        </div>
        {/* Editor Manual por días */}
        {modoManual && planManual.dias.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Plan Manual — Edita día por día</p>

            {/* Selector días */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {planManual.dias.map((d, i) => (
                <button key={i} onClick={() => setSelectedDayCoach(i)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all border ${
                    selectedDayCoach === i ? 'bg-emerald-500 text-slate-900 border-emerald-500 shadow-lg' : 'bg-white text-slate-500 border-slate-100 shadow-sm'
                  }`}>
                  <span className="text-xs font-black uppercase">{diasCortos[i]}</span>
                  {d.entrenamiento ? <Check className="w-3 h-3"/> : <Dumbbell className="w-3.5 h-3.5"/>}
                </button>
              ))}
            </div>

            {/* Editor del día */}
            <div className="bg-slate-900 rounded-3xl overflow-hidden">
              <div className="p-5 border-b border-slate-800">
                <p className="text-emerald-400 text-xs font-black uppercase tracking-widest">{planManual.dias[selectedDayCoach]?.dia}</p>
                <p className="text-white font-black text-base">Editor Manual</p>
              </div>

              {/* Entrenamiento */}
              <div className="p-5 border-b border-slate-800">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Dumbbell className="w-3 h-3"/> Entrenamiento del día
                </label>
                <textarea
                  value={planManual.dias[selectedDayCoach]?.entrenamiento || ''}
                  onChange={e => setPlanManual(prev => {
                    const d = [...prev.dias];
                    d[selectedDayCoach] = {...d[selectedDayCoach], entrenamiento: e.target.value};
                    return {...prev, dias: d};
                  })}
                  placeholder="Ej: Sentadilla 4x8-10, Press banca 3x10, Remo con barra 3x12..."
                  rows={4}
                  className="w-full bg-slate-800 text-slate-300 text-sm font-medium px-4 py-3 rounded-2xl outline-none resize-none placeholder-slate-600 mt-2"
                />
              </div>

              {/* Dieta */}
              <div className="p-5 border-b border-slate-800">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Utensils className="w-3 h-3"/> Plan de comidas
                </label>
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-slate-500 text-xs font-bold">Meta Kcal:</span>
                  <input type="number"
                    value={planManual.dias[selectedDayCoach]?.kcal || ''}
                    onChange={e => setPlanManual(prev => {
                      const d = [...prev.dias];
                      d[selectedDayCoach] = {...d[selectedDayCoach], kcal: parseInt(e.target.value) || 0};
                      return {...prev, dias: d};
                    })}
                    className="w-24 bg-slate-800 text-orange-400 font-black text-sm px-3 py-1.5 rounded-xl outline-none text-center"
                  />
                </div>
                <textarea
                  value={planManual.dias[selectedDayCoach]?.dieta || ''}
                  onChange={e => setPlanManual(prev => {
                    const d = [...prev.dias];
                    d[selectedDayCoach] = {...d[selectedDayCoach], dieta: e.target.value};
                    return {...prev, dias: d};
                  })}
                  placeholder="Desayuno: 3 huevos + avena 50g&#10;Almuerzo: Pollo 150g + arroz 100g&#10;Cena: Atún + camote..."
                  rows={5}
                  className="w-full bg-slate-800 text-slate-300 text-sm font-medium px-4 py-3 rounded-2xl outline-none resize-none placeholder-slate-600 mt-2"
                />
              </div>
            </div>

            {/* Botón enviar plan manual */}
            <button onClick={async () => {
              setIsSending(true);
              await setDoc(doc(db, 'plans', selectedClient.id), {
                plan: planManual,
                daysUnlocked: 3,
                updatedAt: serverTimestamp()
              }, { merge: true });
              await updateDoc(doc(db, 'users', selectedClient.id), { planStatus: 'active' });
              if (selectedClient.email) {
                await sendEmailNotification({ clientName: selectedClient.name, clientEmail: selectedClient.email, coachName: 'Tu Coach' });
              }
              showToast(`✅ Plan manual enviado a ${selectedClient.name}`);
              setIsSending(false);
              setSelectedClient(null);
              setPlanManual({ dias: [] });
              setModoManual(false);
            }} disabled={isSending}
              className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50">
              {isSending ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Send className="w-5 h-5"/> Enviar plan manual a {selectedClient.name}</>}
            </button>
          </div>
        )}

        {/* Editor por días */}
        {planEditado && (
          <SectionCollapse title="Editor de Plan" icon="🏋️" defaultOpen={true} badge={`${planEditado.length} días`}>
            <div className="space-y-3 mt-2">

            {/* Selector de días */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {planEditado.map((d, i) => {
                const isRest = !d.entrenamiento?.ejercicios?.length;
                return (
                  <button key={i} onClick={() => setSelectedDayCoach(i)}
                    className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all border ${
                      selectedDayCoach === i ? 'bg-slate-900 text-white border-slate-900 shadow-lg' :
                      'bg-white text-slate-500 border-slate-100 shadow-sm'
                    }`}>
                    <span className="text-xs font-black uppercase">{diasCortos[i]}</span>
                    {isRest ? <span className="text-xs">😴</span> : <Dumbbell className="w-3.5 h-3.5"/>}
                  </button>
                );
              })}
            </div>

            {/* Panel edición del día */}
            {(() => {
              const dia = planEditado[selectedDayCoach];
              const tieneEj = dia?.entrenamiento?.ejercicios?.length > 0;
              return (
                <div className="bg-slate-900 rounded-3xl overflow-hidden">
                  {/* Header día */}
                  <div className="p-5 border-b border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-emerald-400 text-xs font-black uppercase tracking-widest">{dia?.dia}</p>
                        <p className="text-white font-black text-base">{tieneEj ? '🏋️ Día de Entreno' : '😴 Descanso'}</p>
                      </div>
                      <button
                        onClick={() => {
                          setPlanEditado(prev => {
                            const p = JSON.parse(JSON.stringify(prev));
                            if (p[selectedDayCoach].entrenamiento.ejercicios.length > 0) {
                              p[selectedDayCoach].entrenamiento.ejercicios = [];
                            } else {
                              p[selectedDayCoach].entrenamiento.ejercicios = [{ nombre: '', series: 3, reps: '10-12', nota: '' }];
                            }
                            return p;
                          });
                        }}
                        className="text-xs font-black px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all">
                        {tieneEj ? '→ Descanso' : '→ Entreno'}
                      </button>
                    </div>
                    {/* Clonar este día a otro */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-500 font-bold">Copiar a:</span>
                      {diasCortos.map((d, idx) => idx !== selectedDayCoach && (
                        <button key={idx} onClick={() => {
                          setPlanEditado(prev => {
                            const p = JSON.parse(JSON.stringify(prev));
                            p[idx].entrenamiento = JSON.parse(JSON.stringify(p[selectedDayCoach].entrenamiento));
                            p[idx].dieta = JSON.parse(JSON.stringify(p[selectedDayCoach].dieta));
                            return p;
                          });
                          showToast(`✅ ${dias[selectedDayCoach]} copiado a ${dias[idx]}`);
                        }}
                          className="text-xs font-black px-2.5 py-1 rounded-xl bg-slate-800 text-slate-400 hover:bg-emerald-500/20 hover:text-emerald-400 transition-all active:scale-95">
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ejercicios editables */}
                  {tieneEj && (
                    <div className="p-5 border-b border-slate-800">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Dumbbell className="w-3 h-3"/> Ejercicios
                      </h4>
                      <div className="space-y-3">
                        {dia.entrenamiento.ejercicios.map((ej, ei) => (
                          <div key={ei} className="bg-slate-800 rounded-2xl p-4 space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                value={ej.nombre}
                                onChange={e => updateEjercicio(selectedDayCoach, ei, 'nombre', e.target.value)}
                                placeholder="Nombre del ejercicio"
                                className="flex-1 bg-slate-700 text-white text-sm font-bold px-3 py-2 rounded-xl outline-none placeholder-slate-500"
                              />
                              <button onClick={() => removeEjercicio(selectedDayCoach, ei)}
                                className="w-8 h-8 flex items-center justify-center bg-red-900/40 text-red-400 rounded-xl shrink-0">
                                <Minus className="w-3.5 h-3.5"/>
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <p className="text-xs text-slate-500 font-bold uppercase mb-1">Series</p>
                                <input type="number" value={ej.series}
                                  onChange={e => updateEjercicio(selectedDayCoach, ei, 'series', parseInt(e.target.value) || 0)}
                                  className="w-full bg-slate-700 text-white text-sm font-bold px-3 py-2 rounded-xl outline-none text-center"
                                />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-slate-500 font-bold uppercase mb-1">Reps</p>
                                <input value={ej.reps}
                                  onChange={e => updateEjercicio(selectedDayCoach, ei, 'reps', e.target.value)}
                                  className="w-full bg-slate-700 text-white text-sm font-bold px-3 py-2 rounded-xl outline-none text-center"
                                />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-slate-500 font-bold uppercase mb-1">Nota</p>
                                <input value={ej.nota || ''}
                                  onChange={e => updateEjercicio(selectedDayCoach, ei, 'nota', e.target.value)}
                                  placeholder="opcional"
                                  className="w-full bg-slate-700 text-white text-xs px-3 py-2 rounded-xl outline-none placeholder-slate-600"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => addEjercicio(selectedDayCoach)}
                        className="mt-3 w-full py-2.5 border border-dashed border-slate-700 rounded-2xl text-slate-500 text-xs font-bold flex items-center justify-center gap-2 hover:border-emerald-600 hover:text-emerald-400 transition-all">
                        <Plus className="w-3.5 h-3.5"/> Agregar ejercicio
                      </button>
                    </div>
                  )}

                  {/* Macros editables */}
                  <div className="p-5 border-b border-slate-800">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Macros del Día</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Kcal', field: 'kcal', color: 'text-orange-400' },
                        { label: 'Prot(g)', field: 'proteina', color: 'text-blue-400' },
                        { label: 'Carbs(g)', field: 'carbs', color: 'text-yellow-400' },
                        { label: 'Gras(g)', field: 'grasas', color: 'text-pink-400' },
                      ].map(m => (
                        <div key={m.field} className="bg-slate-800 rounded-2xl p-2 text-center">
                          <p className={`text-xs font-bold uppercase mb-1 ${m.color}`}>{m.label}</p>
                          <input type="number"
                            value={dia.dieta?.[m.field] || ''}
                            onChange={e => updateMacro(selectedDayCoach, m.field, e.target.value)}
                            className="w-full bg-slate-700 text-white text-sm font-black px-2 py-1.5 rounded-xl outline-none text-center"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Comidas editables */}
                  <div className="p-5">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Utensils className="w-3 h-3"/> Comidas
                    </h4>
                    <div className="space-y-3">
                      {dia.dieta?.comidas?.map((c, ci) => (
                        <div key={ci} className="bg-slate-800 rounded-2xl p-4 space-y-2">
                          <input
                            value={c.momento}
                            onChange={e => updateComida(selectedDayCoach, ci, 'momento', e.target.value)}
                            placeholder="Momento (ej. Desayuno)"
                            className="w-full bg-slate-700 text-orange-400 text-xs font-black px-3 py-1.5 rounded-xl outline-none uppercase placeholder-slate-600"
                          />
                          <textarea
                            value={c.descripcion}
                            onChange={e => updateComida(selectedDayCoach, ci, 'descripcion', e.target.value)}
                            placeholder="Descripción de la comida"
                            rows={2}
                            className="w-full bg-slate-700 text-slate-300 text-xs font-medium px-3 py-2 rounded-xl outline-none resize-none placeholder-slate-600"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Botón enviar abajo también */}
            <button onClick={sendPlanEditado} disabled={isSending}
              className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50">
              {isSending ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Send className="w-5 h-5"/> Enviar plan a {selectedClient.name}</>}
            </button>
            </div>
          </SectionCollapse>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Banner de modo demo */}
      {user.isDemo && (
        <div className="bg-amber-500 px-4 py-2 flex items-center justify-between">
          <p className="text-white text-xs font-black">🎭 MODO DEMO — Los datos se borrarán en 24h</p>
          <button onClick={() => signOut(auth)} className="text-white text-xs font-black bg-amber-600 px-3 py-1 rounded-xl">
            Salir
          </button>
        </div>
      )}
      <div className="bg-slate-900 p-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Panel Exclusivo</p>
            <h1 className="text-2xl font-black">Coach Dashboard</h1>
          </div>
          <button onClick={() => signOut(auth)} className="bg-slate-800 p-3 rounded-2xl"><LogOut className="w-5 h-5"/></button>
        </div>
        <div className="mt-4 bg-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-xl"><Users className="w-5 h-5 text-slate-900"/></div>
          <div>
            <p className="text-xs text-slate-400 font-bold">Clientes con Coach</p>
            <p className="font-black text-xl">{clients.length}</p>
          </div>
        </div>
      </div>
      <div className="p-4 max-w-xl mx-auto">
        {/* Barra de búsqueda y filtros */}
        <div className="space-y-2 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
            <input type="text" placeholder="Buscar por nombre, email..."
              value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl pl-9 pr-4 py-3 text-sm font-medium outline-none focus:border-emerald-400"/>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <select value={filtroObjetivo} onChange={e => setFiltroObjetivo(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none shrink-0">
              <option value="">🎯 Todos los objetivos</option>
              <option value="Pérdida de Grasa">Pérdida de Grasa</option>
              <option value="Ganancia Muscular">Ganancia Muscular</option>
              <option value="Recomposición">Recomposición</option>
              <option value="Mantenimiento">Mantenimiento</option>
            </select>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none shrink-0">
              <option value="">📋 Todos los status</option>
              <option value="active">Plan Enviado</option>
              <option value="pending">Pendiente</option>
            </select>
            <select value={filtroPremium} onChange={e => setFiltroPremium(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none shrink-0">
              <option value="">⭐ Todos</option>
              <option value="premium">Premium</option>
              <option value="free">Free</option>
            </select>
            {(filtroTexto || filtroObjetivo || filtroStatus || filtroPremium) && (
              <button onClick={() => { setFiltroTexto(''); setFiltroObjetivo(''); setFiltroStatus(''); setFiltroPremium(''); }}
                className="bg-red-50 text-red-500 border border-red-200 rounded-xl px-3 py-2 text-xs font-bold shrink-0">
                Limpiar ✕
              </button>
            )}
          </div>
        </div>

        <h2 className="font-black text-xs uppercase text-slate-400 mb-4 mt-2">Clientes</h2>

        {/* Dashboard métricas generales */}
        {dashMetricas && (
          <div className="bg-slate-900 rounded-3xl p-5 mb-4">
            <p className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-4">📊 Resumen de hoy</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-800 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-white">{dashMetricas.totalClientes}</p>
                <p className="text-xs text-slate-400 font-bold uppercase mt-1">Total clientes</p>
              </div>
              <div className="bg-slate-800 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-emerald-400">{dashMetricas.adherenciaPromedio}%</p>
                <p className="text-xs text-slate-400 font-bold uppercase mt-1">Adherencia semana</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-900/30 border border-emerald-700/30 rounded-2xl p-3 text-center">
                <p className="text-xl font-black text-emerald-400">{dashMetricas.hoy?.entrenarонHoy || 0}</p>
                <p className="text-xs text-slate-400 font-bold uppercase mt-0.5">Entrenaron hoy</p>
              </div>
              <div className="bg-orange-900/30 border border-orange-700/30 rounded-2xl p-3 text-center">
                <p className="text-xl font-black text-orange-400">{dashMetricas.hoy?.registraronComidaHoy || 0}</p>
                <p className="text-xs text-slate-400 font-bold uppercase mt-0.5">Comidas hoy</p>
              </div>
              <div className="bg-red-900/30 border border-red-700/30 rounded-2xl p-3 text-center">
                <p className="text-xl font-black text-red-400">{dashMetricas.hoy?.sinActividad || 0}</p>
                <p className="text-xs text-slate-400 font-bold uppercase mt-0.5">Sin actividad</p>
              </div>
            </div>
            <div className="flex gap-3 mt-3">
              <div className="flex-1 bg-slate-800 rounded-2xl p-3 text-center">
                <p className="text-lg font-black text-white">{dashMetricas.activos}</p>
                <p className="text-xs text-slate-400 font-bold uppercase">Con plan activo</p>
              </div>
              <div className="flex-1 bg-slate-800 rounded-2xl p-3 text-center">
                <p className="text-lg font-black text-amber-400">{dashMetricas.pendientes}</p>
                <p className="text-xs text-slate-400 font-bold uppercase">Pendientes</p>
              </div>
            </div>
          </div>
        )}

        {/* Link de referido */}
        <ReferidoWidget coachUid={user.uid} />

        {loadingClientes ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <SkeletonCard key={i} lines={3}/>)}
          </div>
        ) : (() => {
          const clientesFiltrados = clients.filter(c => {
            const texto = filtroTexto.toLowerCase();
            if (texto && !c.name?.toLowerCase().includes(texto) && !c.email?.toLowerCase().includes(texto)) return false;
            if (filtroObjetivo && c.goals?.objective !== filtroObjetivo) return false;
            if (filtroStatus && c.planStatus !== filtroStatus) return false;
            if (filtroPremium === 'premium' && !c.premium) return false;
            if (filtroPremium === 'free' && c.premium) return false;
            return true;
          });

          if (clientesFiltrados.length === 0) return (
            <div className="text-center py-12 text-slate-400">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30"/>
              <p className="font-bold">Sin resultados para estos filtros</p>
            </div>
          );

          return (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 font-bold">{clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? 's' : ''} encontrado{clientesFiltrados.length !== 1 ? 's' : ''}</p>
              {clientesFiltrados.map(client => (
              <button key={client.id} onClick={() => setSelectedClient(client)} className="w-full bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between active:scale-95 transition-all">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 w-12 h-12 rounded-2xl flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600"/>
                  </div>
                  <div className="text-left">
                    <p className="font-black text-slate-800">{client.name}</p>
                    <p className="text-xs text-slate-400 font-bold uppercase">{client.goals?.objective || 'Sin objetivo'}</p>
                    {client.coachDeadline && client.planStatus === 'pending' && (
                      <div className="mt-1.5">
                        <CountdownTimer deadline={client.coachDeadline} compact />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {client.planStatus === 'active' ? (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-black">Plan Enviado</span>
                  ) : (
                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-black">Pendiente</span>
                  )}
                  <ChevronRight className="w-5 h-5 text-slate-300"/>
                </div>
              </button>
            ))}
            {hasMore && (
              <button onClick={() => cargarClientes(false)} disabled={loadingMore}
                className="w-full py-4 bg-slate-100 text-slate-600 font-black text-sm rounded-3xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {loadingMore ? <><Loader2 className="w-4 h-4 animate-spin"/> Cargando...</> : <>Cargar más clientes ({clients.length} mostrados)</>}
              </button>
            )}
          </div>
          );
        })()}
      </div>
    </div>
  );
};

export default CoachDashboard;
