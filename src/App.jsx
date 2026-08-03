import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { BACKEND_URL } from './config/constants';
import { applyTheme } from './utils/theme';
import { ToastProvider } from './context/ToastContext';
import LoginScreen from './components/auth/LoginScreen';
import AdminPanel from './components/admin/AdminPanel';
import CoachDashboard from './components/coach/CoachDashboard';
import OnboardingFlow from './components/onboarding/OnboardingFlow';
import OnboardingPhotos from './components/onboarding/OnboardingPhotos';
import ClientDashboard from './components/client/ClientDashboard';
import InstallBanner from './components/shared/InstallBanner';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refCoach, setRefCoach] = useState(null); // {coachId, coachName, coachCode}
  const [showCoachWelcome, setShowCoachWelcome] = useState(true);

  // Detectar ?ref= en la URL al cargar — persiste en localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      fetch(`${BACKEND_URL}/join/${ref}`)
        .then(r => r.json())
        .then(data => {
          if (data.coachId) {
            setRefCoach(data);
            localStorage.setItem('pendingRefCoach', JSON.stringify(data));
            window.history.replaceState({}, '', window.location.pathname);
          }
        })
        .catch(() => {});
    } else {
      const saved = localStorage.getItem('pendingRefCoach');
      if (saved) {
        try { setRefCoach(JSON.parse(saved)); } catch {}
      }
    }
  }, []);

  useEffect(() => {
    let unsubSnapshot;
    const unsubAuth = onAuthStateChanged(auth, curr => {
      if (curr) {
        unsubSnapshot = onSnapshot(
          doc(db, 'users', curr.uid),
          s => {
            if (s.exists()) {
              const data = s.data();
              setUser(prev => ({ uid: curr.uid, ...data, showPhotoStep: prev?.showPhotoStep || false }));
              applyTheme(data.darkMode === true);
            } else {
              setUser({ uid: curr.uid, email: curr.email || 'invitado@fittrack.com', role: 'client', name: curr.displayName || 'Invitado', onboardingComplete: false });
            }
            setLoading(false);
          },
          err => {
            console.error("Error Firebase:", err);
            setUser({ uid: curr.uid, role: 'client', name: 'Invitado', onboardingComplete: false });
            setLoading(false);
          }
        );
      } else {
        if (unsubSnapshot) unsubSnapshot();
        setUser(null);
        setLoading(false);
      }
    });
    return () => { unsubAuth(); if (unsubSnapshot) unsubSnapshot(); };
  }, []);

  // FIX: Si usuario ya tiene cuenta y abre link de coach — vincular automáticamente
  useEffect(() => {
    if (user?.uid && user?.onboardingComplete && refCoach?.coachId && !user?.refCoachId) {
      updateDoc(doc(db, 'users', user.uid), {
        refCoachId: refCoach.coachId,
        refCoachCode: refCoach.coachCode,
        modalidad: 'coach',
        coachDeadline: Date.now() + 24 * 60 * 60 * 1000
      }).then(() => {
        localStorage.removeItem('pendingRefCoach');
      }).catch(() => {});
    }
  }, [user?.uid, refCoach?.coachId]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin w-12 h-12 text-emerald-500"/></div>;

  if (!user) {
    if (refCoach && showCoachWelcome) return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30">
          <span className="text-white font-black text-3xl">F</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-6 max-w-sm w-full">
          <p className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-2">Tu coach te invita</p>
          <h1 className="text-2xl font-black text-white mb-2">{refCoach.coachName}</h1>
          <p className="text-slate-400 text-sm">te ha invitado a entrenar con un programa 100% personalizado con IA.</p>
        </div>
        <div className="space-y-3 w-full max-w-sm mb-8">
          {['Plan de entrenamiento personalizado', 'Nutrición adaptada a tus metas', 'Seguimiento directo con tu coach'].map((item, i) => (
            <div key={i} className="flex items-center gap-3 bg-slate-900 rounded-2xl p-3">
              <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                <span className="text-emerald-400 text-xs font-black">✓</span>
              </div>
              <p className="text-slate-300 text-sm">{item}</p>
            </div>
          ))}
        </div>
        <button onClick={() => setShowCoachWelcome(false)}
          className="w-full max-w-sm py-4 bg-emerald-500 text-slate-900 font-black rounded-2xl text-lg active:scale-95 transition-all shadow-xl shadow-emerald-500/30">
          Comenzar con {refCoach.coachName} →
        </button>
        <p className="text-slate-600 text-xs mt-4">Organización: {refCoach.orgName}</p>
      </div>
    );
    return <LoginScreen />;
  }

  if (user.admin === true) return <ToastProvider><AdminPanel user={user} /></ToastProvider>;
  if (user.role === 'coach') return <ToastProvider><CoachDashboard user={user} /></ToastProvider>;
  if (!user.onboardingComplete) return <OnboardingFlow user={user} refCoach={refCoach} onComplete={() => setUser(u => ({...u, onboardingComplete: true, showPhotoStep: true}))} />;
  if (user.showPhotoStep) return <ToastProvider><OnboardingPhotos user={user} onComplete={() => setUser(u => ({...u, showPhotoStep: false}))} /></ToastProvider>;

  return <ToastProvider><ClientDashboard user={user} /><InstallBanner /></ToastProvider>;
}
