import { useState, useEffect, useRef } from 'react';
import { Camera, Sparkles, Loader2 } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { BACKEND_URL } from '../../config/constants';
import { callGeminiWithImages } from '../../services/api';
import { useToast } from '../../hooks/useToast';

const PhotosSection = ({ uid, isCoach = false, requestedCategory = null, userPremium = false }) => {
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Fotos iniciales');
  const [customCategory, setCustomCategory] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [comparativaResult, setComparativaResult] = useState(null);
  const [showComparativa, setShowComparativa] = useState(false);
  const fileInputRef = useRef(null);
  const showToast = useToast();

  const generarComparativa = async () => {
    if (photos.length < 2) { showToast('Necesitas al menos 2 fotos para comparar'); return; }
    setComparing(true);
    setComparativaResult(null);
    const sorted = [...photos].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    const primera = sorted[0];
    const ultima = sorted[sorted.length - 1];
    const prompt = `Eres un coach de fitness. Analiza estas 2 fotos de progreso (primera = inicial, segunda = reciente).
Responde en español, máximo 4 líneas por punto, sin títulos con asteriscos, sin markdown. Formato:

📊 Cambios: [qué cambió visiblemente]
💪 Destacado: [lo más notable del progreso]  
🎯 Continuar → paso: [1 acción concreta]
🔥 [frase motivacional corta]`;
    const result = await callGeminiWithImages(prompt, [primera.url, ultima.url]);
    setComparativaResult({ text: result, desde: primera.dateString, hasta: ultima.dateString });
    setShowComparativa(true);
    setComparing(false);
  };

  useEffect(() => {
    const q = query(collection(db, 'photos'), where('userId', '==', uid));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPhotos(data);
    });
    return () => unsub();
  }, [uid]);

  const uploadPhoto = async (file, category) => {
    if (!file) return;
    setUploading(true);
    try {
      // Convertir a JPEG via canvas (resuelve HEIC y otros formatos no soportados)
      const jpegBlob = await new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          canvas.getContext('2d').drawImage(img, 0, 0);
          canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.85);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(file); // fallback: subir original
        };
        img.src = url;
      });

      const formData = new FormData();
      formData.append('file', jpegBlob, 'photo.jpg');
      formData.append('uid', uid);
      formData.append('category', category);

      const res = await fetch(`${BACKEND_URL}/upload-photo`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!data.url) throw new Error(data.error || 'Error al subir');

      showToast(`✅ Foto guardada — ${category}`);
    } catch (e) {
      console.error('❌ Error:', e);
      showToast('Algo salió mal. Intenta de nuevo.', 'error');
    }
    setUploading(false);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const cat = customCategory.trim() || selectedCategory;
    await uploadPhoto(file, cat);
    e.target.value = '';
    setCustomCategory('');
  };

  // Agrupar por categoría
  const grouped = photos.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  const allCategories = [...new Set([...PHOTO_CATEGORIES, ...Object.keys(grouped)])];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-slate-800 text-sm">Fotos de Progreso</h3>
          <p className="text-slate-400 text-xs font-medium">{photos.length} foto{photos.length !== 1 ? 's' : ''} en total</p>
        </div>
        {!isCoach && (
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="bg-slate-900 text-white px-4 py-2 rounded-2xl font-black text-xs flex items-center gap-2 active:scale-95 disabled:opacity-50">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Camera className="w-3.5 h-3.5"/>}
            {uploading ? 'Subiendo...' : 'Subir foto'}
          </button>
        )}
      </div>

      {/* Selector de categoría (solo usuario) */}
      {!isCoach && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Categoría de la foto</p>
          <div className="flex flex-wrap gap-2">
            {allCategories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedCategory === cat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {cat}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={customCategory}
              onChange={e => setCustomCategory(e.target.value)}
              placeholder="O escribe una categoría personalizada..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-slate-400"
            />
          </div>
          <p className="text-slate-400 text-xs">Se guardará en: <span className="font-black text-slate-600">"{customCategory.trim() || selectedCategory}"</span></p>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*"
        className="hidden" onChange={handleFileChange} />

      {/* Solicitud del coach (si hay) */}
      {requestedCategory && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-blue-700 font-black text-xs">📸 Tu coach solicita fotos</p>
            <p className="text-blue-500 text-xs font-medium mt-0.5">Categoría: <span className="font-black">{requestedCategory}</span></p>
          </div>
          <button onClick={() => { setSelectedCategory(requestedCategory); fileInputRef.current?.click(); }}
            className="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs font-black active:scale-95">
            Subir ahora
          </button>
        </div>
      )}

      {/* Galería agrupada por categoría */}
      {allCategories.filter(cat => grouped[cat]?.length > 0).map(cat => (
        <div key={cat} className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"/>
              <p className="font-black text-slate-800 text-sm">{cat}</p>
            </div>
            <span className="text-xs text-slate-400 font-bold">{grouped[cat].length} foto{grouped[cat].length !== 1 ? 's' : ''}</span>
          </div>
          <div className="p-3 grid grid-cols-3 gap-2">
            {grouped[cat].map(photo => {
              // Convertir HEIC a JPG via Cloudinary URL transform
              const imgUrl = photo.url.includes('cloudinary.com') 
                ? photo.url.replace(/\.(heic|HEIC)$/, '.jpg').replace('/upload/', '/upload/f_jpg/')
                : photo.url;
              return (
                <button key={photo.id} onClick={() => setLightbox({...photo, url: imgUrl})}
                  className="aspect-square rounded-2xl overflow-hidden bg-slate-100 active:scale-95 transition-all">
                  <img src={imgUrl} alt={cat} className="w-full h-full object-cover"/>
                </button>
              );
            })}
          </div>
          <div className="px-4 pb-3">
            <p className="text-xs text-slate-400 font-medium">Última: {grouped[cat][0]?.dateString}</p>
          </div>
        </div>
      ))}

      {/* Botón comparativa IA */}
      {photos.length >= 2 && (
        userPremium ? (
          <button onClick={generarComparativa} disabled={comparing}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 transition-all">
            {comparing
              ? <><Loader2 className="w-4 h-4 animate-spin"/> Analizando progreso...</>
              : <><Sparkles className="w-4 h-4"/> Analizar mi progreso con IA</>}
          </button>
        ) : (
          <div className="relative">
            <div className="w-full py-4 bg-slate-800 text-slate-500 rounded-2xl font-black flex items-center justify-center gap-2 opacity-60 select-none">
              <Sparkles className="w-4 h-4"/> Analizar mi progreso con IA
            </div>
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-900/70 rounded-2xl backdrop-blur-sm">
              <span className="text-lg">🔒</span>
              <span className="text-amber-400 font-black text-sm">Función Premium</span>
            </div>
          </div>
        )
      )}

      {/* Resultado comparativa */}
      {showComparativa && comparativaResult && (
        <div className="bg-slate-900 rounded-3xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400"/>
              <p className="text-white font-black text-sm">Análisis de Progreso IA</p>
            </div>
            <button onClick={() => setShowComparativa(false)} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
          </div>
          <div className="p-5">
            <div className="flex gap-2 mb-4">
              <div className="flex-1 bg-slate-800 rounded-xl p-2 text-center">
                <p className="text-xs text-slate-500 font-bold uppercase">Foto inicial</p>
                <p className="text-slate-300 text-xs font-black">{comparativaResult.desde}</p>
              </div>
              <div className="flex items-center text-slate-600 font-black">→</div>
              <div className="flex-1 bg-slate-800 rounded-xl p-2 text-center">
                <p className="text-xs text-slate-500 font-bold uppercase">Foto reciente</p>
                <p className="text-slate-300 text-xs font-black">{comparativaResult.hasta}</p>
              </div>
            </div>
            <p className="text-slate-300 text-sm font-medium leading-relaxed whitespace-pre-wrap">{comparativaResult.text}</p>
          </div>
        </div>
      )}

      {photos.length === 0 && (
        <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
          <Camera className="w-10 h-10 mx-auto mb-3 text-slate-300"/>
          <p className="text-slate-400 font-bold text-sm">Sin fotos aún</p>
          <p className="text-slate-300 text-xs mt-1">Sube tu primera foto de progreso</p>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="max-w-sm w-full space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-white font-black text-sm">{lightbox.category}</p>
                <p className="text-slate-400 text-xs">{lightbox.dateString}</p>
              </div>
              <button onClick={() => setLightbox(null)} className="text-slate-400 hover:text-white text-2xl font-bold">✕</button>
            </div>
            <img src={lightbox.url} alt={lightbox.category} className="w-full rounded-3xl object-cover max-h-[70vh]"/>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotosSection;
