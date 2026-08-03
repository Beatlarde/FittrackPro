import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const ChatMensajesCoach = ({ uid }) => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      where('userId', '==', uid)
    );
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setMessages(data);
    });
    return () => unsub();
  }, [uid]);

  if (messages.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-slate-100 p-6 rounded-full mb-4">
        <MessageSquare className="w-10 h-10 text-slate-300"/>
      </div>
      <p className="font-black text-slate-600 text-sm">¡Todo al día! Sin mensajes nuevos</p>
      <p className="text-slate-400 text-xs mt-1">Tu coach te enviará mensajes aquí</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Mensajes de tu coach</p>
      {messages.map(msg => (
        <div key={msg.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <div className="bg-purple-100 w-8 h-8 rounded-full flex items-center justify-center shrink-0">
              <span className="text-purple-700 font-black text-xs">{(msg.coachName || 'C')[0].toUpperCase()}</span>
            </div>
            <div>
              <p className="font-black text-slate-800 text-xs">{msg.coachName || 'Tu Coach'}</p>
              <p className="text-slate-400 text-xs">{msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : 'Ahora'}</p>
            </div>
            {!msg.read && <span className="ml-auto w-2 h-2 bg-purple-500 rounded-full shrink-0"/>}
          </div>
          <p className="px-4 pb-4 text-slate-700 text-sm font-medium leading-relaxed">{msg.text}</p>
        </div>
      ))}
    </div>
  );
};

export default ChatMensajesCoach;
