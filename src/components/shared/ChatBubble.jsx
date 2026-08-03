import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const ChatBubble = ({ activeTab, uid, onOpen }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'messages'), where('userId', '==', uid), where('read', '==', false));
    const unsub = onSnapshot(q, snap => setUnreadCount(snap.size));
    return () => unsub();
  }, [uid]);

  const isOpen = activeTab === 'chat';

  return (
    <button
      onClick={onOpen}
      className={`fixed bottom-24 right-4 z-20 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95 border-4 border-white ${isOpen ? 'bg-slate-800' : 'bg-emerald-500'}`}>
      {isOpen
        ? <X className="w-5 h-5 text-white"/>
        : <MessageSquare className="w-5 h-5 text-white"/>}
      {!isOpen && unreadCount > 0 && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-white">
          <span className="text-white text-xs font-black">{unreadCount > 9 ? '9+' : unreadCount}</span>
        </div>
      )}
    </button>
  );
};

export default ChatBubble;
