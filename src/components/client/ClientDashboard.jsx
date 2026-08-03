import { useState, useEffect } from 'react';
import { Activity, Camera, TrendingUp, Utensils, LogOut, Dumbbell, Calendar, MoreHorizontal, Sparkles, Loader2, Flame, Trophy } from 'lucide-react';
import { auth, db } from '../../firebase';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { BACKEND_URL, SYSTEM_PROMPTS } from '../../config/constants';
import { track } from '../../utils/analytics';
import { calculate1RM, isPremium } from '../../utils/metrics';
import { callGemini, getAuthToken } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { getGoogleCalendarToken, createCalendarEvent } from '../../services/googleCalendar';
import { applyTheme } from '../../utils/theme';
import DailyHUD from '../shared/DailyHUD';
import MultiPhotoModal from '../shared/MultiPhotoModal';
import PremiumBanner from '../shared/PremiumBanner';
import CountdownTimer from '../shared/CountdownTimer';
import PhotosSection from '../shared/PhotosSection';
import ChatBubble from '../shared/ChatBubble';
import MealSwapModal from './MealSwapModal';
import AchievementsBoard from './AchievementsBoard';
import PlanesScreen from './PlanesScreen';
import EjercicioTab from './EjercicioTab';
import DietaTab from './DietaTab';
import CoachNotesWidget from './CoachNotesWidget';
import ListaSuperModal from './ListaSuperModal';
import CoachMessageBanner from './CoachMessageBanner';
import ChatMensajesCoach from './ChatMensajesCoach';

const ClientDashboard = ({ user }) => {
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('inicio');
  const showToast = useToast();
  const [planData, setPlanData] = useState(null); // plan cargado de plans/{uid}
  const [daysUnlocked, setDaysUnlocked] = useState(3);
  const [startDayIndex, setStartDayIndex] = useState(0);

  // Detectar retorno de Mercado Pago y verificar activamente
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('pago') === 'exitoso') {
      window.history.replaceState({}, '', window.location.pathname);
      // Verificar activamente con el backend en lugar de confiar en el parámetro
      const verificar = async () => {
        showToast('⏳ Verificando tu pago...', 'info');
        try {
          const token = await getAuthToken();
          const res = await fetch(`${BACKEND_URL}/verificar-pago`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
          });
          const data = await res.json();
          if (data.premium) {
            showToast('🎉 ¡Bienvenido a Premium! Tu cuenta ya está activa');
            track('purchase', { currency: 'MXN', value: 99, plan: 'premium_monthly' });
          } else {
            // El webhook puede tardar unos segundos — reintentar en 5s
            setTimeout(async () => {
              const res2 = await fetch(`${BACKEND_URL}/verificar-pago`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
              });
              const data2 = await res2.json();
              if (data2.premium) {
                showToast('🎉 ¡Bienvenido a Premium! Tu cuenta ya está activa');
                track('purchase', { currency: 'MXN', value: 99, plan: 'premium_monthly' });
              } else {
                showToast('⚠️ Pago recibido pero aún procesando. Si no se activa en 5 minutos, escríbenos.', 'info');
              }
            }, 5000);
          }
        } catch(e) {
          showToast('⚠️ No pudimos verificar tu pago. Por favor contáctanos.', 'error');
        }
      };
      verificar();
    }
  }, []);

  // Tracking de último acceso y apertura de app
  useEffect(() => {
    if (!user?.uid) return;
    updateDoc(doc(db, 'users', user.uid), { lastOpenTimestamp: Date.now() }).catch(() => {});
    track('app_open', { uid: user.uid, premium: user.premium === true, modalidad: user.modalidad }); track('session_start', { uid: user.uid, premium: user.premium === true });
  }, [user?.uid]);

  // Cargar plan desde plans/{uid}
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'plans', user.uid), snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.plan && !planData) track('first_plan_viewed', { uid: user.uid });
        setPlanData(data.plan || null);
        setDaysUnlocked(data.daysUnlocked || 3);
        setStartDayIndex(data.startDayIndex ?? 0);
      }
    });
    return () => unsub();
  }, [user?.uid]);

  const [showLogModal, setShowLogModal] = useState(false);
  const [showDayReview, setShowDayReview] = useState(false);
  const [dayReviewSent, setDayReviewSent] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(user?.darkMode === true);

  // Aplicar tema al montar y cuando cambie
  useEffect(() => {
    applyTheme(isDarkMode);
  }, [isDarkMode]);

  const toggleTheme = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    applyTheme(newMode);
    try { await updateDoc(doc(db, 'users', user.uid), { darkMode: newMode }); } catch {}
  };

  // Mostrar modal de review si hay pendingDayReview
  useEffect(() => {
    const hoy = new Date().toISOString().split('T')[0];
    if (user?.pendingDayReview === hoy && !user?.dayReviews?.[hoy]) {
      setTimeout(() => setShowDayReview(true), 1000);
    }
  }, [user?.pendingDayReview]);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [logContent, setLogContent] = useState('');
  const [workoutData, setWorkoutData] = useState({ exercise: '', weight: '', reps: '' });
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [checkedEjercicios, setCheckedEjercicios] = useState([]);
  const [checkedComidas, setCheckedComidas] = useState([]);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [showListaSuper, setShowListaSuper] = useState(false);
  const [showPlanes, setShowPlanes] = useState(false);
  const [bannerDescartado, setBannerDescartado] = useState(false);
  const trackUpgrade = (source) => { track('view_upgrade', { source }); track('upgrade_viewed', { source }); setShowPlanes(true); };
  const [syncingCalendar, setSyncingCalendar] = useState(false);

  const syncGoogleCalendar = async () => {
    if (!planData) { showToast('Genera tu plan primero'); return; }
    setSyncingCalendar(true);
    try {
      const token = await getGoogleCalendarToken();
      const today = new Date();
      const dayOfWeek = (today.getDay() + 6) % 7;
      let created = 0;

      for (let i = 0; i < planData.length; i++) {
        const dia = planData[i];
        const daysFromToday = (i - dayOfWeek + 7) % 7;
        const date = new Date(today);
        date.setDate(today.getDate() + daysFromToday);
        const dateStr = date.toISOString().split('T')[0];

        // Evento de entrenamiento
        if (dia.entrenamiento?.ejercicios?.length > 0) {
          const ejercicios = dia.entrenamiento.ejercicios.map(e => `• ${e.nombre} ${e.series}×${e.reps}`).join('\n');
          await createCalendarEvent(token, {
            summary: `🏋️ Entrenamiento FitTrack — ${dia.dia}`,
            description: `Plan de entrenamiento:\n${ejercicios}`,
            start: { dateTime: `${dateStr}T07:00:00`, timeZone: 'America/Mexico_City' },
            end: { dateTime: `${dateStr}T08:00:00`, timeZone: 'America/Mexico_City' },
            colorId: '2'
          });
          created++;
        }

        // Recordatorios de comidas con horarios del usuario
        if (dia.dieta?.comidas?.length > 0) {
          const mt = user.mealTimes || {};
          const horarios = {
            'Desayuno': mt.desayuno || '08:00',
            'Almuerzo': mt.comida || '14:00',
            'Comida': mt.comida || '14:00',
            'Merienda': mt.merienda || '17:00',
            'Cena': mt.cena || '20:00',
            'Post-entrenamiento/Media tarde': mt.merienda || '17:00'
          };
          for (const comida of dia.dieta.comidas) {
            const hora = horarios[comida.momento] || '12:00';
            const [h] = hora.split(':');
            await createCalendarEvent(token, {
              summary: `🥗 ${comida.momento} FitTrack`,
              description: comida.descripcion,
              start: { dateTime: `${dateStr}T${hora}:00`, timeZone: 'America/Mexico_City' },
              end: { dateTime: `${dateStr}T${String(parseInt(h)+1).padStart(2,'0')}:00:00`, timeZone: 'America/Mexico_City' },
              colorId: '5',
              reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 15 }] }
            });
            created++;
          }
        }
      }
      showToast(`✅ ${created} eventos agregados a Google Calendar`);
    } catch (e) {
      if (e.message !== 'Popup cerrado') showToast('Error al sincronizar con Google Calendar');
    }
    setSyncingCalendar(false);
  };

  // Día de la semana actual (0=Lun ... 6=Dom)
  const todayIndex = (new Date().getDay() + 6) % 7;

  const toggleEjercicio = (key) => {
    setCheckedEjercicios(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]; if (!prev.includes(key)) track('exercise_checked', { key });
      // Verificar si se completaron todos los ejercicios del día
      if (!prev.includes(key) && planData) {
        const todayPlan = planData[todayIndex];
        const totalEjHoy = todayPlan?.entrenamiento?.ejercicios?.length || 0;
        const doneEjHoy = next.filter(k => k.startsWith(`${todayIndex}-ej-`)).length;
        if (totalEjHoy > 0 && doneEjHoy >= totalEjHoy) {
          track('day_completed', { uid: user.uid, totalEjercicios: totalEjHoy });
          setTimeout(() => setShowDayReview(true), 1500);
        }
      }
      return next;
    });
  };
  const toggleComida = (key) => setCheckedComidas(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  // Guardar alternativa elegida: calcular macros con IA y guardar en Firestore
  const handleSelectAlternativa = async (descripcion, momento) => {
    showToast('⏳ Calculando macros...', 'info');
    try {
      const aiResponse = await callGemini(descripcion, SYSTEM_PROMPTS.NUTRITION_ESTIMATOR);
      const clean = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const macros = JSON.parse(clean);
      const contenido = `${descripcion}\n(IA: ${macros.kcal} kcal | P:${macros.protein}g C:${macros.carbs}g G:${macros.fats}g)`;
      await addDoc(collection(db, 'logs'), {
        userId: user.uid, userName: user.name, type: 'meal',
        content: contenido, aiMetadata: macros,
        timestamp: serverTimestamp(), dateString: new Date().toDateString(),
        esAlternativa: true, momento
      });
      showToast(`✅ ${momento} guardado — ${macros.kcal} kcal`);
    } catch (e) {
      await addDoc(collection(db, 'logs'), {
        userId: user.uid, userName: user.name, type: 'meal',
        content: descripcion,
        aiMetadata: {}, timestamp: serverTimestamp(), dateString: new Date().toDateString(),
        esAlternativa: true, momento
      });
      showToast(`✅ ${momento} guardado`);
    }
  };

  // Calcular totales del día actual para los anillos
  const getPlanStats = () => {
    try {
      const plan = planData || JSON.parse(user.currentPlan?.replace(/```json/g, '').replace(/```/g, '').trim());
      const dia = plan[todayIndex];
      const totalEj = dia?.entrenamiento?.ejercicios?.length || 0;
      const totalCom = dia?.dieta?.comidas?.length || 0;
      const doneEj = checkedEjercicios.filter(k => k.startsWith(`${todayIndex}-ej-`)).length;
      const doneCom = checkedComidas.filter(k => k.startsWith(`${todayIndex}-comida-`)).length;
      return { totalEj, totalCom, doneEj, doneCom };
    } catch { return { totalEj: 0, totalCom: 0, doneEj: 0, doneCom: 0 }; }
  };

  const { totalEj, totalCom, doneEj, doneCom } = getPlanStats();

  useEffect(() => {
    const q = query(collection(db, 'logs'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      const newLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(newLogs);
      const dias = new Set(newLogs.map(l => l.dateString)).size;
      if ([3, 7, 14, 30].includes(dias)) track('streak_milestone', { days: dias });
    });
    return () => unsub();
  }, [user.uid]);

  const todayStr = new Date().toDateString();
  const todayLogs = logs.filter(l => l.dateString === todayStr);
  const todayKcal = todayLogs.filter(l => l.type === 'meal').reduce((sum, l) => sum + (l.aiMetadata?.kcal || 0), 0);
  const uniqueDays = new Set(logs.map(l => l.dateString)).size;
  const maxSquat = Math.max(...logs.filter(l => l.type === 'workout' && l.aiMetadata?.projected1RM).map(l => l.aiMetadata.projected1RM), 0);

  const submitSmartLog = async () => {
    if (!logContent.trim() && modalType !== 'workout') return;
    setIsProcessingAI(true);
    let aiMetadata = {};
    let finalContent = logContent;
    try {
      if (modalType === 'meal') {
        const aiResponse = await callGemini(logContent, SYSTEM_PROMPTS.NUTRITION_ESTIMATOR);
        if (aiResponse && !aiResponse.includes('⚠️')) {
          const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
          aiMetadata = JSON.parse(cleanJson);
          finalContent = `${logContent}\n(IA: ${aiMetadata.kcal} kcal | P:${aiMetadata.protein}g C:${aiMetadata.carbs}g G:${aiMetadata.fats}g)`;
        }
      } else if (modalType === 'workout') {
        const w = parseFloat(workoutData.weight);
        const r = parseInt(workoutData.reps);
        aiMetadata = { volume: w * r, projected1RM: calculate1RM(w, r) };
        finalContent = `${workoutData.exercise}: ${w}kg x ${r} reps\n(Vol: ${w * r}kg | 1RM Proy: ${calculate1RM(w, r)}kg)`;
      }
    } catch (e) { console.error("Error AI:", e); }

    await addDoc(collection(db, 'logs'), {
      userId: user.uid, userName: user.name, type: modalType,
      content: finalContent, aiMetadata, timestamp: serverTimestamp(), dateString: new Date().toDateString()
    });

    showToast(modalType === 'meal' ? '🍽️ Comida registrada con IA' : modalType === 'workout' ? '💪 Entrenamiento guardado' : '⚖️ Peso registrado');
    setIsProcessingAI(false);
    setShowLogModal(false);
    setLogContent('');
    setWorkoutData({ exercise: '', weight: '', reps: '' });
  };

  return (
    <div className="pb-28 min-h-screen bg-slate-50 font-sans">
      <div className="bg-white px-5 py-4 shadow-sm sticky top-0 z-20 flex justify-between items-center border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500 rounded-2xl flex items-center justify-center shrink-0">
            <span className="text-white font-black text-sm">{(user.name || 'U')[0].toUpperCase()}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-slate-800 leading-none">{user.name?.split(' ')[0]}</h1>
              {uniqueDays > 0 && (
                <div className="flex items-center gap-0.5 bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-xs font-black">
                  <Flame className="w-3 h-3"/> {uniqueDays}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{user.goals?.objective || 'Mi plan fitness'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPhotoModal(true)} className="bg-slate-100 text-slate-500 p-2.5 rounded-2xl active:scale-95 transition-all">
            <Camera className="w-4 h-4"/>
          </button>
          <button onClick={() => { if (window.confirm('¿Cerrar sesión?')) signOut(auth); }} className="bg-slate-100 text-slate-500 p-2.5 rounded-2xl hover:text-red-500 active:scale-95 transition-all">
            <LogOut className="w-4 h-4"/>
          </button>
        </div>
      </div>

      <div className="p-4 max-w-xl mx-auto">
        {/* Tab Inicio — Tracker completo */}
        {activeTab === 'inicio' && (
          <div className="space-y-4 animate-in fade-in">
            <CoachMessageBanner uid={user.uid} />
            <DailyHUD
              entrenoTotal={totalEj}
              entrenoDone={doneEj}
              dietaTotal={totalCom}
              dietaDone={doneCom}
              pesoRegistrado={logs.some(l => l.dateString === todayStr && l.type === 'weight')}
              kcalConsumidas={todayKcal}
              kcalMeta={user.goals?.targetKcal}
              mealLogs={todayLogs.filter(l => l.type === 'meal')}
              userGoals={user.goals}
            />
            {user.modalidad === 'ia' && !isPremium(user) && !bannerDescartado && <PremiumBanner onUpgrade={() => setShowPlanes(true)} onClose={() => setBannerDescartado(true)} />}
            {user.modalidad === 'coach' && user.coachDeadline && !planData && <CountdownTimer deadline={user.coachDeadline} />}
            {user.modalidad === 'coach' && !planData && <CoachNotesWidget uid={user.uid} initialNotes={user.coachNotes || ''} />}
            {logs.length > 0 && (
              <div>
                <h2 className="font-bold text-slate-700 mb-3 ml-1 flex items-center gap-2 uppercase tracking-wider text-xs">
                  <Activity className="w-4 h-4 text-emerald-500"/> Registros de hoy
                </h2>
                <div className="space-y-3">
                  {logs.filter(l => l.dateString === todayStr).map(log => {
                    const isGustito = log.esGustito === true;
                    const isAlternativa = log.esAlternativa === true;
                    if (isGustito) return (
                      <div key={log.id} className="bg-pink-50 border border-pink-200 p-4 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="p-2.5 rounded-xl bg-pink-100 text-pink-600 text-base">🍕</span>
                          <div>
                            <span className="font-black text-pink-700 text-sm">Gustito — {log.momento}</span>
                            {log.aiMetadata?.kcal > 0 && (
                              <p className="text-xs text-pink-400 font-bold">{log.aiMetadata.kcal} kcal · P:{log.aiMetadata.protein}g · C:{log.aiMetadata.carbs}g · G:{log.aiMetadata.fats}g</p>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">
                          {log.content?.replace(/^\[.*?gustito\]\s*/i, '').split('\n')[0]}
                        </p>
                      </div>
                    );
                    if (isAlternativa) return (
                      <div key={log.id} className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600 text-base">🔄</span>
                          <div>
                            <span className="font-black text-emerald-700 text-sm">Alternativa — {log.momento}</span>
                            {log.aiMetadata?.kcal > 0 && (
                              <p className="text-xs text-emerald-500 font-bold">{log.aiMetadata.kcal} kcal · P:{log.aiMetadata.protein}g · C:{log.aiMetadata.carbs}g · G:{log.aiMetadata.fats}g</p>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">{log.content?.split('\n')[0]}</p>
                      </div>
                    );
                    return (
                      <div key={log.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`p-2.5 rounded-xl ${log.type === 'meal' ? 'bg-orange-100 text-orange-600' : log.type === 'workout' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                            {log.type === 'meal' ? <Utensils className="w-4 h-4"/> : log.type === 'workout' ? <Dumbbell className="w-4 h-4"/> : <TrendingUp className="w-4 h-4"/>}
                          </span>
                          <span className="font-black capitalize text-slate-800 text-sm">{log.type === 'meal' ? 'Comida extra' : log.type === 'workout' ? 'Ejercicio extra' : 'Peso'}</span>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap font-medium">{log.content}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Dieta */}
        {activeTab === 'dieta' && (
          <div className="animate-in fade-in">
            <DietaTab
              planRaw={planData ? JSON.stringify(planData, (key, val) => val !== undefined ? val : null) : null}
              checkedComidas={checkedComidas}
              onToggleComida={toggleComida}
              onSelectAlternativa={handleSelectAlternativa}
              onListaSuper={(action) => { if (action === 'upgrade') setShowPlanes(true); else { setShowListaSuper(true); track('lista_super_opened', { premium: isPremium(user) }); } }}
              userPremium={isPremium(user)}
              uid={user.uid}
              daysUnlocked={daysUnlocked}
              startDayIndex={startDayIndex}
              todayIndex={todayIndex}
            />
          </div>
        )}

        {/* Tab Más (Fotos, Logros, Tracker) */}
        {activeTab === 'mas' && (
          <div className="space-y-3 animate-in fade-in">
            <h2 className="font-black text-lg text-slate-800 mb-4">Más opciones</h2>
            <button onClick={() => { setModalType('meal'); setShowLogModal(true); }} className="w-full bg-white border border-slate-100 rounded-3xl p-5 flex items-center gap-4 shadow-sm active:scale-95 transition-all">
              <div className="bg-orange-100 p-3 rounded-2xl"><Utensils className="w-6 h-6 text-orange-500"/></div>
              <div className="text-left"><p className="font-black text-slate-800">Registrar comida extra</p><p className="text-xs text-slate-400">Agrega algo fuera del plan</p></div>
            </button>
            <button onClick={() => { setModalType('workout'); setShowLogModal(true); }} className="w-full bg-white border border-slate-100 rounded-3xl p-5 flex items-center gap-4 shadow-sm active:scale-95 transition-all">
              <div className="bg-purple-100 p-3 rounded-2xl"><Dumbbell className="w-6 h-6 text-purple-500"/></div>
              <div className="text-left"><p className="font-black text-slate-800">Registrar ejercicio extra</p><p className="text-xs text-slate-400">Agrega algo fuera del plan</p></div>
            </button>
            <button onClick={() => setActiveTab('photos')} className="w-full bg-white border border-slate-100 rounded-3xl p-5 flex items-center gap-4 shadow-sm active:scale-95 transition-all">
              <div className="bg-blue-100 p-3 rounded-2xl"><Camera className="w-6 h-6 text-blue-600"/></div>
              <div className="text-left"><p className="font-black text-slate-800">Fotos de progreso</p><p className="text-xs text-slate-400">Registra tu transformación</p></div>
            </button>
            <button onClick={() => setActiveTab('achievements')} className="w-full bg-white border border-slate-100 rounded-3xl p-5 flex items-center gap-4 shadow-sm active:scale-95 transition-all">
              <div className="bg-yellow-100 p-3 rounded-2xl"><Trophy className="w-6 h-6 text-yellow-600"/></div>
              <div className="text-left"><p className="font-black text-slate-800">Logros y Calendario</p><p className="text-xs text-slate-400">Metas alcanzadas y Google Calendar</p></div>
            </button>
            {/* Dark mode toggle */}
            <button onClick={toggleTheme} className="w-full bg-white border border-slate-100 rounded-3xl p-5 flex items-center justify-between gap-4 shadow-sm active:scale-95 transition-all">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <span className="text-xl">{isDarkMode ? '☀️' : '🌙'}</span>
                </div>
                <div className="text-left">
                  <p className="font-black text-slate-800">Modo {isDarkMode ? 'claro' : 'oscuro'}</p>
                  <p className="text-xs text-slate-400">{isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}</p>
                </div>
              </div>
              <div className={`w-12 h-6 rounded-full transition-all ${isDarkMode ? 'bg-emerald-500' : 'bg-slate-200'} relative`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full transition-all bg-white shadow ${isDarkMode ? 'right-1' : 'left-1'}`}/>
              </div>
            </button>
            {/* Review del día */}
            <button onClick={() => setShowDayReview(true)} className="w-full bg-white border border-slate-100 rounded-3xl p-5 flex items-center gap-4 shadow-sm active:scale-95 transition-all">
              <div className="bg-indigo-100 p-3 rounded-2xl"><span className="text-xl">😊</span></div>
              <div className="text-left"><p className="font-black text-slate-800">¿Cómo estuvo tu día?</p><p className="text-xs text-slate-400">Califica tu jornada de hoy</p></div>
            </button>
            <button onClick={() => { if (window.confirm('¿Cerrar sesión?')) signOut(auth); }} className="w-full bg-white border border-slate-100 rounded-3xl p-5 flex items-center gap-4 shadow-sm active:scale-95 transition-all">
              <div className="bg-red-100 p-3 rounded-2xl"><LogOut className="w-6 h-6 text-red-500"/></div>
              <div className="text-left"><p className="font-black text-slate-800">Cerrar sesión</p></div>
            </button>
          </div>
        )}

        {/* Tab Tracker Completo */}
        {activeTab === 'tracker_full' && (
          <div className="space-y-4 animate-in fade-in">
            <button onClick={() => setActiveTab('mas')} className="flex items-center gap-2 text-slate-500 text-sm font-bold mb-2">
              ← Volver
            </button>
            <CoachMessageBanner uid={user.uid} />
            <DailyHUD
              entrenoTotal={totalEj}
              entrenoDone={doneEj}
              dietaTotal={totalCom}
              dietaDone={doneCom}
              pesoRegistrado={logs.some(l => l.dateString === todayStr && l.type === 'weight')}
              kcalConsumidas={todayKcal}
              kcalMeta={user.goals?.targetKcal}
              mealLogs={todayLogs.filter(l => l.type === 'meal')}
              userGoals={user.goals}
            />
            {user.modalidad === 'ia' && !isPremium(user) && !bannerDescartado && <PremiumBanner onUpgrade={() => setShowPlanes(true)} onClose={() => setBannerDescartado(true)} />}
            {logs.length > 0 && (
              <div>
                <h2 className="font-bold text-slate-700 mb-3 ml-1 flex items-center gap-2 uppercase tracking-wider text-xs"><Activity className="w-4 h-4 text-emerald-500"/> Registros de hoy</h2>
                <div className="space-y-3">
                  {logs.filter(l => l.dateString === todayStr).map(log => {
                    const isGustito = log.esGustito === true;
                    const isAlternativa = log.esAlternativa === true;
                    if (isGustito) return (
                      <div key={log.id} className="bg-pink-50 border border-pink-200 p-4 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="p-2.5 rounded-xl bg-pink-100 text-pink-600 text-base">🍕</span>
                          <div>
                            <span className="font-black text-pink-700 text-sm">Gustito — {log.momento}</span>
                            {log.aiMetadata?.kcal > 0 && (
                              <p className="text-xs text-pink-400 font-bold">{log.aiMetadata.kcal} kcal · P:{log.aiMetadata.protein}g · C:{log.aiMetadata.carbs}g · G:{log.aiMetadata.fats}g</p>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">
                          {log.content?.replace(/^\[.*?gustito\]\s*/i, '').split('\n')[0]}
                        </p>
                      </div>
                    );
                    if (isAlternativa) return (
                      <div key={log.id} className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600 text-base">🔄</span>
                          <div>
                            <span className="font-black text-emerald-700 text-sm">Alternativa — {log.momento}</span>
                            {log.aiMetadata?.kcal > 0 && (
                              <p className="text-xs text-emerald-500 font-bold">{log.aiMetadata.kcal} kcal · P:{log.aiMetadata.protein}g · C:{log.aiMetadata.carbs}g · G:{log.aiMetadata.fats}g</p>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">{log.content?.split('\n')[0]}</p>
                      </div>
                    );
                    return (
                      <div key={log.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`p-2.5 rounded-xl ${log.type === 'meal' ? 'bg-orange-100 text-orange-600' : log.type === 'workout' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                            {log.type === 'meal' ? <Utensils className="w-4 h-4"/> : log.type === 'workout' ? <Dumbbell className="w-4 h-4"/> : <TrendingUp className="w-4 h-4"/>}
                          </span>
                          <span className="font-black capitalize text-slate-800 text-sm">{log.type === 'meal' ? 'Comida extra' : log.type === 'workout' ? 'Ejercicio extra' : 'Peso'}</span>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap font-medium">{log.content}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ejercicio' && (
          <div className="animate-in fade-in">
            <EjercicioTab
              planRaw={planData ? JSON.stringify(planData, (key, val) => val !== undefined ? val : null) : null}
              checkedEjercicios={checkedEjercicios}
              onToggleEjercicio={toggleEjercicio}
              userPremium={isPremium(user)}
              uid={user.uid}
              daysUnlocked={daysUnlocked}
              startDayIndex={startDayIndex}
              todayIndex={todayIndex}
              userEquipment={user.goals?.equipment || 'Gym Completo'}
              onUnlockDay={() => setShowPlanes(true)}
            />
            {user.modalidad === 'coach' && user.coachDeadline && !planData && (
              <CountdownTimer deadline={user.coachDeadline} />
            )}
            {user.modalidad === 'coach' && !planData && (
              <CoachNotesWidget uid={user.uid} initialNotes={user.coachNotes || ''} />
            )}
          </div>
        )}
        {activeTab === 'achievements' && (
          <div className="p-4 space-y-4">
            <AchievementsBoard streakDays={uniqueDays} maxSquat={maxSquat} totalLogs={logs.length} />
            {/* Sincronizar con Google Calendar */}
            <button onClick={syncGoogleCalendar} disabled={syncingCalendar}
              className="w-full py-4 bg-white border-2 border-slate-200 rounded-2xl font-black text-sm flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 shadow-sm">
              {syncingCalendar
                ? <><Loader2 className="w-4 h-4 animate-spin"/> Sincronizando...</>
                : <><Calendar className="w-4 h-4 text-blue-500"/> Sincronizar con Google Calendar</>}
            </button>
          </div>
        )}
        {activeTab === 'photos' && (
          <div className="p-4 space-y-4">
            {isPremium(user) ? (
              <PhotosSection uid={user.uid} requestedCategory={user.photoRequest || null} userPremium={true} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <span className="text-5xl mb-4">📸</span>
                <h3 className="font-black text-slate-800 text-lg mb-2">Fotos de Progreso</h3>
                <p className="text-slate-400 text-sm mb-6">Sube tus fotos y obtén análisis con IA para ver tu evolución semana a semana.</p>
                <button onClick={() => setShowPlanes(true)}
                  className="bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black px-6 py-3 rounded-2xl active:scale-95 transition-all shadow-lg">
                  ⭐ Desbloquear con Premium
                </button>
              </div>
            )}
          </div>
        )}
        {activeTab === 'chat' && (
          <div className="p-4 animate-in fade-in space-y-4">
            {/* Videollamada con coach */}
            {user.meetLink && (
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-black text-sm">📹 Videollamada con tu Coach</p>
                  <p className="text-blue-100 text-xs mt-0.5">Sesión agendada disponible</p>
                </div>
                <a href={user.meetLink} target="_blank" rel="noopener noreferrer"
                  className="bg-white text-blue-600 font-black text-xs px-4 py-2.5 rounded-2xl active:scale-95 transition-all">
                  Unirse →
                </a>
              </div>
            )}

            {/* Subir video al coach */}
            <div className="bg-slate-800 rounded-3xl p-4">
              <p className="text-white font-black text-sm mb-1">🎥 Enviar video al coach</p>
              <p className="text-slate-400 text-xs mb-3">Graba tu técnica o comparte tu progreso</p>
              <label className="w-full bg-slate-700 border border-slate-600 text-slate-300 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all hover:bg-slate-600">
                <span>📎</span> Seleccionar video
                <input type="file" accept="video/*" capture="user" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 50 * 1024 * 1024) { alert('El video no puede superar 50MB'); return; }
                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('uid', user.uid);
                  formData.append('category', 'tecnica_video');
                  try {
                    const res = await fetch(`${BACKEND_URL}/upload-photo`, { method: 'POST', body: formData });
                    const data = await res.json();
                    if (data.url) {
                      await updateDoc(doc(db, 'users', user.uid), {
                        tecnicaVideos: [...(user.tecnicaVideos || []), { url: data.url, ts: Date.now(), viewed: false }]
                      });
                      alert('✅ Video enviado al coach');
                    }
                  } catch(err) { alert('No se pudo subir el video. Verifica que pese menos de 50MB.'); }
                }}/>
              </label>
            </div>

            <ChatMensajesCoach uid={user.uid} />
          </div>
        )}
      </div>

      {/* Modal: ¿Cómo estuvo tu día? */}
      {showDayReview && !dayReviewSent && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-end justify-center p-4 animate-in slide-in-from-bottom-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">
            <div className="text-center mb-6">
              <span className="text-4xl">🌙</span>
              <h3 className="font-black text-xl mt-2">¿Cómo estuvo tu día?</h3>
              <p className="text-slate-400 text-sm mt-1">Tu feedback ayuda a la IA a mejorar tu plan</p>
            </div>
            <div className="grid grid-cols-5 gap-2 mb-6">
              {[
                { emoji: '😫', label: 'Muy difícil', val: 1 },
                { emoji: '😓', label: 'Difícil', val: 2 },
                { emoji: '😊', label: 'Bien', val: 3 },
                { emoji: '💪', label: 'Genial', val: 4 },
                { emoji: '🔥', label: 'Excelente', val: 5 },
              ].map(opt => (
                <button key={opt.val} onClick={async () => {
                  const today = new Date().toISOString().split('T')[0];
                  track('day_review_submitted', { rating: opt.val, label: opt.label });
                  await updateDoc(doc(db, 'users', user.uid), {
                    [`dayReviews.${today}`]: { rating: opt.val, label: opt.label, ts: Date.now() }
                  });
                  setDayReviewSent(true);
                  setTimeout(() => setShowDayReview(false), 1500);
                }}
                  className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 transition-all">
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className="text-xs font-bold text-slate-500">{opt.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowDayReview(false)}
              className="w-full text-slate-400 text-sm font-bold py-2">Omitir</button>
          </div>
        </div>
      )}

      {/* Confirmación review enviado */}
      {showDayReview && dayReviewSent && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
            <span className="text-5xl">✅</span>
            <p className="font-black text-xl mt-3">¡Gracias por tu feedback!</p>
            <p className="text-slate-400 text-sm mt-1">La IA tomará esto en cuenta</p>
          </div>
        </div>
      )}

      {showLogModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">
            <h3 className="font-black text-xl mb-6 capitalize flex items-center gap-2">
              Registrar {modalType} {modalType === 'meal' && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full uppercase ml-auto"><Sparkles className="w-3 h-3 inline"/> IA</span>}
            </h3>
            {modalType === 'workout' ? (
              <div className="space-y-4 mb-6">
                <input type="text" placeholder="Ejercicio (ej. Sentadilla)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-400 font-bold" value={workoutData.exercise} onChange={e => setWorkoutData({...workoutData, exercise: e.target.value})}/>
                <div className="flex gap-4">
                  <input type="number" placeholder="Peso (kg)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-400 font-bold" value={workoutData.weight} onChange={e => setWorkoutData({...workoutData, weight: e.target.value})}/>
                  <input type="number" placeholder="Reps" className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-400 font-bold" value={workoutData.reps} onChange={e => setWorkoutData({...workoutData, reps: e.target.value})}/>
                </div>
                {workoutData.weight && workoutData.reps && (
                  <div className="bg-purple-50 border border-purple-100 text-purple-700 p-4 rounded-2xl text-sm text-center font-black">
                    1RM Proyectado: {calculate1RM(parseFloat(workoutData.weight), parseInt(workoutData.reps))} kg
                  </div>
                )}
              </div>
            ) : (
              <textarea className="w-full bg-slate-50 p-4 rounded-2xl mb-6 text-base outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent resize-none h-32 font-medium" placeholder={modalType === 'weight' ? "Ej: 75.5" : "Ej: Desayuné 2 huevos con tostada integral..."} value={logContent} onChange={e => setLogContent(e.target.value)} autoFocus />
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowLogModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl active:scale-95">Cancelar</button>
              <button onClick={submitSmartLog} disabled={isProcessingAI} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg flex justify-center items-center gap-2 active:scale-95">
                {isProcessingAI ? <Loader2 className="animate-spin w-5 h-5"/> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSwapModal && <MealSwapModal onClose={() => setShowSwapModal(false)} currentPlan={user.currentPlan} />}
      {showPhotoModal && <MultiPhotoModal onClose={() => setShowPhotoModal(false)} />}

      {/* Menú rápido flotante */}
      {showQuickMenu && (
        <div className="fixed inset-0 z-20" onClick={() => setShowQuickMenu(false)}>
          <div className="absolute bottom-28 right-4 flex flex-col items-end gap-3 animate-in slide-in-from-bottom-4 fade-in">
            {[
              { label: 'Registrar Peso', icon: TrendingUp, color: 'bg-blue-500', type: 'weight' },
              { label: 'Ejercicio Extra', icon: Dumbbell, color: 'bg-purple-500', type: 'workout' },
              { label: 'Comida Extra', icon: Utensils, color: 'bg-orange-500', type: 'meal' },
            ].map(opt => (
              <button key={opt.label}
                onClick={(e) => { e.stopPropagation(); setShowQuickMenu(false); setModalType(opt.type); setShowLogModal(true); }}
                className="flex items-center gap-3 active:scale-95 transition-all">
                <span className="bg-white text-slate-700 font-black text-sm px-4 py-2 rounded-2xl shadow-lg">{opt.label}</span>
                <div className={`${opt.color} w-12 h-12 rounded-full flex items-center justify-center shadow-lg`}>
                  <opt.icon className="w-5 h-5 text-white" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 w-full bg-white border-t border-slate-100 flex justify-around p-3 pb-8 z-10 select-none">
        <button onClick={() => setActiveTab('dieta')} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'dieta' ? 'bg-slate-900 text-white shadow-lg px-4' : 'text-slate-400'}`}>
          <Utensils className="w-5 h-5"/>
          <span className="text-xs font-bold uppercase tracking-wide">Dieta</span>
        </button>
        <button onClick={() => setActiveTab('ejercicio')} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'ejercicio' ? 'bg-slate-900 text-white shadow-lg px-4' : 'text-slate-400'}`}>
          <Dumbbell className="w-5 h-5"/>
          <span className="text-xs font-bold uppercase tracking-wide">Entreno</span>
        </button>
        <button onClick={() => setActiveTab('inicio')} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'inicio' ? 'bg-slate-900 text-white shadow-lg px-4' : 'text-slate-400'}`}>
          <Activity className="w-5 h-5"/>
          <span className="text-xs font-bold uppercase tracking-wide">Hoy</span>
        </button>
        <button onClick={() => setActiveTab('mas')} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${['mas','photos','achievements'].includes(activeTab) ? 'bg-slate-900 text-white shadow-lg px-4' : 'text-slate-400'}`}>
          <MoreHorizontal className="w-5 h-5"/>
          <span className="text-xs font-bold uppercase tracking-wide">Más</span>
        </button>
      </div>

      {/* Burbuja flotante Coach — solo si tiene coach humano */}
      {user.modalidad === 'coach' && (
        <ChatBubble activeTab={activeTab} uid={user.uid} onOpen={() => { if (activeTab !== 'chat') track('chat_opened', { uid: user.uid }); setActiveTab(activeTab === 'chat' ? 'inicio' : 'chat'); }} />
      )}

      {/* Modal Lista del Súper */}
      {showListaSuper && (
        <ListaSuperModal plan={planData || user.currentPlan} uid={user.uid} savedLista={user.listaSuper || null} onClose={() => setShowListaSuper(false)} userEmail={user.email} userName={user.name} />
      )}

      {showPlanes && (
        <PlanesScreen user={user} onClose={() => setShowPlanes(false)} />
      )}
    </div>
  );
};

export default ClientDashboard;
