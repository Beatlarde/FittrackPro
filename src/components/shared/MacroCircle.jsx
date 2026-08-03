

const MacroCircle = ({ label, grams, color, max, completed = false }) => {
  const pct = Math.min(100, Math.round((grams / max) * 100));
  const r = 16;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative w-10 h-10">
        <svg width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r={r} fill="none" stroke="#1e293b" strokeWidth="4"/>
          <circle cx="20" cy="20" r={r} fill="none" stroke={completed ? '#10b981' : color}
            strokeWidth="4" strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round" transform="rotate(-90 20 20)" className="transition-all duration-500"/>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-black text-white">{grams}g</span>
        </div>
      </div>
      <span className="text-[11px] font-bold text-slate-500 uppercase">{label}</span>
    </div>
  );
};

export default MacroCircle;
