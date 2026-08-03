import { isPremium } from '../../utils/metrics';

const PremiumGate = ({ user, children, onUpgrade }) => {
  if (isPremium(user)) return children;
  return (
    <div className="relative">
      <div className="opacity-40 pointer-events-none select-none">{children}</div>
      <button onClick={onUpgrade}
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/60 rounded-2xl backdrop-blur-sm active:scale-95 transition-all">
        <span className="text-2xl">🔒</span>
        <span className="text-white font-black text-xs bg-amber-500 px-3 py-1 rounded-full">Premium</span>
      </button>
    </div>
  );
};

export default PremiumGate;
