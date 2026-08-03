import { useState, useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { BACKEND_URL } from '../../config/constants';
import { isPremium } from '../../utils/metrics';
import { useToast } from '../../hooks/useToast';

const OnboardingPhotos = ({ user, onComplete }) => {
  const showToast = useToast();
  const isPremium = user.premium === true;
  const FOTOS = [
    { key: 'frente', label: 'Frente', icon: '🧍', desc: 'De pie, brazos a los lados, mirando a la cámara' },
    { key: 'perfil', label: 'Perfil lateral', icon: '🧍', desc: 'De lado, postura natural' },
    { key: 'espalda', label: 'Espalda', icon: '🧍', desc: 'De espaldas a la cámara, brazos a los lados' },
  ];
  const [fotos, setFotos] = useState({ frente: null, perfil: null, espalda: null });
  const [previews, setPreviews] = useState({ frente: null, perfil: null, espalda: null });
  const [uploading, setUploading] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [analisis, setAnalisis] = useState('');
  const [fotosGuardadas, setFotosGuardadas] = useState(false);
  const inputRefs = { frente: useRef(), perfil: useRef(), espalda: useRef() };

  const handleFile = (key, file) => {
    if (!file) return;
    setFotos(prev => ({ ...prev, [key]: file }));
    // createObjectURL para preview rápido, funciona en desktop y móvil moderno
    try {
      const url = URL.createObjectURL(file);
      setPreviews(prev => ({ ...prev, [key]: url }));
    } catch {
      // Fallback a FileReader si createObjectURL falla (iOS antiguo)
      const reader = new FileReader();
      reader.onloadend = () => setPreviews(prev => ({ ...prev, [key]: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const handleUploadAndAnalyze = async () => {
    setUploading(true);
    const urls = {};
    try {
      for (const { key } of FOTOS) {
        if (!fotos[key]) continue;
        const formData = new FormData();
        formData.append('file', fotos[key]);
        formData.append('uid', user.uid);
        formData.append('category', `onboarding_${key}`);
        const res = await fetch(`${BACKEND_URL}/upload-photo`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) urls[key] = data.url;
      }
      // Guardar URLs en Firestore
      await updateDoc(doc(db, 'users', user.uid), { onboardingPhotos: urls, onboardingPhotosDate: Date.now() });

      // Analizar con Gemini si hay al menos una foto
      if (Object.keys(urls).length > 0) {
        setUploading(false);
        setAnalizando(true);
        const imageContents = await Promise.all(
          Object.entries(fotos).filter(([, f]) => f).map(async ([key, file]) => {
            return new Promise(resolve => {
              const r = new FileReader();
              r.onload = e => resolve({ key, b64: e.target.result.split(',')[1], type: file.type });
              r.readAsDataURL(file);
            });
          })
        );
        const res = await fetch(`${BACKEND_URL}/gemini-images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `Eres un coach de fitness analizando fotos de evaluación inicial de un nuevo cliente. 
Cliente: ${user.name}, objetivo: ${user.goals?.objective || 'mejorar condición física'}.
Analiza su composición corporal de manera profesional y motivadora. 
Menciona: postura, distribución muscular visible, áreas de mejora prioritarias y puntos fuertes.
Sé específico pero empático. Máximo 4 oraciones. No menciones peso ni talla estimada.`,
            images: imageContents.map(({ b64, type }) => ({ data: b64, mimeType: type }))
          })
        });
        const data = await res.json();
        setAnalisis(data.text || '');
        if (data.text) await updateDoc(doc(db, 'users', user.uid), { onboardingAnalysis: data.text });
        setAnalizando(false);
      } else {
        setUploading(false);
      }
      showToast('✅ Fotos guardadas correctamente');
      setFotosGuardadas(true);
      // No redirigir automáticamente — el usuario verá el análisis y presionará continuar
    } catch (e) {
      console.error(e);
      showToast('Error subiendo fotos');
      setUploading(false);
      setAnalizando(false);
    }
  };

  const fotasSubidas = Object.values(fotos).filter(Boolean).length;
  const todasSubidas = fotasSubidas === 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex flex-col">
      <div className="flex-1 overflow-y-auto px-5 py-8 max-w-md mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Camera className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Fotos de evaluación</h1>
          <p className="text-slate-400 text-sm">
            {isPremium
              ? 'Sube tus 3 fotos para que la IA y tu coach personalicen tu plan al máximo.'
              : 'Opcional — sube tus fotos para un análisis más preciso de tu condición física.'}
          </p>
          {isPremium && (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-yellow-500/20 text-yellow-400 text-xs font-black px-3 py-1.5 rounded-xl">
              ⭐ Requerido para usuarios Premium
            </div>
          )}
        </div>

        {/* Fotos */}
        <div className="space-y-3 mb-6">
          {FOTOS.map(({ key, label, icon, desc }) => (
            <div key={key} className="bg-slate-800/60 rounded-2xl p-4 flex items-center gap-4">
              {previews[key] ? (
                <img src={previews[key]} className="w-16 h-16 rounded-xl object-cover shrink-0"  alt="" />
              ) : (
                <div className="w-16 h-16 bg-slate-700 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-2xl">{icon}</span>
                </div>
              )}
              <div className="flex-1">
                <p className="text-white font-black text-sm">{label}</p>
                <p className="text-slate-500 text-xs">{desc}</p>
              </div>
              <button onClick={() => inputRefs[key].current?.click()}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all active:scale-95 ${fotos[key] ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                {fotos[key] ? '✅ Lista' : '📷 Subir'}
              </button>
              <input ref={inputRefs[key]} type="file" accept="image/*" className="hidden"
                onChange={e => handleFile(key, e.target.files[0])} />
            </div>
          ))}
        </div>

        {/* Análisis IA */}
        {analisis && (
          <div className="bg-emerald-900/30 border border-emerald-700/30 rounded-2xl p-4 mb-6">
            <p className="text-emerald-400 text-xs font-black uppercase mb-2">🤖 Análisis IA</p>
            <p className="text-slate-300 text-sm leading-relaxed">{analisis}</p>
          </div>
        )}

        {/* Botones */}
        <div className="space-y-3">
          <button
            onClick={handleUploadAndAnalyze}
            disabled={uploading || analizando || fotasSubidas === 0}
            className="w-full py-4 bg-emerald-500 text-slate-900 font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin"/> Subiendo fotos...</>
              : analizando ? <><Loader2 className="w-4 h-4 animate-spin"/> Analizando con IA...</>
              : <><Camera className="w-4 h-4"/> Guardar y analizar ({fotasSubidas}/3)</>}
          </button>
          {/* Botón continuar — aparece después de subir o para omitir */}
          {(fotosGuardadas || !isPremium) && !uploading && !analizando && (
            <button onClick={onComplete}
              className={`w-full py-4 rounded-2xl font-black text-sm active:scale-95 transition-all ${fotosGuardadas ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>
              {fotosGuardadas ? '🚀 Continuar al app →' : 'Omitir por ahora →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPhotos;
