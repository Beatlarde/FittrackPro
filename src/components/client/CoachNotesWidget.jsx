import { useState } from 'react';
import { CheckCircle, Send, Loader2, FileText } from 'lucide-react';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '../../hooks/useToast';

const CoachNotesWidget = ({ uid, initialNotes }) => {
  const [notes, setNotes] = useState(initialNotes);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const showToast = useToast();

  const saveNotes = async () => {
    setSaving(true);
    await updateDoc(doc(db, 'users', uid), { coachNotes: notes });
    setSaving(false);
    setSaved(true);
    setEditing(false);
    showToast('✅ Nota enviada a tu coach');
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-blue-100 p-2 rounded-xl"><FileText className="w-4 h-4 text-blue-600"/></div>
          <div>
            <p className="font-black text-slate-800 text-sm">Notas para tu coach</p>
            <p className="text-xs text-slate-400 font-medium">Tu coach las verá antes de crear tu plan</p>
          </div>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-all">
            {notes ? 'Editar' : '+ Agregar'}
          </button>
        )}
      </div>

      <div className="p-5">
        {editing ? (
          <div className="space-y-3">
            <textarea
              autoFocus
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-400 p-4 rounded-2xl text-sm font-medium outline-none resize-none transition-colors"
              rows={5}
              placeholder="Alergias, horarios, preferencias, condiciones médicas, lo que creas importante..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={500}
            />
            <p className="text-slate-400 text-xs font-medium text-right">{notes.length}/500</p>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setNotes(initialNotes); }}
                className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-bold text-sm active:scale-95">
                Cancelar
              </button>
              <button onClick={saveNotes} disabled={saving}
                className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <><Send className="w-3.5 h-3.5"/> Enviar al coach</>}
              </button>
            </div>
          </div>
        ) : notes ? (
          <p className="text-slate-600 text-sm font-medium leading-relaxed whitespace-pre-wrap">{notes}</p>
        ) : (
          <p className="text-slate-400 text-sm font-medium text-center py-3">Agrega notas para que tu coach las considere al crear tu plan</p>
        )}
        {saved && (
          <p className="text-emerald-500 text-xs font-black flex items-center gap-1 mt-2">
            <CheckCircle className="w-3.5 h-3.5"/> Guardado y visible para tu coach
          </p>
        )}
      </div>
    </div>
  );
};

// --- SECCIÓN DE FOTOS ---
const PHOTO_CATEGORIES = ['Fotos iniciales', 'Avance 1 mes', 'Avance 2 meses', 'Avance 3 meses'];

export default CoachNotesWidget;
