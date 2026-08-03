import { useState, useEffect } from 'react';
import { ChevronRight, Loader2, Search } from 'lucide-react';
import { BACKEND_URL } from '../../config/constants';
import { getAuthToken } from '../../services/api';
import CoachClientCount from './CoachClientCount';

const CoachesAdmin = ({ showToast }) => {
  const [coaches, setCoaches] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [procesando, setProcesando] = useState(null);
  const [coachDetalle, setCoachDetalle] = useState(null); // drawer detalle

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const headers = { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
      const [resCoaches, resSolicitudes] = await Promise.all([
        fetch(`${BACKEND_URL}/admin/coaches`, { headers }),
        fetch(`${BACKEND_URL}/admin/solicitudes-coach`, { headers })
      ]);
      const dataCoaches = await resCoaches.json();
      const dataSolicitudes = await resSolicitudes.json();
      if (dataCoaches.coaches) setCoaches(dataCoaches.coaches);
      if (dataSolicitudes.solicitudes) setSolicitudes(dataSolicitudes.solicitudes);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { cargarDatos(); }, []);

  const aprobar = async (id) => {
    setProcesando(id);
    const token = await getAuthToken();
    const res = await fetch(`${BACKEND_URL}/admin/aprobar-coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ requestId: id })
    });
    const data = await res.json();
    if (data.ok) { showToast('✅ Coach aprobado'); cargarDatos(); }
    else showToast('Error: ' + data.error);
    setProcesando(null);
  };

  const rechazar = async (id) => {
    setProcesando(id);
    const token = await getAuthToken();
    await fetch(`${BACKEND_URL}/admin/rechazar-coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ requestId: id })
    });
    showToast('✅ Solicitud rechazada');
    cargarDatos();
    setProcesando(null);
  };

  const revocarCoach = async (uid, nombre) => {
    const token = await getAuthToken();
    await fetch(`${BACKEND_URL}/admin/revocar-coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ uid })
    });
    showToast(`✅ Acceso revocado a ${nombre}`);
    cargarDatos();
  };

  const pendientes = solicitudes.filter(s => s.status === 'pending');
  const coachesFiltrados = coaches.filter(c =>
    c.name?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.email?.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Métricas coaches
  const totalCoaches = coaches.length;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const hace7 = new Date(); hace7.setDate(hace7.getDate() - 7);
  const hace30 = new Date(); hace30.setDate(hace30.getDate() - 7);

  const nuevosHoy = coaches.filter(c => {
    if (!c.createdAt) return false;
    const d = c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt * 1000);
    return d >= hoy;
  }).length;

  // Gráfica últimos 14 días
  const dias14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i)); d.setHours(0,0,0,0);
    return d;
  });
  const labelsDia = dias14.map(d => d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }));
  const coachesPorDia = dias14.map(d => {
    const next = new Date(d); next.setDate(next.getDate() + 1);
    return coaches.filter(c => {
      if (!c.createdAt) return false;
      const cd = c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt * 1000);
      return cd >= d && cd < next;
    }).length;
  });
  const maxCoaches = Math.max(...coachesPorDia, 1);

  return (
    <div className="space-y-4">

      {/* Drawer detalle coach */}
      {coachDetalle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setCoachDetalle(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-[32px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-black text-slate-800">{coachDetalle.name}</h3>
                <p className="text-xs text-slate-400">{coachDetalle.email}</p>
              </div>
              <button onClick={() => setCoachDetalle(null)} className="p-2 bg-slate-100 rounded-2xl text-slate-600 font-bold text-lg">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-3">
              {/* Datos del coach */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Registro', val: (() => { const d = coachDetalle.createdAt?.toDate ? coachDetalle.createdAt.toDate() : coachDetalle.createdAt ? new Date(coachDetalle.createdAt * 1000) : null; return d ? d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'; })() },
                  { label: 'Último acceso', val: (() => { if (!coachDetalle.lastOpenTimestamp) return '—'; const d = Math.floor((Date.now() - coachDetalle.lastOpenTimestamp) / 86400000); return d === 0 ? 'Hoy' : d === 1 ? 'Ayer' : `Hace ${d}d`; })() },
                  { label: 'Código ref', val: coachDetalle.coachCode || '—' },
                  { label: 'Plan status', val: coachDetalle.planStatus || '—' },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 font-bold uppercase">{item.label}</p>
                    <p className="text-sm font-black text-slate-700 mt-0.5">{item.val}</p>
                  </div>
                ))}
              </div>
              {/* Clientes del coach */}
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-xs font-black text-slate-500 uppercase mb-2">Clientes vinculados</p>
                <CoachClientCount coachId={coachDetalle.id}/>
              </div>
              {/* Acciones */}
              <button onClick={() => { if (window.confirm(`¿Revocar acceso de coach a ${coachDetalle.name}? Esta acción no se puede deshacer.`)) { revocarCoach(coachDetalle.id, coachDetalle.name); setCoachDetalle(null); } }}
                className="w-full py-3 bg-red-50 text-red-500 font-black text-sm rounded-2xl active:scale-95 border border-red-200">
                Revocar acceso de coach
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tarjetas métricas clickeables */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Coaches', value: totalCoaches, color: 'violet', subset: coaches },
          { label: 'Pendientes', value: pendientes.length, color: 'amber', subset: pendientes },
          { label: 'Nuevos Hoy', value: nuevosHoy, color: 'emerald', subset: coaches.filter(c => { if (!c.createdAt) return false; const d = c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt * 1000); return d >= hoy; }) },
        ].map((m, i) => (
          <button key={i} onClick={() => m.subset.length > 0 && setCoachDetalle(m.subset[0])}
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left active:scale-95 transition-all">
            <p className={`text-2xl font-black text-${m.color}-600`}>{m.value}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{m.label}</p>
          </button>
        ))}
      </div>

      {/* Gráfica coaches por día */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4">Coaches nuevos — últimos 14 días</p>
        <div className="flex items-end gap-1 h-20">
          {coachesPorDia.map((val, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[11px] text-slate-400">{val > 0 ? val : ''}</span>
              <div className="w-full rounded-t-sm bg-violet-500 transition-all"
                style={{ height: `${(val / maxCoaches) * 60}px`, minHeight: val > 0 ? '4px' : '1px', opacity: val > 0 ? 1 : 0.15 }}/>
            </div>
          ))}
        </div>
        <svg className="w-full h-8 mt-1" viewBox={`0 0 ${dias14.length * 10} 24`} preserveAspectRatio="none">
          <polyline
            points={coachesPorDia.map((v, i) => `${i * 10 + 5},${22 - (v / maxCoaches) * 20}`).join(' ')}
            fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
        </svg>
        <div className="flex justify-between mt-1">
          <span className="text-[11px] text-slate-300">{labelsDia[0]}</span>
          <span className="text-[11px] text-slate-300">{labelsDia[labelsDia.length - 1]}</span>
        </div>
      </div>

      {/* Solicitudes pendientes */}
      {pendientes.length > 0 && (
        <div className="bg-white rounded-3xl p-5 border border-amber-200 shadow-sm">
          <h3 className="font-black text-sm text-slate-700 mb-4 flex items-center gap-2">
            🔔 Solicitudes pendientes
            <span className="bg-amber-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{pendientes.length}</span>
          </h3>
          <div className="space-y-3">
            {pendientes.map(s => (
              <div key={s.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-black text-slate-800">{s.nombre}</p>
                    <p className="text-xs text-slate-500">{s.email}</p>
                    {s.telefono && <p className="text-xs text-slate-400">📞 {s.telefono}</p>}
                  </div>
                  <span className="text-xs bg-amber-200 text-amber-700 font-black px-2 py-1 rounded-full">Pendiente</span>
                </div>
                {s.especialidad && <p className="text-xs text-slate-600 mb-1">🎯 {s.especialidad}</p>}
                {s.experiencia && <p className="text-xs text-slate-500 mb-3">📋 {s.experiencia}</p>}
                <div className="flex gap-2">
                  <button onClick={() => aprobar(s.id)} disabled={procesando === s.id}
                    className="flex-1 bg-emerald-500 text-white font-black text-xs py-2.5 rounded-xl active:scale-95 disabled:opacity-50">
                    {procesando === s.id ? '...' : '✅ Aprobar'}
                  </button>
                  <button onClick={() => rechazar(s.id)} disabled={procesando === s.id}
                    className="flex-1 bg-red-50 text-red-500 font-black text-xs py-2.5 rounded-xl active:scale-95 border border-red-200">
                    ❌ Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de coaches clickeable */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-sm text-slate-700">Coaches activos ({coaches.length})</h3>
          <button onClick={cargarDatos} className="text-xs text-slate-400 font-bold">↻ Actualizar</button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
          <input type="text" placeholder="Buscar coach..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-4 py-2.5 text-sm outline-none"/>
        </div>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-300"/></div> :
          coachesFiltrados.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">Sin coaches registrados</p> :
          <div className="space-y-2">
            {coachesFiltrados.map(c => {
              const lastOpen = c.lastOpenTimestamp ? new Date(c.lastOpenTimestamp) : null;
              const diasInactivo = lastOpen ? Math.floor((Date.now() - lastOpen.getTime()) / 86400000) : null;
              const activo = diasInactivo !== null && diasInactivo <= 3;
              return (
                <button key={c.id} onClick={() => setCoachDetalle(c)}
                  className="w-full flex items-center justify-between bg-slate-50 rounded-2xl p-3 active:scale-95 transition-all hover:bg-slate-100">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${activo ? 'bg-emerald-500' : 'bg-slate-300'}`}/>
                    <div className="text-left">
                      <p className="font-black text-slate-700 text-sm">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.email}</p>
                      {c.coachCode && <p className="text-xs text-emerald-500 font-bold">🔗 {c.coachCode}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{diasInactivo === null ? '—' : diasInactivo === 0 ? 'Hoy' : diasInactivo === 1 ? 'Ayer' : `${diasInactivo}d`}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300"/>
                  </div>
                </button>
              );
            })}
          </div>
        }
      </div>
    </div>
  );
};

export default CoachesAdmin;
