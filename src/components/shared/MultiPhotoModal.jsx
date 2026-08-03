import { Camera } from 'lucide-react';

const MultiPhotoModal = ({ onClose }) => (
  <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 p-4 flex items-center justify-center animate-in fade-in">
    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
      <h3 className="text-xl font-bold mb-6 text-slate-800">Fotos de Progreso 360°</h3>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {['Frente', 'Espalda', 'Perfil Izq', 'Perfil Der'].map(angle => (
          <label key={angle} className="aspect-square border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center bg-slate-50 hover:border-emerald-500 transition-colors cursor-pointer text-slate-400 hover:text-emerald-500">
            <Camera className="w-6 h-6 mb-2" />
            <span className="text-xs font-bold uppercase">{angle}</span>
            <input type="file" className="hidden" accept="image/*" />
          </label>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl active:scale-95">Cancelar</button>
        <button onClick={onClose} className="flex-1 py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-200 active:scale-95">Guardar Todo</button>
      </div>
    </div>
  </div>
);

export default MultiPhotoModal;
