

const PremiumBanner = ({ onClose, onUpgrade }) => (
  <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl p-4 relative overflow-hidden">
    <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full"/>
    <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/5 rounded-full"/>
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">⭐</span>
          <p className="text-white font-black text-sm">Desbloquea Premium — $99/mes</p>
        </div>
        {onClose && <button onClick={onClose} className="text-white/70 text-xl font-bold leading-none">✕</button>}
      </div>
      <p className="text-white/90 text-xs font-medium mb-3 leading-relaxed">
        Plan 7 días · Alternativas ilimitadas · Lista del súper · Fotos · Videos
      </p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white/20 rounded-xl p-2 text-center">
          <p className="text-white font-black text-xs">📅 7 días</p>
          <p className="text-white/70 text-xs">completos</p>
        </div>
        <div className="bg-white/20 rounded-xl p-2 text-center">
          <p className="text-white font-black text-xs">🔄 Sin límite</p>
          <p className="text-white/70 text-xs">alternativas</p>
        </div>
        <div className="bg-white/20 rounded-xl p-2 text-center">
          <p className="text-white font-black text-xs">🛒 Lista</p>
          <p className="text-white/70 text-xs">del súper</p>
        </div>
      </div>
      <button onClick={onUpgrade} className="w-full bg-white text-orange-500 py-3 rounded-2xl font-black text-sm active:scale-95 transition-all shadow-lg">
        Ver planes →
      </button>
    </div>
  </div>
);

export default PremiumBanner;
