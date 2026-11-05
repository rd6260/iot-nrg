// SQL-backed statistics. All functions accept an optional [from, to] ms range.
const rangeSql = '(ts >= @from AND ts <= @to)';
const rng = (from, to) => ({ from: from ?? 0, to: to ?? Date.now() + 1000 });

export function energyStats(db, from, to) {
  const p = rng(from, to);
  const byMode = db.prepare(`
    SELECT mode, COUNT(*) AS samples, COALESCE(SUM(dt_ms),0) AS duration_ms,
           COALESCE(SUM(energy_mwh),0) AS energy_mwh, AVG(power_mw) AS avg_power_mw
    FROM readings WHERE ${rangeSql} GROUP BY mode`).all(p);
  const total = db.prepare(`
    SELECT COUNT(*) AS samples, COALESCE(SUM(dt_ms),0) AS duration_ms,
           COALESCE(SUM(energy_mwh),0) AS energy_mwh, AVG(power_mw) AS avg_power_mw,
           MIN(ts) AS first_ts, MAX(ts) AS last_ts,
           MAX(power_estimated) AS any_estimated
    FROM readings WHERE ${rangeSql}`).get(p);
  const modes = {};
  for (const m of ['NORMAL', 'ALERT']) {
    modes[m] = byMode.find((r) => r.mode === m) ?? { mode: m, samples: 0, duration_ms: 0, energy_mwh: 0, avg_power_mw: 0 };
  }
  const transitions = db.prepare(`SELECT COUNT(*) AS n FROM mode_changes WHERE ${rangeSql}`).get(p).n;
  return { total, modes, transitions };
}

export function efficiency(db, settings, from, to) {
  const s = energyStats(db, from, to);
  const T = s.total.duration_ms;
  const p = rng(from, to);
  // Fixed-rate baseline: sensor sampled at the fixed (high-fidelity) rate for the whole period.
  const measuredAlert = db.prepare(
    `SELECT AVG(power_mw) AS v FROM readings WHERE mode='ALERT' AND power_estimated=0 AND ${rangeSql}`).get(p).v;
  const fixedPowerMw = measuredAlert ?? settings.powerAlertMw;
  const fixedEnergyMwh = (fixedPowerMw * T) / 3.6e6;
  const adaptiveEnergyMwh = s.total.energy_mwh;
  const fixedMessages = Math.round(T / settings.fixedIntervalMs);
  const adaptiveMessages = s.total.samples;
  const hours = T / 3.6e6;
  return {
    observed_ms: T,
    fixed: {
      interval_ms: settings.fixedIntervalMs,
      power_mw: fixedPowerMw,
      energy_mwh: fixedEnergyMwh,
      messages: fixedMessages,
      freq_hz: 1000 / settings.fixedIntervalMs,
    },
    adaptive: {
      avg_interval_ms: adaptiveMessages > 1 ? T / adaptiveMessages : null,
      power_mw: s.total.avg_power_mw ?? 0,
      energy_mwh: adaptiveEnergyMwh,
      messages: adaptiveMessages,
      freq_hz: T > 0 ? adaptiveMessages / (T / 1000) : 0,
    },
    savings_pct: fixedEnergyMwh > 0 ? ((fixedEnergyMwh - adaptiveEnergyMwh) / fixedEnergyMwh) * 100 : 0,
    message_reduction_pct: fixedMessages > 0 ? ((fixedMessages - adaptiveMessages) / fixedMessages) * 100 : 0,
    hours,
    estimated: !!s.total.any_estimated,
  };
}

export function readingsRange(db, from, to, maxPoints = 1500) {
  const p = rng(from, to);
  const n = db.prepare(`SELECT COUNT(*) AS n FROM readings WHERE ${rangeSql}`).get(p).n;
  const stride = Math.max(1, Math.ceil(n / maxPoints));
  return db.prepare(`SELECT * FROM readings WHERE ${rangeSql} AND id % ${stride} = 0 ORDER BY ts`).all(p);
}

export function csvOf(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

// Bucketed sums so cumulative energy / message counts stay exact regardless of range.
export function energySeries(db, from, to, buckets = 120) {
  const f = from ?? db.prepare('SELECT MIN(ts) t FROM readings').get().t ?? Date.now();
  const t = to ?? Date.now();
  const size = Math.max(1000, Math.ceil((t - f) / buckets));
  const rows = db.prepare(`
    SELECT CAST((ts - @f) / @size AS INTEGER) AS b,
           SUM(energy_mwh) AS energy_mwh, SUM(dt_ms) AS dt_ms, COUNT(*) AS samples,
           AVG(power_mw) AS power_mw, AVG(voltage) AS voltage, AVG(current_ma) AS current_ma,
           SUM(CASE WHEN mode='NORMAL' THEN energy_mwh ELSE 0 END) AS normal_mwh,
           SUM(CASE WHEN mode='ALERT' THEN energy_mwh ELSE 0 END) AS alert_mwh
    FROM readings WHERE ts >= @f AND ts <= @t GROUP BY b ORDER BY b`).all({ f, t, size });
  return rows.map((r) => ({ ts: f + r.b * size + size / 2, ...r }));
}
