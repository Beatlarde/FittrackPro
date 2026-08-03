import { Dumbbell, Flame, Trophy, Target } from 'lucide-react';

const AchievementsBoard = ({ streakDays, maxSquat, totalLogs = 0 }) => {
  const days = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'];

  // Rango basado en XP real
  const xp = (streakDays * 150) + (totalLogs * 50);
  const rango = xp === 0 ? { nombre: 'Principiante', icon: '🌱' }
    : xp < 500 ? { nombre: 'Novato', icon: '⚡' }
    : xp < 1500 ? { nombre: 'Atleta de Bronce', icon: '🥉' }
    : xp < 3000 ? { nombre: 'Atleta de Plata', icon: '🥈' }
    : xp < 6000 ? { nombre: 'Atleta de Oro', icon: '🥇' }
    : { nombre: 'Élite', icon: '🏆' };

  // Adherencia real basada en logs
  const adherencia = totalLogs === 0 ? 0 : Math.min(100, Math.round((totalLogs / Math.max(streakDays, 1)) * 100));

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="bg-slate-200 w-12 h-12 rounded-full flex items-center justify-center border-2 border-emerald-500">
            <Trophy className="text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xs uppercase font-black text-slate-400">Rango Actual</h2>
            <p className="font-black text-slate-800 text-xl">{rango.icon} {rango.nombre}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase font-black text-slate-400">Total Puntos</p>
          <p className="font-black text-emerald-600 text-xl">{xp} XP</p>
        </div>
      </div>
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Flame className="text-orange-500 w-5 h-5" />
            <h3 className="font-bold">Racha Activa</h3>
          </div>
          <span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-emerald-400">{streakDays} Días seguidos</span>
        </div>
        <div className="flex justify-between px-2">
          {days.map((day, i) => {
            const isDone = i < Math.min(streakDays, 7);
            return (
              <div key={day} className="text-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${isDone ? 'bg-emerald-500' : 'bg-slate-800'}`}>
                  <Flame className={`w-4 h-4 ${isDone ? 'text-white' : 'text-slate-600'}`} />
                </div>
                <span className="text-[11px] font-bold text-slate-500 uppercase">{day}</span>
              </div>
            );
          })}
        </div>
      </div>
      <section>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider">Récords Personales</h3>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[
            {
              label: 'Max 1RM Proyectado',
              val: maxSquat > 0 ? `${maxSquat} kg` : '— kg',
              diff: maxSquat > 0 ? '¡Nuevo récord!' : 'Sin registros aún',
              icon: Dumbbell
            },
            {
              label: 'Adherencia',
              val: totalLogs === 0 ? '0%' : `${adherencia}%`,
              diff: totalLogs === 0 ? 'Empieza a registrar' : adherencia >= 80 ? 'Consistente 🔥' : 'Sigue adelante',
              icon: Target
            }
          ].map(pr => (
            <div key={pr.label} className="min-w-[160px] bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center">
              <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <pr.icon className="text-emerald-500 w-5 h-5" />
              </div>
              <h4 className="text-xs uppercase font-black text-slate-400 mb-1">{pr.label}</h4>
              <p className="text-xl font-black text-slate-800">{pr.val}</p>
              <p className="text-xs text-emerald-500 font-bold mt-2">{pr.diff}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AchievementsBoard;
