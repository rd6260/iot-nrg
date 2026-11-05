import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Bell, BrainCircuit, Cpu, Gauge, History, LayoutDashboard, Leaf, Menu, Moon, Settings, Sun, X, Zap } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { MODE } from '../lib/colors.js';
import { Pill } from './ui.jsx';

const NAV = [
  ['/', 'Overview', LayoutDashboard],
  ['/sensors', 'Sensor Monitoring', Activity],
  ['/adaptive', 'Adaptive Intelligence', BrainCircuit],
  ['/energy', 'Energy Monitoring', Zap],
  ['/efficiency', 'Energy Efficiency', Leaf],
  ['/history', 'Historical Data', History],
  ['/alerts', 'Alerts & Notifications', Bell],
  ['/device', 'Device Health', Cpu],
  ['/settings', 'Settings', Settings],
];

export default function Layout() {
  const { system, latest, alerts, toasts, dismissToast, theme, setTheme, now } = useStore();
  const [open, setOpen] = useState(false);
  const recentAlerts = alerts.filter((a) => now - a.ts < 3600e3).length;
  const mode = !system.online ? 'OFFLINE' : latest?.mode === 'ALERT' ? 'ALERT' : 'NORMAL';

  const nav = (
    <nav className="flex flex-col gap-0.5 p-3">
      {NAV.map(([to, label, Icon]) => (
        <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
          className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-[var(--s1)] text-white' : 'muted hover:bg-black/5 dark:hover:bg-white/10'}`}>
          <Icon size={17} aria-hidden /> {label}
          {to === '/alerts' && recentAlerts > 0 && <span className="ml-auto rounded-full bg-alert px-1.5 text-[10px] font-bold text-white">{recentAlerts}</span>}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="card sticky top-0 hidden h-screen w-64 shrink-0 rounded-none border-y-0 border-l-0 lg:block">
        <div className="px-5 pb-1 pt-5"><div className="text-base font-bold leading-tight">EISS2</div><div className="muted text-xs">Adaptive IoT Sensing</div></div>
        {nav}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside className="card absolute left-0 top-0 h-full w-64 rounded-none" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5"><b>EISS2</b><button onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
            {nav}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="card sticky top-0 z-30 flex items-center gap-3 rounded-none border-x-0 border-t-0 px-4 py-2.5">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <Pill kind={system.online ? 'NORMAL' : 'OFFLINE'}>{system.label}</Pill>
          <span className="muted hidden text-sm sm:inline">{system.reason}</span>
          <div className="ml-auto flex items-center gap-3">
            {system.online && <span className={`hidden items-center gap-1.5 text-sm font-semibold sm:flex ${MODE[mode].text}`}><span className={`h-2 w-2 rounded-full ${MODE[mode].bg}`} />{mode} mode</span>}
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme" className="card p-1.5">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 lg:p-6"><Outlet /></main>
      </div>

      <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.tid} className="card flex items-start gap-2 border-l-4 p-3 text-sm shadow-xl" style={{ borderLeftColor: t.severity === 'critical' ? MODE.ALERT.hex : MODE.WARNING.hex }}>
            <Bell size={16} className="mt-0.5 shrink-0" />
            <div className="flex-1"><div className="font-semibold capitalize">{t.type.replace(/_/g, ' ')}</div><div className="muted">{t.message}</div></div>
            <button onClick={() => dismissToast(t.tid)} aria-label="Dismiss"><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
