import { useState } from 'react';
import { useApi, useStore } from './store.jsx';
import { RANGES } from './format.js';

export function useRange(initial = '15m') {
  const [key, setKey] = useState(initial);
  const ms = RANGES.find((r) => r.key === key).ms;
  return { key, setKey, ms };
}
// `from` timestamp rounded to 10 s so request URLs are stable between ticks
export function useFrom(ms) {
  const { now } = useStore();
  return Math.floor((now - ms) / 10000) * 10000;
}
export function useStats(ms) {
  const from = useFrom(ms);
  return useApi(`/api/stats?from=${from}`, [ms]);
}
// Mode segments for a timeline. modes: mode_changes rows (any order).
export function buildSegments(modes, from, to) {
  const asc = [...modes].filter((m) => m.ts <= to).sort((a, b) => a.ts - b.ts);
  const segs = [];
  let cur = null, start = from;
  const before = asc.filter((m) => m.ts <= from).pop();
  if (before) cur = before.to_mode;
  else if (asc.find((m) => m.ts > from)) cur = asc.find((m) => m.ts > from).from_mode;
  for (const m of asc.filter((x) => x.ts > from)) {
    if (cur) segs.push({ mode: cur, start, end: m.ts });
    cur = m.to_mode; start = m.ts;
  }
  if (cur) segs.push({ mode: cur, start, end: to });
  return segs;
}
