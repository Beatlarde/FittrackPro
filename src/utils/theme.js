export const applyTheme = (isDark) => {
  const root = document.documentElement;
  if (isDark) {
    root.style.setProperty('--bg-primary', '#0B0F1A');
    root.style.setProperty('--bg-surface', '#131929');
    root.style.setProperty('--bg-surface2', '#1A2237');
    root.style.setProperty('--text-primary', '#F0F4F8');
    root.style.setProperty('--text-muted', '#6B7E91');
    root.style.setProperty('--border-color', 'rgba(255,255,255,0.07)');
    root.style.setProperty('--accent', '#FF5C00');
    root.classList.add('dark-mode');
    root.classList.remove('light-mode');
  } else {
    root.style.setProperty('--bg-primary', '#FAFAF8');
    root.style.setProperty('--bg-surface', '#FFFFFF');
    root.style.setProperty('--bg-surface2', '#F3F2EE');
    root.style.setProperty('--text-primary', '#0F1117');
    root.style.setProperty('--text-muted', '#6B7280');
    root.style.setProperty('--border-color', 'rgba(15,17,23,0.08)');
    root.style.setProperty('--accent', '#10b981');
    root.classList.remove('dark-mode');
    root.classList.add('light-mode');
  }
};

// Inyectar CSS global de dark mode
const darkModeStyle = document.createElement('style');
darkModeStyle.textContent = `
  .dark-mode { color-scheme: dark; }
  .dark-mode body { background: #0B0F1A !important; }

  /* Fondos */
  .dark-mode .bg-white { background: #131929 !important; }
  .dark-mode .bg-slate-50 { background: #0D1220 !important; }
  .dark-mode .bg-slate-100 { background: #1A2237 !important; }
  .dark-mode .bg-slate-200 { background: #1E2A3A !important; }
  .dark-mode .bg-slate-800 { background: #131929 !important; }
  .dark-mode .bg-slate-900 { background: #080C15 !important; }
  .dark-mode .bg-slate-950 { background: #050810 !important; }

  /* Textos */
  .dark-mode .text-slate-800,
  .dark-mode .text-slate-900,
  .dark-mode .text-slate-700 { color: #F0F4F8 !important; }
  .dark-mode .text-slate-600,
  .dark-mode .text-slate-500,
  .dark-mode .text-slate-400 { color: #6B7E91 !important; }
  .dark-mode .text-slate-300 { color: #8A9BAD !important; }

  /* Bordes */
  .dark-mode .border-slate-100,
  .dark-mode .border-slate-200 { border-color: rgba(255,255,255,0.07) !important; }
  .dark-mode .border-slate-300 { border-color: rgba(255,255,255,0.1) !important; }
  .dark-mode .divide-slate-100 > * + * { border-color: rgba(255,255,255,0.05) !important; }

  /* Sombras */
  .dark-mode .shadow-sm,
  .dark-mode .shadow-md,
  .dark-mode .shadow-lg { box-shadow: 0 1px 6px rgba(0,0,0,0.5) !important; }

  /* Inputs */
  .dark-mode input,
  .dark-mode textarea,
  .dark-mode select { background: #131929 !important; color: #F0F4F8 !important; border-color: rgba(255,255,255,0.1) !important; }

  /* Cards y panels */
  .dark-mode .rounded-3xl.border,
  .dark-mode .rounded-2xl.border { border-color: rgba(255,255,255,0.07) !important; }

  /* Header sticky */
  .dark-mode .sticky { background: #0D1220 !important; border-color: rgba(255,255,255,0.05) !important; }

  /* Tab bar */
  .dark-mode .fixed.bottom-0 { background: #0D1220 !important; border-color: rgba(255,255,255,0.07) !important; }
  .dark-mode .fixed.bottom-0 .text-slate-400 { color: #4B5563 !important; }

  /* Modales y overlays */
  .dark-mode .bg-white.rounded-\\[32px\\],
  .dark-mode .bg-white.rounded-3xl { background: #131929 !important; }

  /* Hover states */
  .dark-mode .hover\\:bg-slate-100:hover { background: #1A2237 !important; }
  .dark-mode .hover\\:bg-slate-50:hover { background: #0D1220 !important; }
`;
document.head.appendChild(darkModeStyle);
