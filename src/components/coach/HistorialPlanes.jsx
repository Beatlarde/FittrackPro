import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';

const HistorialPlanes = ({ clientId, onCargar }) => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    const q = query(
      collection(db, 'planHistorial'),
      where('userId', '==', clientId),
      limit(5)
    );
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.archivedAt?.seconds || 0) - (a.archivedAt?.seconds || 0));
      setHistorial(data);
      setLoading(false);
    });
    return () => unsub();
  }, [clientId]);

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-slate-400"/></div>;
  if (!historial.length) return <p className="text-xs text-slate-400 text-center py-3">No hay planes anteriores aún</p>;

  return (
    <div className="space-y-2 mt-2">
      {historial.map((h, i) => (
        <div key={h.id} className="flex items-center justify-between bg-slate-50 rounded-2xl p-3">
          <div>
            <p className="text-xs font-black text-slate-700">Plan #{historial.length - i}</p>
            <p className="text-xs text-slate-400">{h.semana}</p>
          </div>
          <button onClick={() => onCargar(h.plan)}
            className="bg-slate-800 text-white text-xs font-black px-3 py-2 rounded-xl active:scale-95 transition-all">
            Cargar plan
          </button>
        </div>
      ))}
    </div>
  );
};

export default HistorialPlanes;
