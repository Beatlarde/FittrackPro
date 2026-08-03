import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const SectionCollapse = ({ title, icon, defaultOpen = false, badge = null, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 active:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          {icon && <span className="text-base">{icon}</span>}
          <h3 className="font-black text-xs uppercase text-slate-600 tracking-wide">{title}</h3>
          {badge && <span className="bg-emerald-100 text-emerald-700 text-xs font-black px-2 py-0.5 rounded-full">{badge}</span>}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}/>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
};

export default SectionCollapse;
