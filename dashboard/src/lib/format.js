export const fmt = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? '–' : Number(v).toFixed(d));
export const timeOf = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const dateTimeOf = (ts) => (ts ? new Date(ts).toLocaleString() : '–');
export const ago = (ts, now = Date.now()) => {
  if (!ts) return 'never';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s ago`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
};
export const duration = (sec) => {
  if (sec == null) return '–';
  sec = Math.round(sec);
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return [d && `${d}d`, (d || h) && `${h}h`, (d || h || m) && `${m}m`, `${s}s`].filter(Boolean).join(' ');
};
export const durationMs = (ms) => duration(ms / 1000);
// energy in mWh, switching to Wh when large
export const energy = (mwh) => (mwh == null ? '–' : mwh >= 1000 ? `${(mwh / 1000).toFixed(3)} Wh` : `${mwh.toFixed(mwh < 10 ? 3 : 1)} mWh`);

export const RANGES = [
  { key: '5m', label: '5 min', ms: 5 * 60e3 },
  { key: '15m', label: '15 min', ms: 15 * 60e3 },
  { key: '1h', label: '1 hour', ms: 3600e3 },
  { key: '6h', label: '6 hours', ms: 6 * 3600e3 },
  { key: '24h', label: '24 hours', ms: 24 * 3600e3 },
];
