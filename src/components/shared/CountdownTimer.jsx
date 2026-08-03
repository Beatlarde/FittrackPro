import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

const CountdownTimer = ({ deadline, compact = false }) => {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const calc = () => {
      const diff = deadline - Date.now();
      if (diff <= 0) { setTimeLeft(null); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ h, m, s, diff });
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!timeLeft) return null;

  const pct = Math.max(0, (timeLeft.diff / (24 * 3600000)) * 100);
  const isUrgent = timeLeft.h < 3;

  if (compact) return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${isUrgent ? 'bg-red-500/10 border border-red-500/20' : 'bg-blue-500/10 border border-blue-500/20'}`}>
      <Clock className={`w-3 h-3 ${isUrgent ? 'text-red-400' : 'text-blue-400'}`} />
      <span className={`text-xs font-black ${isUrgent ? 'text-red-400' : 'text-blue-400'}`}>
        {String(timeLeft.h).padStart(2,'0')}:{String(timeLeft.m).padStart(2,'0')}:{String(timeLeft.s).padStart(2,'0')}
      </span>
    </div>
  );

  return (
    <div className={`rounded-3xl p-5 border ${isUrgent ? 'bg-red-500/10 border-red-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className={`w-4 h-4 ${isUrgent ? 'text-red-400' : 'text-blue-400'}`} />
          <span className={`text-xs font-black uppercase tracking-widest ${isUrgent ? 'text-red-400' : 'text-blue-400'}`}>
            {isUrgent ? '⚠️ Tiempo casi agotado' : 'Tu coach tiene hasta'}
          </span>
        </div>
      </div>
      {/* Dígitos grandes */}
      <div className="flex items-center justify-center gap-3 mb-4">
        {[{ val: timeLeft.h, label: 'hrs' }, { val: timeLeft.m, label: 'min' }, { val: timeLeft.s, label: 'seg' }].map(({ val, label }, i) => (
          <div key={label} className="flex items-center gap-3">
            {i > 0 && <span className={`text-2xl font-black ${isUrgent ? 'text-red-400' : 'text-blue-400'}`}>:</span>}
            <div className="text-center">
              <p className={`text-4xl font-black tabular-nums ${isUrgent ? 'text-red-300' : 'text-white'}`}>
                {String(val).padStart(2, '0')}
              </p>
              <p className="text-slate-500 text-xs font-bold uppercase">{label}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Barra de progreso */}
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? 'bg-red-500' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-slate-500 text-xs font-medium text-center mt-2">para entregar tu plan personalizado</p>
    </div>
  );
};

export default CountdownTimer;
