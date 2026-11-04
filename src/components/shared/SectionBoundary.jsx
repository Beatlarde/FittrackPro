import { Component } from 'react';

// Aísla secciones de la app: si un componente falla al dibujarse, en vez de dejar
// toda la app en blanco muestra una tarjeta con el nombre de la sección, el error
// y un botón para reintentar. El resto de la app sigue funcionando.
// Ver docs/BITACORA.md (2026-11-04) — así se encontró el bug de PHOTO_CATEGORIES.
class SectionBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[SectionBoundary] Falló la sección "${this.props.nombre || 'sin nombre'}":`, error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const pantallaCompleta = this.props.pantallaCompleta;
    return (
      <div className={pantallaCompleta ? 'min-h-screen flex items-center justify-center p-6 bg-slate-50' : 'p-2'}>
        <div className="bg-white border border-red-200 rounded-3xl p-5 max-w-md w-full shadow-sm">
          <p className="text-xs font-black text-red-500 uppercase tracking-wide">⚠️ Esta sección tuvo un problema</p>
          {this.props.nombre && <p className="text-sm font-black text-slate-800 mt-1">{this.props.nombre}</p>}
          <p className="text-xs text-slate-500 mt-2">El resto de la app sigue funcionando. Si se repite, toma captura de este mensaje.</p>
          <pre className="mt-3 text-[11px] text-red-700 bg-red-50 rounded-xl p-3 whitespace-pre-wrap break-words max-h-32 overflow-auto">{String(error?.message || error)}</pre>
          <button
            onClick={() => (pantallaCompleta ? window.location.reload() : this.setState({ error: null }))}
            className="mt-4 w-full bg-slate-900 text-white font-black text-sm py-3 rounded-2xl active:scale-95">
            Reintentar
          </button>
        </div>
      </div>
    );
  }
}

export default SectionBoundary;
