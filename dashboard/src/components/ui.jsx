import { CheckCircle2, AlertTriangle, OctagonAlert, WifiOff } from 'lucide-react';
import { MODE } from '../lib/colors.js';
import { RANGES } from '../lib/format.js';

const ICON = { NORMAL: CheckCircle2, ALERT: OctagonAlert, WARNING: AlertTriangle, OFFLINE: WifiOff };

// State is always icon + label, never colour alone.
export function Pill({ kind = 'OFFLINE', children, className = '' }) {
  const m = MODE[kind]; const Icon = ICON[kind];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.soft} ${m.text} ${className}`}>
      <Icon size={13} aria-hidden /> {children ?? m.label}
    </span>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="muted mt-0.5 text-sm">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Card({ title, right, children, className = '' }) {
  return (
    <section className={`card p-4 ${className}`}>
      {(title || right) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, unit, sub, accent, icon: Icon }) {
  return (
    <div className="card p-4">
      <div className="muted flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
        {Icon && <Icon size={14} aria-hidden />} {label}
      </div>
      <div className={`mt-1.5 flex items-baseline gap-1 text-3xl font-semibold tabular-nums ${accent ?? ''}`}>
        {value}{unit && <span className="muted text-base font-normal">{unit}</span>}
      </div>
      {sub && <div className="muted mt-1 text-xs">{sub}</div>}
    </div>
  );
}

export function Grid({ cols = 4, children, className = '' }) {
  const c = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 xl:grid-cols-4', 5: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5' }[cols];
  return <div className={`grid grid-cols-1 gap-3 ${c} ${className}`}>{children}</div>;
}

export function RangeSelect({ value, onChange }) {
  return (
    <div role="group" aria-label="Time range" className="card inline-flex overflow-hidden p-0.5 text-sm">
      {RANGES.map((r) => (
        <button key={r.key} onClick={() => onChange(r.key)}
          className={`rounded-lg px-3 py-1 ${value === r.key ? 'bg-[var(--s1)] text-white' : 'muted hover:bg-black/5 dark:hover:bg-white/10'}`}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

export const Btn = ({ children, className = '', ...p }) => (
  <button {...p} className={`card inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 ${className}`}>{children}</button>
);

export const Empty = ({ children = 'No data in this range yet.' }) => (
  <div className="muted flex h-40 items-center justify-center text-sm">{children}</div>
);

export function Notice({ kind = 'WARNING', children }) {
  const m = MODE[kind]; const Icon = ICON[kind];
  return (
    <div className={`mb-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${m.soft}`}>
      <Icon size={16} className={`mt-0.5 shrink-0 ${m.text}`} aria-hidden /><div>{children}</div>
    </div>
  );
}
