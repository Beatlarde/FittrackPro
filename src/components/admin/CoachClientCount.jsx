import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const CoachClientCount = ({ coachId }) => {
  const [count, setCount] = useState(null);
  useEffect(() => {
    if (!coachId) return;
    const q = query(collection(db, 'users'), where('refCoachId', '==', coachId));
    getDocs(q).then(snap => setCount(snap.size)).catch(() => setCount(0));
  }, [coachId]);
  if (count === null) return <Loader2 className="w-4 h-4 animate-spin text-slate-300"/>;
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl font-black text-violet-600">{count}</span>
      <span className="text-xs text-slate-400">cliente{count !== 1 ? 's' : ''} vinculado{count !== 1 ? 's' : ''}</span>
    </div>
  );
};

export default CoachClientCount;
