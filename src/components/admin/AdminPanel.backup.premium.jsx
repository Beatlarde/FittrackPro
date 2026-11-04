import React, { useState, useEffect } from 'react';
import { Users, MessageSquare, Activity, TrendingUp, LogOut, Send, Loader2, Shield, CreditCard, AlertTriangle, BarChart2, UserCheck, UserX, Search, Bell, XCircle } from 'lucide-react';
import { auth, db } from '../../firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { BACKEND_URL } from '../../config/constants';
import { getAuthToken } from '../../services/api';
import { ToastContext } from '../../context/ToastContext';
import CoachesAdmin from './CoachesAdmin';

const AdminPanel = ({ user }) => {
  const [seccion, setSeccion] = useState('metricas');
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [mensajeAdmin, setMensajeAdmin] = useState('');
  const [enviandoMsg, setEnviandoMsg] = useState(null);
  const [enviandoMasivo, setEnviandoMasivo] = useState(false);
  const [mensajesIndividuales, setMensajesIndividuales] = useState({});
  const [busquedaSoporte, setBusquedaSoporte] = useState('');
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [metricaDetalle, setMetricaDetalle] = useState(null);
  const showToast = React.useContext(ToastContext);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const togglePremium = async (uid, actual) => {
    await updateDoc(doc(db, 'users', uid), { premium: !actual });
    // Actualizar daysUnlocked en el plan
    try {
      const token = await getAuthToken();
      await fetch(`${BACKEND_URL}/admin/actualizar-plan-premium`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ uid, premium: !actual })
      });
    } catch {}
    showToast(!actual ? '⭐ Usuario ahora es Premium' : '🔄 Usuario vuelto a Free');
  };

  const enviarMensaje = async (u) => {
    const texto = mensajesIndividuales[u.id] || '';
    if (!texto.trim()) return;
    setEnviandoMsg(u.id);
    try {
      await addDoc(collection(db, 'messages'), {
        userId: u.id, from: 'admin', fromName: 'FitTrack Admin',
        text: texto, timestamp: serverTimestamp(), read: false
      });
      if (u.email) {
        await fetch(`${BACKEND_URL}/send-email`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: u.email, subject: '📢 Mensaje de FitTrack Pro', html: `<p>${texto}</p>` })
        });
      }
      showToast(`✅ Mensaje enviado a ${u.name}`);
      setMensajesIndividuales(prev => ({ ...prev, [u.id]: '' }));
    } catch(e) { showToast('❌ Error al enviar', 'error'); }
    setEnviandoMsg(null);
  };

  // Métricas
  const total = usuarios.length;
  const premium = usuarios.filter(u => u.premium).length;
  const free = total - premium;
  const activos = usuarios.filter(u => u.planStatus === 'active').length;
  const sinPlan = usuarios.filter(u => !u.planStatus || u.planStatus === 'pending').length;
  const coaches = usuarios.filter(u => u.role === 'coach').length;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const nuevosHoy = usuarios.filter(u => {
    if (!u.createdAt) return false;
    const d = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
    return d >= hoy;
  }).length;

  const usuariosFiltrados = usuarios.filter(u =>
    !busqueda || u.name?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.email?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const pagosVencidos = usuarios.filter(u => {
    if (!u.premium || !u.premiumUntil) return false;
    return u.premiumUntil < Date.now();
  });

  const tabs = [
    { id: 'metricas', label: 'Métricas', icon: BarChart2 },
    { id: 'usuarios', label: 'Usuarios', icon: Users },
    { id: 'coaches', label: 'Coaches', icon: UserCheck },
    { id: 'pagos', label: 'Pagos', icon: CreditCard },
    { id: 'soporte', label: 'Soporte', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 text-white px-5 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-emerald-500 p-2 rounded-xl"><Shield className="w-5 h-5 text-white"/></div>
          <div className="flex-1">
            <h1 className="font-black text-lg">Panel Admin</h1>
            <p className="text-slate-400 text-xs">FitTrack Pro — {user.email}</p>
          </div>
          <button onClick={() => signOut(auth)} className="bg-slate-800 p-2.5 rounded-2xl active:scale-95 transition-all">
            <LogOut className="w-5 h-5 text-slate-400"/>
          </button>
        </div>
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setSeccion(t.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
                seccion === t.id ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
              <t.icon className="w-3.5 h-3.5"/>{t.label}
              {t.id === 'pagos' && pagosVencidos.length > 0 && (
                <span className="bg-red-500 text-white text-xs font-black rounded-full px-1.5">{pagosVencidos.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">

        {/* ── MÉTRICAS ── */}
        {seccion === 'metricas' && (
          <div className="space-y-4">

            {/* Modal drawer de detalle de usuarios */}
            {metricaDetalle && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setMetricaDetalle(null)}>
                <div className="bg-white w-full max-w-lg rounded-t-[32px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div>
                      <h3 className="font-black text-slate-800">{metricaDetalle.label}</h3>
                      <p className="text-xs text-slate-400">{metricaDetalle.usuarios.length} usuarios</p>
                    </div>
                    <button onClick={() => setMetricaDetalle(null)} className="p-2 bg-slate-100 rounded-2xl text-slate-600 font-bold text-lg">✕</button>
                  </div>
                  <div className="overflow-y-auto flex-1 p-4 space-y-2">
                    {metricaDetalle.usuarios.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm py-8">Sin usuarios en esta categoría</p>
                    ) : metricaDetalle.usuarios.map(u => {
                      const createdAt = u.createdAt?.toDate ? u.createdAt.toDate() : u.createdAt ? new Date(u.createdAt * 1000) : null;
                      const lastOpen = u.lastOpenTimestamp ? new Date(u.lastOpenTimestamp) : null;
                      const diasDesdeUltimoAcceso = lastOpen ? Math.floor((Date.now() - lastOpen.getTime()) / 86400000) : null;
                      const activo = diasDesdeUltimoAcceso !== null && diasDesdeUltimoAcceso <= 3;
                      return (
                        <div key={u.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-black text-slate-800 text-sm">{u.name || 'Sin nombre'}</p>
                                {u.premium && <span className="bg-amber-100 text-amber-700 text-xs font-black px-2 py-0.5 rounded-full">⭐</span>}
                                <span className={`w-2 h-2 rounded-full ${activo ? 'bg-emerald-500' : 'bg-slate-300'}`} title={activo ? 'Activo recientemente' : 'Inactivo'}/>
                              </div>
                              <p className="text-xs text-slate-400">{u.email}</p>
                            </div>
                            <span className={`text-xs font-black px-2 py-1 rounded-full ${u.planStatus === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {u.planStatus || 'sin plan'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="bg-white rounded-xl p-2">
                              <p className="text-xs text-slate-400 font-bold uppercase">Registro</p>
                              <p className="text-xs font-black text-slate-700">
                                {createdAt ? createdAt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                              </p>
                            </div>
                            <div className="bg-white rounded-xl p-2">
                              <p className="text-xs text-slate-400 font-bold uppercase">Último acceso</p>
                              <p className={`text-xs font-black ${activo ? 'text-emerald-600' : 'text-slate-500'}`}>
                                {diasDesdeUltimoAcceso === null ? '—' : diasDesdeUltimoAcceso === 0 ? 'Hoy' : diasDesdeUltimoAcceso === 1 ? 'Ayer' : `Hace ${diasDesdeUltimoAcceso}d`}
                              </p>
                            </div>
                            <div className="bg-white rounded-xl p-2">
                              <p className="text-xs text-slate-400 font-bold uppercase">Objetivo</p>
                              <p className="text-xs font-black text-slate-700">{u.goals?.objective || '—'}</p>
                            </div>
                            <div className="bg-white rounded-xl p-2">
                              <p className="text-xs text-slate-400 font-bold uppercase">Modalidad</p>
                              <p className="text-xs font-black text-slate-700">{u.modalidad || '—'}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Tarjetas de métricas clickeables */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Usuarios', value: total, icon: Users, color: 'blue',
                  usuarios: usuarios },
                { label: 'Premium', value: premium, icon: UserCheck, color: 'emerald',
                  usuarios: usuarios.filter(u => u.premium) },
                { label: 'Free', value: free, icon: UserX, color: 'slate',
                  usuarios: usuarios.filter(u => !u.premium) },
                { label: 'Con Plan Activo', value: activos, icon: Activity, color: 'violet',
                  usuarios: usuarios.filter(u => u.planStatus === 'active') },
                { label: 'Sin Plan', value: sinPlan, icon: AlertTriangle, color: 'amber',
                  usuarios: usuarios.filter(u => !u.planStatus || u.planStatus === 'pending') },
                { label: 'Nuevos Hoy', value: nuevosHoy, icon: TrendingUp, color: 'pink',
                  usuarios: usuarios.filter(u => {
                    if (!u.createdAt) return false;
                    const d = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt * 1000);
                    return d >= hoy;
                  })
                },
              ].map((m, i) => (
                <button key={i} onClick={() => setMetricaDetalle(m)}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left active:scale-95 transition-all hover:border-slate-300">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 bg-${m.color}-100`}>
                    <m.icon className={`w-4 h-4 text-${m.color}-600`}/>
                  </div>
                  <p className="text-2xl font-black text-slate-800">{m.value}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{m.label}</p>
                  <p className="text-xs text-slate-300 mt-1">Toca para ver detalle →</p>
                </button>
              ))}
            </div>

            {/* Gráficas de negocio */}
            {(() => {
              // Calcular datos por día (últimos 14 días)
              const dias14 = Array.from({ length: 14 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - (13 - i)); d.setHours(0,0,0,0);
                return d;
              });

              const labelsDia = dias14.map(d => d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }));

              const nuevosPorDia = dias14.map(d => {
                const next = new Date(d); next.setDate(next.getDate() + 1);
                return usuarios.filter(u => {
                  if (!u.createdAt) return false;
                  const uc = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt * 1000);
                  return uc >= d && uc < next;
                }).length;
              });

              const premiumPorDia = dias14.map(d => {
                const next = new Date(d); next.setDate(next.getDate() + 1);
                return usuarios.filter(u => {
                  if (!u.premium || !u.premiumUpdatedAt) return false;
                  const pa = new Date(u.premiumUpdatedAt);
                  return pa >= d && pa < next;
                }).length;
              });

              const maxNuevos = Math.max(...nuevosPorDia, 1);
              const maxPremium = Math.max(...premiumPorDia, 1);

              // Acumulado semana y mes
              const hace7 = new Date(); hace7.setDate(hace7.getDate() - 7);
              const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30);

              const nuevos7 = usuarios.filter(u => {
                if (!u.createdAt) return false;
                const d = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt * 1000);
                return d >= hace7;
              }).length;

              const nuevos30 = usuarios.filter(u => {
                if (!u.createdAt) return false;
                const d = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt * 1000);
                return d >= hace30;
              }).length;

              const premium7 = usuarios.filter(u => u.premium && u.premiumUpdatedAt && new Date(u.premiumUpdatedAt) >= hace7).length;
              const premium30 = usuarios.filter(u => u.premium && u.premiumUpdatedAt && new Date(u.premiumUpdatedAt) >= hace30).length;

              return (
                <div className="space-y-4">
                  {/* Resumen periodos */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Resumen por período</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Hoy', nuevos: nuevosHoy, prem: usuarios.filter(u => u.premium && u.premiumUpdatedAt && new Date(u.premiumUpdatedAt) >= hoy).length },
                        { label: '7 días', nuevos: nuevos7, prem: premium7 },
                        { label: '30 días', nuevos: nuevos30, prem: premium30 },
                      ].map(p => (
                        <div key={p.label} className="bg-slate-50 rounded-xl p-3 text-center">
                          <p className="text-xs font-black text-slate-400 uppercase mb-2">{p.label}</p>
                          <p className="text-lg font-black text-blue-600">{p.nuevos}</p>
                          <p className="text-xs text-slate-400">nuevos</p>
                          <p className="text-lg font-black text-emerald-600 mt-1">{p.prem}</p>
                          <p className="text-xs text-slate-400">premium</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Gráfica usuarios nuevos */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4">Usuarios nuevos — últimos 14 días</p>
                    <div className="flex items-end gap-1 h-24">
                      {nuevosPorDia.map((val, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[11px] text-slate-400">{val > 0 ? val : ''}</span>
                          <div className="w-full rounded-t-sm bg-blue-500 transition-all"
                            style={{ height: `${(val / maxNuevos) * 72}px`, minHeight: val > 0 ? '4px' : '1px', opacity: val > 0 ? 1 : 0.2 }}/>
                        </div>
                      ))}
                    </div>
                    {/* Línea de tendencia */}
                    <svg className="w-full h-8 mt-1" viewBox={`0 0 ${dias14.length * 10} 24`} preserveAspectRatio="none">
                      <polyline
                        points={nuevosPorDia.map((v, i) => `${i * 10 + 5},${22 - (v / maxNuevos) * 20}`).join(' ')}
                        fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                        opacity="0.6"/>
                    </svg>
                    <div className="flex justify-between mt-1">
                      <span className="text-[11px] text-slate-300">{labelsDia[0]}</span>
                      <span className="text-[11px] text-slate-300">{labelsDia[labelsDia.length - 1]}</span>
                    </div>
                  </div>

                  {/* Gráfica premium */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4">Conversiones Premium — últimos 14 días</p>
                    <div className="flex items-end gap-1 h-24">
                      {premiumPorDia.map((val, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[11px] text-slate-400">{val > 0 ? val : ''}</span>
                          <div className="w-full rounded-t-sm bg-emerald-500 transition-all"
                            style={{ height: `${(val / maxPremium) * 72}px`, minHeight: val > 0 ? '4px' : '1px', opacity: val > 0 ? 1 : 0.2 }}/>
                        </div>
                      ))}
                    </div>
                    {/* Línea de tendencia */}
                    <svg className="w-full h-8 mt-1" viewBox={`0 0 ${dias14.length * 10} 24`} preserveAspectRatio="none">
                      <polyline
                        points={premiumPorDia.map((v, i) => `${i * 10 + 5},${22 - (v / maxPremium) * 20}`).join(' ')}
                        fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                        opacity="0.6"/>
                    </svg>
                    <div className="flex justify-between mt-1">
                      <span className="text-[11px] text-slate-300">{labelsDia[0]}</span>
                      <span className="text-[11px] text-slate-300">{labelsDia[labelsDia.length - 1]}</span>
                    </div>
                  </div>

                  {/* Conversión y distribución */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Conversión Free → Premium</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${total > 0 ? (premium/total*100).toFixed(0) : 0}%` }}/>
                      </div>
                      <span className="text-emerald-600 font-black text-sm">{total > 0 ? (premium/total*100).toFixed(0) : 0}%</span>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-xs text-slate-400">{free} free</span>
                      <span className="text-xs text-emerald-600">{premium} premium</span>
                    </div>
                  </div>

                  {/* Distribución por objetivo */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Distribución por Objetivo</p>
                    {['perder grasa', 'ganar músculo', 'recomposición', 'mantenimiento'].map(obj => {
                      const count = usuarios.filter(u => u.goals?.objective?.toLowerCase().includes(obj.split(' ')[0])).length;
                      return count > 0 ? (
                        <div key={obj} className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-slate-500 w-28 capitalize">{obj}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-2">
                            <div className="bg-slate-700 h-full rounded-full" style={{ width: `${total > 0 ? (count/total*100) : 0}%` }}/>
                          </div>
                          <span className="text-xs font-black text-slate-600 w-6 text-right">{count}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── USUARIOS ── */}
        {seccion === 'usuarios' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o email..."
                className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-emerald-400"/>
            </div>
            <p className="text-xs text-slate-400 font-bold">{usuariosFiltrados.length} usuarios</p>
            {loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin w-6 h-6 text-emerald-500"/></div> :
              usuariosFiltrados.map(u => (
                <div key={u.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-black text-slate-800 text-sm">{u.name || 'Sin nombre'}</p>
                        {u.premium && <span className="bg-amber-100 text-amber-700 text-xs font-black px-2 py-0.5 rounded-full">⭐ PREMIUM</span>}
                        {u.role === 'coach' && <span className="bg-violet-100 text-violet-700 text-xs font-black px-2 py-0.5 rounded-full">🎯 COACH</span>}
                      </div>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                    <span className={`text-xs font-black px-2 py-1 rounded-full ${
                      u.planStatus === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      u.planStatus === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                    }`}>{u.planStatus || 'sin plan'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                    <span>🎯 {u.goals?.objective || '—'}</span>
                    <span>•</span>
                    <span>⚖️ {u.goals?.weight || '?'}kg</span>
                    <span>•</span>
                    <span>📅 {u.modalidad || '—'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => togglePremium(u.id, u.premium)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition-all ${
                        u.premium ? 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}>
                      {u.premium ? <><XCircle className="w-3 h-3"/> Quitar Premium</> : <><UserCheck className="w-3 h-3"/> Dar Premium</>}
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ── COACHES ── */}
        {seccion === 'coaches' && (
          <CoachesAdmin showToast={showToast} />
        )}

        {/* ── PAGOS ── */}
        {seccion === 'pagos' && (
          <div className="space-y-4">
            {pagosVencidos.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-500"/>
                  <p className="text-sm font-black text-red-700">Pagos Vencidos ({pagosVencidos.length})</p>
                </div>
                {pagosVencidos.map(u => (
                  <div key={u.id} className="flex items-center justify-between py-2 border-b border-red-100 last:border-0">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                    <button onClick={() => togglePremium(u.id, true)}
                      className="bg-red-500 text-white text-xs font-black px-3 py-1.5 rounded-xl">
                      Desactivar
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Todos los usuarios Premium</p>
              {usuarios.filter(u => u.premium).length === 0
                ? <p className="text-sm text-slate-400 text-center py-4">No hay usuarios premium aún</p>
                : usuarios.filter(u => u.premium).map(u => (
                  <div key={u.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                      {u.premiumUntil && (
                        <p className="text-xs text-slate-400">
                          Vence: {new Date(u.premiumUntil).toLocaleDateString('es-MX')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <span className="bg-emerald-100 text-emerald-700 text-xs font-black px-2 py-1 rounded-full">⭐ Activo</span>
                      <button onClick={() => togglePremium(u.id, true)}
                        className="bg-slate-100 text-slate-500 text-xs font-black px-2 py-1 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all">
                        Revocar
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-200">
              <p className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-1">🔑 Cortafuego — Activar Premium Manual</p>
              <p className="text-xs text-slate-400 mb-3">Si un usuario pagó pero no tiene acceso Premium.</p>
              <div className="space-y-2">
                <input id="cortafuego-email" type="email" placeholder="email@usuario.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400"/>
                <input id="cortafuego-motivo" type="text" placeholder="Motivo (ej: pago procesado manualmente)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400"/>
                <button onClick={async () => {
                  const email = document.getElementById('cortafuego-email').value.trim();
                  const motivo = document.getElementById('cortafuego-motivo').value.trim() || 'activación manual';
                  if (!email) return;
                  try {
                    const token = await getAuthToken();
                    const res = await fetch(`${BACKEND_URL}/admin/activar-premium`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                      body: JSON.stringify({ email, motivo })
                    });
                    const data = await res.json();
                    if (data.ok) showToast(`✅ Premium activado para ${email}`);
                    else showToast(`❌ ${data.error}`, 'error');
                  } catch(e) { showToast('Sin conexión. Verifica tu internet.', 'error'); }
                }} className="w-full bg-emerald-500 text-white font-black py-3 rounded-xl text-sm active:scale-95">
                  🔑 Activar Premium
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Dar Premium Manual</p>
              {usuarios.filter(u => !u.premium && u.role !== 'coach').map(u => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </div>
                  <button onClick={() => togglePremium(u.id, false)}
                    className="bg-emerald-50 text-emerald-600 text-xs font-black px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition-all">
                    + Premium
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SOPORTE ── */}
        {seccion === 'soporte' && (
          <div className="space-y-3">
            {/* Mensaje Masivo */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">
                📢 Mensaje Masivo — {usuarios.filter(u => u.role !== 'coach').length} usuarios
              </p>
              <textarea value={mensajeAdmin} onChange={e => setMensajeAdmin(e.target.value)}
                placeholder="Escribe un mensaje para todos los usuarios..."
                className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-emerald-400 mb-3"
                rows={3}/>
              <button onClick={async () => {
                if (!mensajeAdmin.trim() || enviandoMasivo) return;
                setEnviandoMasivo(true);
                const destinatarios = usuarios.filter(u => u.email && u.role !== 'coach');
                for (const u of destinatarios) {
                  await fetch(`${BACKEND_URL}/send-email`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ to: u.email, subject: '📢 Mensaje de FitTrack Pro', html: `<p style="font-size:15px;color:#1e293b">${mensajeAdmin}</p>` })
                  });
                }
                showToast(`✅ Enviado a ${destinatarios.length} usuarios`);
                setMensajeAdmin('');
                setEnviandoMasivo(false);
              }} disabled={enviandoMasivo || !mensajeAdmin.trim()}
                className="w-full bg-slate-900 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {enviandoMasivo ? <><Loader2 className="w-4 h-4 animate-spin"/> Enviando...</> : <><Bell className="w-4 h-4"/> Enviar a Todos</>}
              </button>
            </div>

            {/* Búsqueda + mensaje individual */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">✉️ Mensaje Individual</p>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                <input value={busquedaSoporte} onChange={e => { setBusquedaSoporte(e.target.value); setUsuarioSeleccionado(null); }}
                  placeholder="Buscar usuario por nombre o email..."
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-400"/>
              </div>

              {/* Resultados de búsqueda */}
              {busquedaSoporte && !usuarioSeleccionado && (
                <div className="border border-slate-100 rounded-xl overflow-hidden mb-3">
                  {usuarios.filter(u => u.role !== 'coach' && (
                    u.name?.toLowerCase().includes(busquedaSoporte.toLowerCase()) ||
                    u.email?.toLowerCase().includes(busquedaSoporte.toLowerCase())
                  )).slice(0, 5).map(u => (
                    <button key={u.id} onClick={() => { setUsuarioSeleccionado(u); setBusquedaSoporte(u.name); }}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 text-left">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{u.name}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                      {u.premium && <span className="text-xs bg-amber-100 text-amber-700 font-black px-2 py-0.5 rounded-full">⭐</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* Input mensaje para usuario seleccionado */}
              {usuarioSeleccionado && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2">
                    <UserCheck className="w-4 h-4 text-emerald-600"/>
                    <span className="text-sm font-bold text-emerald-700">{usuarioSeleccionado.name}</span>
                    <button onClick={() => { setUsuarioSeleccionado(null); setBusquedaSoporte(''); }}
                      className="ml-auto text-slate-400 hover:text-red-500">
                      <XCircle className="w-4 h-4"/>
                    </button>
                  </div>
                  <textarea
                    value={mensajesIndividuales[usuarioSeleccionado.id] || ''}
                    onChange={e => setMensajesIndividuales(prev => ({ ...prev, [usuarioSeleccionado.id]: e.target.value }))}
                    placeholder={`Escribe un mensaje para ${usuarioSeleccionado.name}...`}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-emerald-400"
                    rows={3}/>
                  <button onClick={() => enviarMensaje(usuarioSeleccionado)}
                    disabled={enviandoMsg === usuarioSeleccionado.id || !mensajesIndividuales[usuarioSeleccionado.id]?.trim()}
                    className="w-full bg-emerald-500 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    {enviandoMsg === usuarioSeleccionado.id
                      ? <><Loader2 className="w-4 h-4 animate-spin"/> Enviando...</>
                      : <><Send className="w-4 h-4"/> Enviar Mensaje</>}
                  </button>
                </div>
              )}

              {!busquedaSoporte && !usuarioSeleccionado && (
                <p className="text-center text-slate-400 text-sm py-4">🔍 Busca un usuario para enviarle un mensaje</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
