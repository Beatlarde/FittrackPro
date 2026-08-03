import { useState, useEffect, useRef } from 'react';
import { Users, Activity, CheckCircle, Dumbbell, Sparkles, Loader2, Brain, FileText, Check, Flame, ArrowRight, ChevronLeft, Trophy, Target } from 'lucide-react';
import { db } from '../../firebase';
import { doc, setDoc, serverTimestamp, getDoc, deleteDoc } from 'firebase/firestore';
import { BACKEND_URL } from '../../config/constants';
import { track } from '../../utils/analytics';
import { callAgenteEntrenamiento, getAuthToken } from '../../services/api';
import CountdownTimer from '../shared/CountdownTimer';

const OnboardingFlow = ({ user, onComplete, refCoach = null }) => {
  const [step, setStep] = useState(refCoach ? 1.5 : 1); useEffect(() => { track('onboarding_started', { refCoach: !!refCoach }); }, []);
  const [userData, setUserData] = useState({
    name: '', age: '', objective: 'Pérdida de Grasa', targetKcal: 0,
    weight: '', height: '', activity: 'Moderado', activityLevel: 50,
    injuries: '', stressLevel: 'Medio', equipment: 'Gym Completo', 
    bodyType: 'Mesomorfo', gender: 'masculino',
    proteina: 0, carbs: 0, grasas: 0
  });
  const [loading, setLoading] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [hasSigned, setHasSigned] = useState(false);
  const [modalidad, setModalidad] = useState(refCoach ? 'coach' : '');

  // Canvas firma
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef(null);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e, canvasRef.current);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
    setHasSigned(true);
  };

  const endDraw = () => { isDrawing.current = false; };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const saveOnboarding = async () => {
    setLoading(true);
    try {
      const lesionesTexto = userData.injuries?.trim();
      const restricciones = lesionesTexto ? `
⚠️ RESTRICCIONES CRÍTICAS — OBLIGATORIO RESPETAR:
El usuario reporta: "${lesionesTexto}"
- PROHIBIDO incluir ejercicios que carguen, compriman o flexionen en exceso las zonas afectadas
- SUSTITUIR por variantes de bajo impacto o movimientos alternativos seguros
- Esta restricción aplica a TODOS los días del plan sin excepción` : '';

      const promptIA = `Crea un plan de entrenamiento y nutrición semanal para este cliente. Responde ÚNICAMENTE con el JSON, sin texto adicional, sin markdown, sin explicaciones.

Cliente:
- Nombre: ${userData.name}, ${userData.age} años, ${userData.gender === 'femenino' ? 'Mujer' : 'Hombre'}
- Meta: ${userData.objective} (${userData.targetKcal} kcal/día)
- Macros objetivo: ${userData.proteina}g proteína, ${userData.carbs}g carbohidratos, ${userData.grasas}g grasas
- Datos Físicos: ${userData.weight}kg, ${userData.height}cm, Tipo de cuerpo: ${userData.bodyType || 'No especificado'}
- Actividad: ${userData.activity} (nivel ${userData.activityLevel ?? 50}%)
- Equipo: ${userData.equipment}
- Salud: Lesiones(${userData.injuries || 'Ninguna'}), Estrés(${userData.stressLevel})
${restricciones}
Estructura exacta por día — "calentamiento" y "ejercicios" son arrays SEPARADOS:
{"dia":"Lunes","entrenamiento":{"calentamiento":[{"nombre":"Rotación de cadera","duracion":"30 seg"},{"nombre":"Sentadilla sin peso","duracion":"10 reps"}],"ejercicios":[{"nombre":"Sentadilla con Barra","series":4,"reps":"8-10","nota":"Espalda recta"}]},"dieta":{"kcal":2000,"proteina":150,"carbs":200,"grasas":60,"comidas":[{"momento":"Desayuno","descripcion":"3 huevos con avena"}]}}
CRÍTICO: calentamiento = activación/movilidad (4-6 movimientos). ejercicios = SOLO fuerza/hipertrofia con series y reps. NUNCA mezcles ambos.
Genera los 7 días (Lunes a Domingo). Solo el JSON.`;

      const generatedPlan = await callAgenteEntrenamiento(promptIA, {
        nombre: userData.name, objetivo: userData.objective, peso: userData.weight,
        altura: userData.height, actividad: userData.activity, equipo: userData.equipment,
        lesiones: userData.injuries
      }, user.uid);

      if (!generatedPlan || generatedPlan.startsWith('⚠️')) {
        console.error('Error generando plan:', generatedPlan);
        setLoading(false);
        return;
      }

      // Guardar datos del usuario SIN el plan (documento ligero)
      await setDoc(doc(db, 'users', user.uid), {
        onboardingComplete: true,
        modalidad: refCoach ? 'coach' : modalidad,
        name: userData.name,
        email: user.email,
        goals: userData,
        coachNotes: userData.coachNotes || '',
        planStatus: modalidad === 'ia' ? 'active' : 'pending',
        mealTimes: userData.mealTimes || { desayuno: '08:00', comida: '14:00', cena: '20:00' },
        ...((refCoach || modalidad === 'coach') ? { coachDeadline: Date.now() + 24 * 60 * 60 * 1000 } : {}),
        ...(refCoach ? { refCoachId: refCoach.coachId, refCoachCode: refCoach.coachCode } : {})
      }, { merge: true });

      // Guardar plan en su propia colección
      if (modalidad === 'ia') {
        try {
          const cleanPlan = generatedPlan.replace(/```json/g, '').replace(/```/g, '').trim();
          const planArray = JSON.parse(cleanPlan);
          const startDayIndex = (new Date().getDay() + 6) % 7; // 0=Lun...6=Dom
          await setDoc(doc(db, 'plans', user.uid), {
            plan: planArray,
            daysUnlocked: 3,
            startDayIndex,
            createdAt: serverTimestamp()
          });
        } catch {
          const startDayIndex = (new Date().getDay() + 6) % 7;
          await setDoc(doc(db, 'plans', user.uid), {
            planRaw: generatedPlan,
            daysUnlocked: 3,
            startDayIndex,
            createdAt: serverTimestamp()
          });
        }
      }

      setLoading(false);
      setAnalysisStage(4);
      track('onboarding_complete', { modalidad, objetivo: userData.objective, equipo: userData.equipment });

      // Verificar si tiene premium pendiente de Hotmart
      try {
        const pendiente = await getDoc(doc(db, 'premiumPendiente', user.email));
        if (pendiente.exists()) {
          await setDoc(doc(db, 'users', user.uid), { premium: true, premiumStatus: 'authorized', premiumSource: 'hotmart' }, { merge: true });
          await deleteDoc(doc(db, 'premiumPendiente', user.email));
        }
      } catch {}

      // Limpiar refCoach pendiente
      localStorage.removeItem('pendingRefCoach');
      // Notificar al coach si el usuario fue referido
      if (refCoach?.coachId) {
        fetch(`${BACKEND_URL}/notificar-nuevo-cliente`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coachId: refCoach.coachId, clientName: userData.name, clientEmail: user.email })
        }).catch(() => {});
      }
      // Enviar mensaje de bienvenida automático
      fetch(`${BACKEND_URL}/mensaje-bienvenida`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: user.uid }) }).catch(() => {});
      onComplete();
    } catch (error) {
      console.error("Error guardando onboarding:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === 6) {
      const t1 = setTimeout(() => setAnalysisStage(1), 1200);
      const t2 = setTimeout(() => setAnalysisStage(2), 2400);
      const t3 = setTimeout(() => setAnalysisStage(3), 3600);
      const t4 = setTimeout(() => saveOnboarding(), 5000);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }
  }, [step]);

  // Barra de progreso (steps 2-5)
  const ProgressBar = ({ current, total = 4 }) => (
    <div className="flex gap-1.5 w-full">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i < current ? 'bg-emerald-500' : 'bg-slate-200'}`} />
      ))}
    </div>
  );

  // Header consistente para pasos 2-5
  const StepHeader = ({ onBack, current, total, label }) => (
    <div className="flex items-center gap-4 mb-8">
      <button onClick={onBack} className="p-2.5 bg-white rounded-2xl shadow-sm border border-slate-100 shrink-0 active:scale-95">
        <ChevronLeft className="w-5 h-5 text-slate-600"/>
      </button>
      <div className="flex-1">
        <ProgressBar current={current} total={total} />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1.5">{label}</p>
      </div>
    </div>
  );

  // ── STEP 1: SPLASH ──
  if (step === 1) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden animate-in fade-in">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-emerald-400/8 rounded-full blur-3xl"></div>
      </div>
      <div className="z-10 text-center space-y-6 w-full max-w-sm">
        <div className="bg-emerald-500 p-5 rounded-3xl inline-block shadow-2xl shadow-emerald-500/30 mb-2">
          <Dumbbell className="text-slate-900 w-12 h-12" />
        </div>
        <h1 className="text-5xl font-black text-white leading-tight tracking-tighter">FitTrack <span className="text-emerald-400">Pro</span></h1>
        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full inline-block">
          <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase flex items-center gap-2"><Sparkles className="w-3 h-3"/> Elite AI Performance</span>
        </div>
        <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">Programas personalizados y nutrición inteligente diseñados para tu perfil único.</p>
        <button onClick={() => { setStep(1.5); track('onboarding_step', { step: 1, name: 'modalidad' }); }}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black py-5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-emerald-500/20 mt-6">
          Comenzar transformación <ArrowRight className="w-5 h-5" />
        </button>
        <p className="text-slate-600 text-xs">Solo toma 3 minutos configurar tu perfil</p>
      </div>
    </div>
  );

  // ── STEP 1.5: MODALIDAD ──
  if (step === 1.5) return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col animate-in slide-in-from-right">
      {!refCoach && <StepHeader onBack={() => setStep(1)} current={0} total={4} label="Elige tu modalidad" />}
      
      {/* Banner de referido */}
      {refCoach && (
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl p-5 mb-6 text-white text-center">
          <span className="text-3xl">👋</span>
          <h2 className="font-black text-xl mt-2">¡Bienvenido!</h2>
          <p className="text-blue-100 text-sm mt-1">
            <span className="font-black text-white">{refCoach.coachName}</span> te ha invitado a entrenar con su programa personalizado
          </p>
          <div className="bg-white/20 rounded-2xl px-4 py-2 mt-3 inline-block">
            <p className="text-xs font-bold">Tu coach ya está listo para crear tu plan</p>
          </div>
        </div>
      )}

      {!refCoach && <h2 className="text-3xl font-black text-slate-800 mb-2">¿Cómo quieres entrenar?</h2>}
      {!refCoach && <p className="text-slate-500 mb-8 text-sm">Elige la experiencia que mejor se adapte a ti.</p>}
      {refCoach && <h2 className="text-3xl font-black text-slate-800 mb-2">Cuéntanos sobre ti</h2>}
      {refCoach && <p className="text-slate-500 mb-6 text-sm">Tu coach necesita estos datos para crear tu plan personalizado.</p>}
      
      {!refCoach && <div className="space-y-4 flex-1">
        {[
          { id: 'ia', icon: Brain, color: 'emerald', title: 'Full IA', badge: 'Inmediato', desc: 'Gemini genera tu plan al instante', features: ['Plan en segundos', 'Disponible 24/7', 'Ajustes automáticos'] },
          { id: 'coach', icon: Users, color: 'blue', title: 'Coach Humano', badge: 'Premium', desc: 'Un experto personaliza tu plan', features: ['Plan revisado por profesional', 'Seguimiento personalizado', 'Ajustes según progreso real'] },
        ].map(opt => {
          const Icon = opt.icon;
          const isSelected = modalidad === opt.id;
          return (
            <button key={opt.id} onClick={() => { setModalidad(opt.id); setStep(2); track('onboarding_step', { step: 2, name: 'datos_base' }); }}
              className={`w-full p-6 rounded-3xl border-2 text-left transition-all active:scale-95 ${isSelected ? `border-${opt.color}-500 bg-white shadow-lg` : 'border-transparent bg-white shadow-sm hover:shadow-md'}`}>
              <div className="flex items-center gap-4 mb-4">
                <div className={`bg-${opt.color}-100 p-4 rounded-2xl`}><Icon className={`w-7 h-7 text-${opt.color}-600`}/></div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-black text-slate-800 text-lg">{opt.title}</p>
                    <span className={`text-xs bg-${opt.color}-500 text-white px-2 py-0.5 rounded-full font-black uppercase`}>{opt.badge}</span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">{opt.desc}</p>
                </div>
              </div>
              <div className="space-y-1.5 ml-16">
                {opt.features.map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <CheckCircle className={`w-3.5 h-3.5 text-${opt.color}-500 shrink-0`}/>
                    <span className="text-xs text-slate-600 font-medium">{f}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>}
      
      {refCoach && (
        <button onClick={() => setStep(2)}
          className="w-full bg-blue-500 text-white font-black py-4 rounded-3xl active:scale-95 transition-all shadow-lg mt-auto">
          Comenzar mi evaluación →
        </button>
      )}
    </div>
  );

  // ── STEP 2: DATOS BASE ──
  if (step === 2) return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col animate-in slide-in-from-right">
      <StepHeader onBack={() => setStep(1.5)} current={1} total={4} label="Paso 1 de 4 — Datos base" />
      <h2 className="text-3xl font-black text-slate-800 mb-1">Tus Datos Base</h2>
      <p className="text-slate-500 text-sm mb-6">Necesitamos conocerte para personalizar tu plan.</p>
      <div className="space-y-3 flex-1">
        {/* Género */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
          <label className="block text-xs font-black text-slate-400 uppercase mb-3 tracking-wider">Sexo Biológico</label>
          <div className="grid grid-cols-2 gap-2">
            {[{ val: 'masculino', emoji: '♂️', label: 'Hombre' }, { val: 'femenino', emoji: '♀️', label: 'Mujer' }].map(g => (
              <button key={g.val} onClick={() => setUserData(prev => ({ ...prev, gender: g.val }))}
                className={`py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${userData.gender === g.val ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500'}`}>
                {g.emoji} {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
          <label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-wider">Objetivo Principal</label>
          <select className="w-full text-lg font-black outline-none bg-transparent text-slate-800" value={userData.objective} onChange={e => setUserData({...userData, objective: e.target.value})}>
            <option>Pérdida de Grasa</option>
            <option>Ganancia Muscular</option>
            <option>Recomposición</option>
            <option>Mantenimiento</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
            <label className="block text-xs font-black text-slate-400 uppercase mb-1 tracking-wider">Nombre</label>
            <input className="w-full text-xl font-black outline-none focus:ring-2 focus:ring-emerald-400 text-slate-800 mt-1" placeholder="Tu nombre" type="text" value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})}/>
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
            <label className="block text-xs font-black text-slate-400 uppercase mb-1 tracking-wider">Edad</label>
            <input className="w-full text-2xl font-black outline-none focus:ring-2 focus:ring-emerald-400 text-slate-800 mt-1" placeholder="25" type="number" value={userData.age} onChange={e => setUserData({...userData, age: e.target.value})}/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
            <label className="block text-xs font-black text-slate-400 uppercase mb-1 tracking-wider">Peso (kg)</label>
            <input className="w-full text-2xl font-black outline-none focus:ring-2 focus:ring-emerald-400 text-slate-800 mt-1" placeholder="70" type="number" value={userData.weight} onChange={e => setUserData({...userData, weight: e.target.value})}/>
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
            <label className="block text-xs font-black text-slate-400 uppercase mb-1 tracking-wider">Altura (cm)</label>
            <input className="w-full text-2xl font-black outline-none focus:ring-2 focus:ring-emerald-400 text-slate-800 mt-1" placeholder="170" type="number" value={userData.height} onChange={e => setUserData({...userData, height: e.target.value})}/>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
          <label className="block text-xs font-black text-slate-400 uppercase mb-3 tracking-wider">Nivel de Actividad</label>
          {(() => {
            const niveles = [
              { val: 0, label: 'Sedentario', emoji: '🪑', desc: 'Paso la mayoría del día sentado, menos de 1,000 pasos diarios', mult: 1.2 },
              { val: 25, label: 'Poca actividad', emoji: '🚶', desc: 'Camino algo, trabajo de oficina, 1-3 días de ejercicio ligero', mult: 1.375 },
              { val: 50, label: 'Moderado', emoji: '🏃', desc: 'Ejercicio 3-5 días por semana, trabajo activo', mult: 1.55 },
              { val: 75, label: 'Activo', emoji: '💪', desc: 'Entrenamiento intenso 5-6 días, trabajo físico', mult: 1.725 },
              { val: 100, label: 'Atleta', emoji: '🏆', desc: 'Doble sesión diaria o trabajo físico muy exigente', mult: 1.9 },
            ];
            const currentVal = parseInt(userData.activityLevel ?? 50);
            const currentNivel = niveles.reduce((prev, curr) => Math.abs(curr.val - currentVal) < Math.abs(prev.val - currentVal) ? curr : prev);
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xl">{currentNivel.emoji}</span>
                  <span className="font-black text-slate-800 text-sm">{currentNivel.label}</span>
                  <span className="text-slate-400 text-xs font-bold">{currentVal}%</span>
                </div>
                <input type="range" min="0" max="100" step="25" value={currentVal}
                  onChange={e => {
                    const v = parseInt(e.target.value);
                    const n = niveles.reduce((prev, curr) => Math.abs(curr.val - v) < Math.abs(prev.val - v) ? curr : prev);
                    setUserData(prev => ({ ...prev, activityLevel: v, activity: n.label }));
                  }}
                  className="w-full accent-emerald-500 h-2 rounded-full"/>
                <div className="flex justify-between text-xs text-slate-400 font-bold -mt-1">
                  {niveles.map(n => <span key={n.val}>{n.emoji}</span>)}
                </div>
                <div className="bg-slate-50 rounded-2xl p-3">
                  <p className="text-xs text-slate-600 font-medium">{currentNivel.desc}</p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      <button
        onClick={async () => {
          const w = parseFloat(userData.weight), h = parseFloat(userData.height), a = parseInt(userData.age);
          if (w && h && a) {
            try {
              const token = await getAuthToken();
              const res = await fetch(`${BACKEND_URL}/calcular-macros`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                body: JSON.stringify({ weight: w, height: h, age: a, gender: userData.gender, activity: userData.activity, objective: userData.objective, bodyType: userData.bodyType })
              });
              const data = await res.json();
              if (data.kcal) setUserData(prev => ({ ...prev, targetKcal: data.kcal, proteina: data.proteina, carbs: data.carbs, grasas: data.grasas }));
            } catch {
              // Fallback local si el backend falla
              const bmr = userData.gender === 'femenino' ? (10*w)+(6.25*h)-(5*a)-161 : (10*w)+(6.25*h)-(5*a)+5;
              const mult = { 'Sedentario':1.2,'Poca actividad':1.375,'Moderado':1.55,'Activo':1.725,'Atleta':1.9 };
              const tdee = Math.round(bmr * (mult[userData.activity] || 1.55));
              const ajuste = {'Pérdida de Grasa':-400,'Ganancia Muscular':300,'Recomposición':-150,'Mantenimiento':0};
              const kcal = tdee + (ajuste[userData.objective] || 0);
              const proteina = Math.round(w * 2.2), grasas = Math.round(w * 0.8);
              const carbs = Math.max(Math.round((kcal-(proteina*4)-(grasas*9))/4), 50);
              setUserData(prev => ({ ...prev, targetKcal: kcal, proteina, carbs, grasas }));
            }
          }
          setStep(3); track('onboarding_step', { step: 3, name: 'salud' });
        }}
        disabled={!userData.name || !userData.age || !userData.weight || !userData.height}
        className="w-full bg-slate-900 py-4 rounded-2xl font-black text-white mt-4 shadow-xl active:scale-95 disabled:opacity-40 transition-all">
        Continuar →
      </button>
    </div>
  );

  // ── STEP 3: SALUD ──
  if (step === 3) return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col animate-in slide-in-from-right">
      <StepHeader onBack={() => setStep(2)} current={2} total={4} label="Paso 2 de 4 — Salud" />
      <h2 className="text-3xl font-black text-slate-800 mb-1">Salud y Seguridad</h2>
      <p className="text-slate-500 text-sm mb-6">Tu plan se ajustará para proteger tus articulaciones y recuperación.</p>
      <div className="space-y-4 flex-1">
        {/* Tipo de cuerpo */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
          <label className="block text-xs font-black text-slate-400 uppercase mb-3 tracking-wider">¿Cómo describes tu metabolismo?</label>
          <div className="space-y-2">
            {[
              { val: 'Ectomorfo', emoji: '⚡', desc: 'Bajo peso fácilmente, cuesta ganar músculo' },
              { val: 'Mesomorfo', emoji: '💪', desc: 'Gano músculo y pierdo grasa con relativa facilidad' },
              { val: 'Endomorfo', emoji: '🏋️', desc: 'Me cuesta trabajo bajar de peso, tiendo a acumular grasa' },
            ].map(t => (
              <button key={t.val} onClick={() => setUserData(prev => ({ ...prev, bodyType: t.val }))}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${userData.bodyType === t.val ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                <span className="text-xl">{t.emoji}</span>
                <div className="text-left">
                  <p className="font-black text-sm">{t.val}</p>
                  <p className={`text-[11px] ${userData.bodyType === t.val ? 'text-slate-300' : 'text-slate-400'}`}>{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
          <label className="block text-xs font-black text-slate-400 uppercase mb-3 tracking-wider flex items-center gap-2"><Activity className="w-3.5 h-3.5"/> Lesiones o molestias</label>
          <textarea className="w-full bg-slate-50 p-4 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 h-28 resize-none" placeholder="Ej: Dolor en rodilla derecha, espalda baja..." value={userData.injuries} onChange={e => setUserData({...userData, injuries: e.target.value})} />
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
          <label className="block text-xs font-black text-slate-400 uppercase mb-4 tracking-wider flex items-center gap-2"><Flame className="w-3.5 h-3.5"/> Nivel de Estrés Diario</label>
          <div className="flex gap-2">
            {[['Bajo', '😌'], ['Medio', '😐'], ['Alto', '😤']].map(([s, emoji]) => (
              <button key={s} onClick={() => setUserData({...userData, stressLevel: s})}
                className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all flex flex-col items-center gap-1 ${userData.stressLevel === s ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                <span className="text-xl">{emoji}</span>
                <span>{s}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <button onClick={() => { setStep(4); track('onboarding_step', { step: 4, name: 'entorno' }); }} className="w-full bg-slate-900 py-4 rounded-2xl font-black text-white mt-4 shadow-xl active:scale-95">Continuar →</button>
    </div>
  );

  // ── STEP 4: ENTORNO ──
  if (step === 4) return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col animate-in slide-in-from-right">
      <StepHeader onBack={() => setStep(3)} current={3} total={4} label="Paso 3 de 4 — Entorno" />
      <h2 className="text-3xl font-black text-slate-800 mb-1">Tu Entorno</h2>
      <p className="text-slate-500 text-sm mb-6">Solo te recomendaremos ejercicios que puedes hacer donde estás.</p>
      <div className="space-y-3 flex-1">
        {[
          { label: 'Gym Completo', icon: Dumbbell, desc: 'Máquinas, poleas y pesas libres' },
          { label: 'En casa (con pesas)', icon: Activity, desc: 'Mancuernas o bandas de resistencia' },
          { label: 'En casa (sin equipo)', icon: Target, desc: 'Solo peso corporal' }
        ].map(option => {
          const isSelected = userData.equipment === option.label;
          return (
            <button key={option.label} onClick={() => setUserData({...userData, equipment: option.label})}
              className={`w-full p-5 rounded-3xl flex items-center justify-between border-2 transition-all text-left active:scale-95 ${isSelected ? 'border-emerald-500 bg-white shadow-md' : 'border-transparent bg-white shadow-sm hover:shadow-md'}`}>
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${isSelected ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                  <option.icon className={`w-6 h-6 ${isSelected ? 'text-emerald-500' : 'text-slate-400'}`} />
                </div>
                <div>
                  <p className={`font-black text-base ${isSelected ? 'text-slate-800' : 'text-slate-600'}`}>{option.label}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase mt-0.5">{option.desc}</p>
                </div>
              </div>
              {isSelected && <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shrink-0"><Check className="w-4 h-4 text-white"/></div>}
            </button>
          );
        })}
      </div>
      <button onClick={() => setStep(modalidad === 'coach' ? 4.5 : 5)} className="w-full bg-slate-900 py-4 rounded-2xl font-black text-white mt-4 shadow-xl active:scale-95">Continuar</button>

      {/* Resumen de macros calculados */}
      {userData.targetKcal > 0 && (
        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-3xl p-4">
          <p className="text-xs font-black text-emerald-600 uppercase mb-3">📊 Tu plan nutricional calculado</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Kcal', val: userData.targetKcal, color: 'text-orange-500' },
              { label: 'Proteína', val: `${userData.proteina}g`, color: 'text-blue-500' },
              { label: 'Carbs', val: `${userData.carbs}g`, color: 'text-yellow-500' },
              { label: 'Grasas', val: `${userData.grasas}g`, color: 'text-pink-500' },
            ].map(m => (
              <div key={m.label} className="bg-white rounded-2xl p-3 text-center">
                <p className={`font-black text-sm ${m.color}`}>{m.val}</p>
                <p className="text-xs text-slate-400 font-bold uppercase mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">Calculado con Mifflin-St Jeor · Método científico validado</p>
        </div>
      )}
    </div>
  );

  // ── STEP 4.5: NOTAS PARA EL COACH (solo modalidad coach) ──
  if (step === 4.5) return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col animate-in slide-in-from-right">
      <StepHeader onBack={() => setStep(4)} current={3} total={4} label="Paso 3.5 — Notas para tu coach" />
      <h2 className="text-3xl font-black text-slate-800 mb-1">¿Algo más que deba saber?</h2>
      <p className="text-slate-500 text-sm mb-6">Tu coach leerá esto antes de crear tu plan. Sé específico — cada detalle cuenta.</p>

      <div className="space-y-3 flex-1">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
          <label className="block text-xs font-black text-slate-400 uppercase mb-3 tracking-wider flex items-center gap-2">
            <FileText className="w-3.5 h-3.5"/> Notas para tu coach
          </label>
          <textarea
            className="w-full bg-slate-50 p-4 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={8}
            placeholder="Ej: Soy alérgico al mariscos, entreno mejor en las mañanas, no me gustan las legumbres, tengo hipertensión controlada, viajo mucho por trabajo..."
            value={userData.coachNotes || ''}
            onChange={e => setUserData({...userData, coachNotes: e.target.value})}
          />
          <p className="text-slate-400 text-xs mt-2 font-medium">{(userData.coachNotes || '').length}/500 caracteres</p>
        </div>

        {/* Sugerencias rápidas */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
          <p className="text-xs font-black text-slate-400 uppercase mb-3 tracking-wider">Sugerencias de qué incluir</p>
          <div className="flex flex-wrap gap-2">
            {['🥜 Alergias', '⏰ Horarios', '🍗 Preferencias', '💊 Medicamentos', '✈️ Viajo mucho', '🏠 Trabajo desde casa'].map(tag => (
              <button key={tag} onClick={() => {
                const current = userData.coachNotes || '';
                const label = tag.split(' ').slice(1).join(' ');
                if (!current.includes(label)) setUserData({...userData, coachNotes: current ? `${current}\n${label}: ` : `${label}: `});
              }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-all active:scale-95">
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button onClick={() => { setStep(5); track('onboarding_step', { step: 5, name: 'compromiso' }); }}
        className="w-full bg-slate-900 py-4 rounded-2xl font-black text-white mt-4 shadow-xl active:scale-95">
        {userData.coachNotes ? 'Continuar con mi nota ✓' : 'Saltar por ahora'}
      </button>
    </div>
  );
  if (step === 5) return (
    <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center animate-in fade-in">
      <div className="flex items-center gap-4 w-full mb-8 mt-2">
        <button onClick={() => setStep(4)} className="p-2.5 bg-slate-800 rounded-2xl shrink-0 active:scale-95">
          <ChevronLeft className="w-5 h-5 text-slate-300"/>
        </button>
        <div className="flex-1">
          <ProgressBar current={4} total={4} />
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1.5">Paso 4 de 4 — Compromiso</p>
        </div>
      </div>

      <div className="w-full max-w-sm flex flex-col items-center flex-1">
        <div className="bg-emerald-500/10 p-4 rounded-3xl mb-5">
          <Trophy className="text-emerald-400 w-10 h-10" />
        </div>
        <h2 className="text-3xl font-black text-white mb-2 text-center">El Pacto del 1%</h2>
        <p className="text-slate-500 text-sm text-center mb-6">Un pequeño compromiso diario genera resultados extraordinarios.</p>

        {/* Contrato */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl mb-8 w-full relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-950 px-4 py-1 rounded-full border border-slate-800">
            <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">Mi Compromiso</span>
          </div>
          <p className="text-slate-300 italic leading-relaxed text-sm text-center">
            "Yo, <span className="text-white font-black">{userData.name || user.name}</span>, me comprometo a seguir mi plan de <span className="text-emerald-400 font-black">{userData.objective}</span> con disciplina y consistencia, dando lo mejor de mí cada día."
          </p>
        </div>

        {/* Los 3 pilares */}
        <div className="w-full space-y-3 mb-8">
          {[
            { icon: '🎯', text: 'Registraré mis comidas cada día' },
            { icon: '💪', text: 'Completaré mis entrenamientos' },
            { icon: '📈', text: 'Confiaré en el proceso' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 bg-slate-900 rounded-2xl p-4">
              <span className="text-xl">{item.icon}</span>
              <p className="text-slate-300 text-sm font-medium">{item.text}</p>
              <CheckCircle className="w-4 h-4 text-emerald-500 ml-auto shrink-0"/>
            </div>
          ))}
        </div>

        <button onClick={() => { setStep(5.5); track('onboarding_step', { step: 5.5, name: 'horarios' }); }}
          className="w-full py-5 rounded-2xl font-black text-base bg-emerald-500 text-slate-900 shadow-xl shadow-emerald-500/30 active:scale-95 transition-all">
          ✅ Acepto el reto — Vamos
        </button>
        <p className="text-slate-600 text-xs mt-3 text-center">Al continuar aceptas nuestros términos de servicio</p>
      </div>
    </div>
  );

  // ── STEP 5.5: HORARIOS DE COMIDAS ──
  if (step === 5.5) return (
    <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center animate-in fade-in">
      <div className="flex items-center gap-4 w-full mb-8 mt-2">
        <button onClick={() => setStep(5)} className="p-2.5 bg-slate-800 rounded-2xl shrink-0 active:scale-95">
          <ChevronLeft className="w-5 h-5 text-slate-300"/>
        </button>
        <div className="flex-1">
          <ProgressBar current={4} total={4} />
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1.5">Horarios de comidas</p>
        </div>
      </div>
      <div className="w-full max-w-sm flex flex-col flex-1">
        <div className="bg-emerald-500/10 p-4 rounded-3xl mb-5 w-fit mx-auto">
          <span className="text-4xl">🕐</span>
        </div>
        <h2 className="text-2xl font-black text-white mb-2 text-center">¿A qué hora comes?</h2>
        <p className="text-slate-500 text-sm text-center mb-8">Te enviaremos un recordatorio si no has registrado tus comidas ese día.</p>
        <div className="space-y-4">
          {[
            { key: 'desayuno', label: '🌅 Desayuno', default: '08:00' },
            { key: 'comida',   label: '☀️ Comida',   default: '14:00' },
            { key: 'cena',     label: '🌙 Cena',      default: '20:00' },
          ].map(({ key, label, default: def }) => (
            <div key={key} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <p className="text-white font-black text-sm">{label}</p>
              <input
                type="time"
                defaultValue={userData.mealTimes?.[key] || def}
                onChange={e => setUserData(prev => ({ ...prev, mealTimes: { ...prev.mealTimes, [key]: e.target.value } }))}
                className="bg-slate-800 text-emerald-400 font-black text-sm px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-emerald-500"
              />
            </div>
          ))}
        </div>
        <button onClick={() => { setStep(6); track('onboarding_step', { step: 6, name: 'generando' }); }}
          className="w-full py-5 rounded-2xl font-black text-base bg-emerald-500 text-slate-900 shadow-xl shadow-emerald-500/30 active:scale-95 mt-8">
          Continuar →
        </button>
      </div>
    </div>
  );

  // ── STEP 6: GENERANDO ──
  if (step === 6) {
    // Versión Coach — solo guarda perfil, coach humano prepara el plan
    if (modalidad === 'coach') {
      const coachSteps = [
        'Guardando tu perfil...',
        'Notificando a tu coach...',
        'Configurando tu espacio...',
        'Listo para empezar...'
      ];
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
          <div className="relative mb-10">
            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="bg-slate-900 p-8 rounded-full border border-blue-500/30 relative z-10">
              <Users className="text-blue-400 w-14 h-14 animate-pulse" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Conectando con tu coach...</h2>
          <p className="text-slate-500 text-sm mb-10 font-bold tracking-widest uppercase">Tu experto ya fue notificado</p>
          <div className="w-full max-w-sm space-y-3 bg-slate-900/80 p-6 rounded-3xl border border-slate-800 mb-6">
            {coachSteps.map((label, i) => {
              const isDone = analysisStage > i;
              const isActive = analysisStage === i;
              return (
                <div key={i} className={`flex items-center gap-3 transition-all duration-500 ${isDone || isActive ? 'opacity-100' : 'opacity-30'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${isDone ? 'bg-blue-500' : isActive ? 'bg-slate-700 border-2 border-blue-500' : 'bg-slate-800'}`}>
                    {isDone && <Check className="w-3 h-3 text-white"/>}
                    {isActive && <Loader2 className="w-3 h-3 text-blue-400 animate-spin"/>}
                  </div>
                  <span className={`text-sm font-medium ${isDone ? 'text-blue-400' : isActive ? 'text-white' : 'text-slate-600'}`}>{label}</span>
                </div>
              );
            })}
          </div>
          {/* Info de qué esperar */}
          <div className="w-full max-w-sm bg-blue-500/10 border border-blue-500/20 rounded-3xl p-5 text-left">
            <p className="text-blue-400 text-xs font-black uppercase tracking-widest mb-3">¿Qué sigue?</p>
            <div className="space-y-2">
              {[
                '📋 Tu coach revisará tu perfil completo',
                '⚡ Recibirás tu plan en las próximas 24h',
                '📧 Te notificaremos por email cuando esté listo',
              ].map(t => (
                <p key={t} className="text-slate-400 text-xs font-medium">{t}</p>
              ))}
            </div>
          </div>
          {/* Cuenta regresiva */}
          <div className="w-full max-w-sm mt-4">
            <CountdownTimer deadline={Date.now() + 24 * 60 * 60 * 1000} />
          </div>
          <div className="w-full max-w-sm bg-slate-800 rounded-full h-1.5 overflow-hidden mt-8">
            <div className="bg-blue-500 h-full rounded-full transition-all duration-1000" style={{ width: `${(analysisStage / coachSteps.length) * 100}%` }} />
          </div>
          {analysisStage >= coachSteps.length && (
            <button onClick={onComplete}
              className="mt-6 w-full max-w-sm bg-blue-500 text-white font-black py-4 rounded-2xl active:scale-95 transition-all shadow-lg">
              Ir a mi perfil →
            </button>
          )}
        </div>
      );
    }

    // Versión IA — Gemini genera el plan
    const tasks = [
      'Calculando requerimientos base...',
      'Estructurando bloques de entrenamiento...',
      'Ajustando para tu nivel y equipo...',
      'Generando tu plan personalizado con IA...'
    ];
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
        <div className="relative mb-10">
          <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="bg-slate-900 p-8 rounded-full border border-emerald-500/30 relative z-10">
            <Brain className="text-emerald-500 w-14 h-14 animate-pulse" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Preparando tu plan...</h2>
        <p className="text-slate-500 text-sm mb-10 font-bold tracking-widest uppercase">Gemini está analizando tu perfil</p>
        <div className="w-full max-w-sm space-y-3 bg-slate-900/80 p-6 rounded-3xl border border-slate-800 mb-10">
          {tasks.map((label, i) => {
            const isDone = analysisStage > i;
            const isActive = analysisStage === i;
            return (
              <div key={i} className={`flex items-center gap-3 transition-all duration-500 ${isDone ? 'opacity-100' : isActive ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${isDone ? 'bg-emerald-500' : isActive ? 'bg-slate-700 border-2 border-emerald-500' : 'bg-slate-800'}`}>
                  {isDone && <Check className="w-3 h-3 text-white"/>}
                  {isActive && <Loader2 className="w-3 h-3 text-emerald-500 animate-spin"/>}
                </div>
                <span className={`text-sm font-medium ${isDone ? 'text-emerald-400' : isActive ? 'text-white' : 'text-slate-600'}`}>{label}</span>
              </div>
            );
          })}
        </div>
        <div className="w-full max-w-sm bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${(analysisStage / tasks.length) * 100}%` }} />
        </div>
      </div>
    );
  }

  return null;
};

export default OnboardingFlow;
