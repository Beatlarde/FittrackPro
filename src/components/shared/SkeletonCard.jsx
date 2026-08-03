

const SkeletonCard = ({ lines = 2 }) => (
  <div className="bg-white rounded-2xl p-4 border border-slate-100 animate-pulse">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 bg-slate-200 rounded-2xl shrink-0"/>
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-slate-200 rounded-full w-3/4"/>
        <div className="h-2 bg-slate-100 rounded-full w-1/2"/>
      </div>
    </div>
    {Array.from({ length: lines - 1 }).map((_, i) => (
      <div key={i} className="h-2 bg-slate-100 rounded-full mb-2" style={{ width: `${70 + i * 10}%` }}/>
    ))}
  </div>
);

export default SkeletonCard;
