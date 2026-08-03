import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';

const CoachMessageBanner = ({ uid }) => {
  const [unread, setUnread] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'messages'), where('userId', '==', uid), where('read', '==', false));
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      msgs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setUnread(msgs[0] || null);
    });
    return () => unsub();
  }, [uid]);

  if (!unread) return null;

  const markRead = async () => {
    await updateDoc(doc(db, 'messages', unread.id), { read: true });
  };

  return (
    <div className="bg-purple-600 rounded-3xl p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/30 to-purple-800/30"/>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-purple-200"/>
            <p className="text-purple-200 text-xs font-black uppercase tracking-wider">Mensaje de {unread.coachName || 'Tu Coach'}</p>
          </div>
          <button onClick={markRead} className="text-purple-300 text-xl font-bold leading-none">✕</button>
        </div>
        <p className="text-white font-medium text-sm leading-relaxed">{unread.text}</p>
        <button onClick={markRead} className="mt-3 text-purple-200 text-xs font-black uppercase tracking-wider">
          Marcar como leído →
        </button>
      </div>
    </div>
  );
};

export default CoachMessageBanner;
