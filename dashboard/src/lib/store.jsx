import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const MAX_LIVE = 6000;

export async function api(path, opts) {
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

export function StoreProvider({ children }) {
  const [wsUp, setWsUp] = useState(false);
  const [status, setStatus] = useState(null);
  const [settings, setSettings] = useState(null);
  const [live, setLive] = useState([]);           // recent readings (ascending)
  const [alerts, setAlerts] = useState([]);       // newest first
  const [events, setEvents] = useState([]);
  const [modes, setModes] = useState([]);         // mode changes, newest first
  const [toasts, setToasts] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const toastId = useRef(0);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // initial load
  useEffect(() => {
    const from = Date.now() - 3600e3;
    api('/api/snapshot').then((s) => { setStatus(s.status); setSettings(s.settings); }).catch(() => {});
    api(`/api/readings?from=${from}&max=${MAX_LIVE}`).then(setLive).catch(() => {});
    api('/api/alerts?limit=200').then(setAlerts).catch(() => {});
    api('/api/events?limit=200').then(setEvents).catch(() => {});
    api('/api/modes?limit=200').then(setModes).catch(() => {});
  }, []);

  // live socket with auto-reconnect
  useEffect(() => {
    let ws, timer, closed = false;
    const connect = () => {
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      ws.onopen = () => {
        setWsUp(true);
        api('/api/snapshot').then((s) => { setStatus(s.status); setSettings(s.settings); }).catch(() => {});
      };
      ws.onclose = () => { setWsUp(false); if (!closed) timer = setTimeout(connect, 2000); };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        const { type, data } = JSON.parse(e.data);
        if (type === 'reading') setLive((l) => (l.length >= MAX_LIVE ? [...l.slice(-MAX_LIVE + 1), data] : [...l, data]));
        else if (type === 'status') setStatus(data);
        else if (type === 'settings') setSettings(data);
        else if (type === 'event') setEvents((l) => [{ id: `e${data.ts}`, ...data }, ...l].slice(0, 500));
        else if (type === 'mode_change') setModes((l) => [{ id: `m${data.ts}`, ts: data.ts, from_mode: data.from, to_mode: data.to, sampling_interval: data.sampling_interval }, ...l].slice(0, 500));
        else if (type === 'alert') {
          setAlerts((l) => [data, ...l].slice(0, 500));
          const id = ++toastId.current;
          setToasts((t) => [...t, { ...data, tid: id }]);
          setTimeout(() => setToasts((t) => t.filter((x) => x.tid !== id)), 7000);
        }
      };
    };
    connect();
    return () => { closed = true; clearTimeout(timer); ws?.close(); };
  }, []);

  const dismissToast = useCallback((tid) => setToasts((t) => t.filter((x) => x.tid !== tid)), []);
  const saveSettings = useCallback(async (patch) => {
    const s = await api('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    setSettings(s);
    return s;
  }, []);

  const latest = live.length ? live[live.length - 1] : null;

  // Overall state: grey OFFLINE if the dashboard can't reach the server, the broker, or the ESP32
  const system = useMemo(() => {
    if (!wsUp) return { online: false, label: 'Offline', reason: 'Cannot reach the dashboard server' };
    if (!status?.brokerConnected) return { online: false, label: 'Offline', reason: 'MQTT broker unreachable' };
    if (!status?.espOnline) return { online: false, label: 'Offline', reason: 'ESP32 is not sending data' };
    return { online: true, label: 'Online', reason: 'All systems operational' };
  }, [wsUp, status]);

  const value = { wsUp, status, settings, live, latest, alerts, events, modes, toasts, now, theme, system,
    setTheme: setThemeState, dismissToast, saveSettings };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Poll a REST endpoint at the user-configured refresh interval.
export function useApi(path, deps = []) {
  const { settings } = useStore();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const refresh = settings?.refreshSec ?? 5;
  useEffect(() => {
    if (!path) return;
    let stop = false;
    const load = () => api(path).then((d) => { if (!stop) { setData(d); setError(null); } }).catch((e) => !stop && setError(e));
    load();
    const t = setInterval(load, refresh * 1000);
    return () => { stop = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, refresh, ...deps]);
  return { data, error };
}

// Readings for a trailing window: live buffer is authoritative for the recent part.
export function useWindowReadings(rangeMs) {
  const { live, now } = useStore();
  const from = Math.floor((now - rangeMs) / 10000) * 10000; // stable for 10 s so we don't refetch every tick
  const { data } = useApi(`/api/readings?from=${from}&max=800`, [rangeMs]);
  return useMemo(() => {
    const base = data ?? [];
    const lastTs = base.length ? base[base.length - 1].ts : 0;
    const merged = [...base, ...live.filter((r) => r.ts > lastTs)];
    const cutoff = Date.now() - rangeMs;
    return merged.filter((r) => r.ts >= cutoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, live, rangeMs, Math.floor(now / 5000)]);
}
