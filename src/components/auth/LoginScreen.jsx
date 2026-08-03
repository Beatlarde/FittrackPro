import { useState } from 'react';
import { Activity, Loader2, Lock, User, ChevronLeft } from 'lucide-react';
import { auth, db } from '../../firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { BACKEND_URL } from '../../config/constants';
import { track } from '../../utils/analytics';
import GeminiDiagnosticTool from '../shared/GeminiDiagnosticTool';
import SolicitudCoachForm from './SolicitudCoachForm';

const LoginScreen = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [showSolicitud, setShowSolicitud] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (mode === 'register' && password !== confirmPassword) {
      setError('Las contraseñas no coinciden.'); return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      track('login', { method: 'email' });
      } else if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        track('sign_up', { method: 'email' });
        await setDoc(doc(db, 'users', cred.user.uid), {
          email, name: email.split('@')[0], role: 'client',
          createdAt: serverTimestamp(), onboardingComplete: false
        });
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setSuccess('✅ Revisa tu correo para restablecer tu contraseña.');
        setLoading(false); return;
      }
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential')
        setError('Email o contraseña incorrectos.');
      else if (err.code === 'auth/email-already-in-use') setError('Este email ya está registrado.');
      else if (err.code === 'auth/weak-password') setError('La contraseña debe tener al menos 6 caracteres.');
      else if (err.code === 'auth/invalid-email') setError('Email inválido.');
      else setError('Algo salió mal. Intenta de nuevo.');
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      track('login', { method: 'google' });
      const u = result.user;
      // Crear doc en Firestore solo si es nuevo
      const userRef = doc(db, 'users', u.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: u.email,
          name: u.displayName || u.email.split('@')[0],
          role: 'client',
          createdAt: serverTimestamp(),
          onboardingComplete: false
        });
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Error al iniciar sesión con Google.');
      }
    }
    setLoading(false);
  };

  if (showDiagnostic) return <GeminiDiagnosticTool onClose={() => setShowDiagnostic(false)} />;

  const titles = {
    login: { heading: 'Bienvenido de vuelta', sub: 'Ingresa tus credenciales para continuar' },
    register: { heading: 'Crea tu cuenta', sub: 'Empieza tu transformación hoy' },
    forgot: { heading: 'Recupera tu acceso', sub: 'Te enviaremos un enlace a tu correo' },
  };

  return (
    <>
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans overflow-hidden relative">
      {/* Fondo con gradiente animado */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-emerald-400/8 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-slate-800/20 rounded-full blur-3xl"></div>
      </div>

      {/* Hero superior */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-emerald-500 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Activity className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-white font-black text-2xl tracking-tight">FitTrack <span className="text-emerald-400">Pro</span></h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Tu coach de élite</p>
          </div>
        </div>

        {/* Card principal */}
        <div className="w-full max-w-sm">
          {/* Tabs login / registro */}
          {mode !== 'forgot' && (
            <div className="flex bg-slate-900 rounded-2xl p-1 mb-6 border border-slate-800">
              {[['login', 'Iniciar Sesión'], ['register', 'Registrarse']].map(([m, label]) => (
                <button key={m} onClick={() => { setMode(m); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${mode === m ? 'bg-emerald-500 text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-white font-black text-xl">{titles[mode].heading}</h2>
            <p className="text-slate-500 text-sm mt-1">{titles[mode].sub}</p>
          </div>

          {/* Mensajes */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-2xl mb-4 text-sm font-medium flex items-center gap-2">
              <span className="text-base">⚠️</span> {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-2xl mb-4 text-sm font-medium flex items-center gap-2">
              <span className="text-base">✅</span> {success}
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleAuth} className="space-y-3">
            {/* Email */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input type="email" placeholder="Correo electrónico" required
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-white placeholder-slate-600 pl-11 pr-4 py-4 rounded-2xl outline-none focus:border-emerald-500/50 transition-colors text-sm font-medium"
              />
            </div>

            {/* Password */}
            {mode !== 'forgot' && (
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input type={showPassword ? 'text' : 'password'} placeholder="Contraseña" required
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-white placeholder-slate-600 pl-11 pr-12 py-4 rounded-2xl outline-none focus:border-emerald-500/50 transition-colors text-sm font-medium"
                />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  <span className="text-xs font-bold">{showPassword ? 'OCULTAR' : 'VER'}</span>
                </button>
              </div>
            )}

            {/* Confirmar password */}
            {mode === 'register' && (
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input type={showPassword ? 'text' : 'password'} placeholder="Confirmar contraseña" required
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-white placeholder-slate-600 pl-11 pr-4 py-4 rounded-2xl outline-none focus:border-emerald-500/50 transition-colors text-sm font-medium"
                />
              </div>
            )}

            {/* Olvidé contraseña link */}
            {mode === 'login' && (
              <div className="text-right">
                <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                  className="text-xs text-slate-500 hover:text-emerald-400 font-bold transition-colors">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            {/* Botón principal */}
            <button type="submit" disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 py-4 rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> :
                mode === 'login' ? 'Entrar' :
                mode === 'register' ? 'Crear cuenta' : 'Enviar enlace'}
            </button>
          </form>

          {/* Volver desde forgot */}
          {mode === 'forgot' && (
            <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className="mt-4 w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 text-sm font-bold transition-colors">
              <ChevronLeft className="w-4 h-4"/> Volver al inicio de sesión
            </button>
          )}

          {/* Divisor */}
          {mode !== 'forgot' && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-slate-800"></div>
                <span className="text-slate-600 text-xs font-bold">O</span>
                <div className="flex-1 h-px bg-slate-800"></div>
              </div>

              {/* Google Sign In */}
              <button onClick={handleGoogleLogin} disabled={loading}
                className="w-full py-3.5 bg-white hover:bg-slate-100 text-slate-800 rounded-2xl font-black text-sm flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 shadow-sm">
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
                Continuar con Google
              </button>
            </>
          )}
        </div>

        {/* Link para ser coach */}
        <button onClick={() => setShowSolicitud(true)}
          className="mt-4 text-slate-500 text-xs font-bold hover:text-slate-300 transition-colors">
          ¿Eres coach? Únete a FitTrack Pro →
        </button>

        {/* Demo coach */}
        <button onClick={async () => {
          try {
            const { signInAnonymously } = await import('firebase/auth');
            const result = await signInAnonymously(auth);
            const uid = result.user.uid;
            await fetch(`${BACKEND_URL}/demo/crear-sesion`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ uid })
            });
          } catch(e) { console.error('Demo error:', e); }
        }} className="mt-2 text-emerald-400 text-xs font-bold hover:text-emerald-300 transition-colors flex items-center gap-1">
          🎭 Probar como Coach (demo)
        </button>

      </div>
    </div>
    {showSolicitud && <SolicitudCoachForm onClose={() => setShowSolicitud(false)} />}
    </>
  );
};

export default LoginScreen;
