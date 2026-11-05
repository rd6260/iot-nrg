import express from 'express';
import cors from 'cors';
import mqtt from 'mqtt';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { startBroker } from './broker.js';
import { WebSocketServer } from 'ws';
import { openDb, loadSettings, saveSettings } from './db.js';
import { energyStats, efficiency, readingsRange, energySeries, csvOf } from './analytics.js';

const PORT = Number(process.env.PORT ?? 4000);
const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
const TOPIC_DATA = process.env.MQTT_TOPIC ?? 'eiss2/sensors';
const TOPIC_STATUS = process.env.MQTT_STATUS_TOPIC ?? 'eiss2/status';
const TOPIC_CONFIG = process.env.MQTT_CONFIG_TOPIC ?? 'eiss2/config';
const DB_PATH = process.env.DB_PATH ?? new URL('../data/eiss2.db', import.meta.url).pathname;

if (process.argv.includes('--broker') || process.env.EMBEDDED_BROKER) startBroker(Number(new URL(MQTT_URL).port) || 1883);

const db = openDb(DB_PATH);
let settings = loadSettings(db);

// ---------- live state ----------
const state = {
  brokerConnected: false,
  espOnline: false,
  lastTs: null,
  lastReading: null,
  messagesTotal: 0,
  badMessages: 0,
  device: { ip: null, wifi: null, rssi: null, uptime_s: null, uptimeAt: null },
  sensors: { dht: null, mpu: null }, // null = unknown, true = ok, false = failed
  mpuZeroRun: 0,
  startedAt: Date.now(),
};
const activeAlerts = new Set();

const q = {
  insReading: db.prepare(`INSERT INTO readings
    (ts,temperature,humidity,accel_x,accel_y,accel_z,mode,sampling_interval,voltage,current_ma,power_mw,power_estimated,battery_v,dt_ms,energy_mwh)
    VALUES (@ts,@temperature,@humidity,@accel_x,@accel_y,@accel_z,@mode,@sampling_interval,@voltage,@current_ma,@power_mw,@power_estimated,@battery_v,@dt_ms,@energy_mwh)`),
  insMode: db.prepare('INSERT INTO mode_changes(ts,from_mode,to_mode,sampling_interval) VALUES (?,?,?,?)'),
  insAlert: db.prepare('INSERT INTO alerts(ts,type,severity,message,value) VALUES (?,?,?,?,?)'),
  insEvent: db.prepare('INSERT INTO events(ts,kind,message) VALUES (?,?,?)'),
  lastReading: db.prepare('SELECT * FROM readings ORDER BY id DESC LIMIT 1'),
};

// restore last reading so the dashboard isn't empty after a restart
state.lastReading = q.lastReading.get() ?? null;
state.lastTs = state.lastReading?.ts ?? null;

// ---------- websocket fan-out ----------
const app = express();
app.use(cors());
app.use(express.json());
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const broadcast = (type, data) => {
  const msg = JSON.stringify({ type, data });
  for (const c of wss.clients) if (c.readyState === 1) c.send(msg);
};

function statusPayload() {
  const d = state.device;
  const uptime = d.uptime_s != null ? d.uptime_s + (Date.now() - d.uptimeAt) / 1000 : null;
  return {
    brokerConnected: state.brokerConnected,
    espOnline: state.espOnline,
    wifiConnected: d.wifi ?? (state.espOnline ? true : null),
    ip: d.ip,
    rssi: d.rssi,
    uptime_s: uptime,
    lastTs: state.lastTs,
    messagesTotal: state.messagesTotal,
    badMessages: state.badMessages,
    sensors: state.sensors,
    serverStartedAt: state.startedAt,
    mqttUrl: MQTT_URL,
    topic: TOPIC_DATA,
  };
}
const pushStatus = () => broadcast('status', statusPayload());

// ---------- events & alerts ----------
function logEvent(kind, message) {
  const ts = Date.now();
  q.insEvent.run(ts, kind, message);
  broadcast('event', { ts, kind, message });
}
function raise(type, severity, message, value = null) {
  const ts = Date.now();
  const r = q.insAlert.run(ts, type, severity, message, value);
  broadcast('alert', { id: Number(r.lastInsertRowid), ts, type, severity, message, value });
}
// edge-triggered: raise once when condition starts, re-arm when it clears
function condition(key, active, type, severity, message, value) {
  if (active && !activeAlerts.has(key)) {
    activeAlerts.add(key);
    raise(type, severity, message, value);
  } else if (!active) activeAlerts.delete(key);
}

// ---------- ingest ----------
const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

function ingest(raw) {
  let j;
  try { j = JSON.parse(raw); } catch { j = null; }
  if (!j || typeof j !== 'object') {
    state.badMessages++;
    logEvent('bad_payload', `Malformed payload: ${String(raw).slice(0, 120)}`);
    pushStatus();
    return;
  }
  const ts = Date.now();
  const mode = String(j.mode ?? 'NORMAL').toUpperCase() === 'ALERT' ? 'ALERT' : 'NORMAL';
  const interval = num(j.sampling_interval) ?? (mode === 'ALERT' ? settings.alertIntervalMs : settings.normalIntervalMs);
  const prev = state.lastReading;

  // Power: use measured values when the firmware sends them (e.g. INA219), else estimate from mode.
  let voltage = num(j.voltage), current = num(j.current_ma), power = num(j.power_mw);
  if (power === null && voltage !== null && current !== null) power = voltage * current;
  const estimated = power === null;
  if (estimated) power = mode === 'ALERT' ? settings.powerAlertMw : settings.powerNormalMw;

  // integrate energy over the time since the previous sample (bounded so outages don't count)
  let dt = 0;
  if (prev) dt = Math.min(ts - prev.ts, Math.max(3 * (prev.sampling_interval ?? 5000), 15000));
  const energy = (power * dt) / 3.6e6; // mW * ms -> mWh

  const row = {
    ts,
    temperature: num(j.temperature), humidity: num(j.humidity),
    accel_x: num(j.accel_x), accel_y: num(j.accel_y), accel_z: num(j.accel_z),
    mode, sampling_interval: interval,
    voltage, current_ma: current, power_mw: power, power_estimated: estimated ? 1 : 0,
    battery_v: num(j.battery_v),
    dt_ms: dt, energy_mwh: energy,
  };
  const info = q.insReading.run(row);
  row.id = Number(info.lastInsertRowid);

  if (prev && prev.mode !== mode) {
    q.insMode.run(ts, prev.mode, mode, interval);
    broadcast('mode_change', { ts, from: prev.mode, to: mode, sampling_interval: interval });
    if (mode === 'ALERT') raise('motion', 'warning', 'Motion detected – switched to ALERT mode', null);
  } else if (!prev) {
    q.insMode.run(ts, null, mode, interval);
  }

  state.lastReading = row;
  state.lastTs = ts;
  state.messagesTotal++;
  const wasOffline = !state.espOnline;
  state.espOnline = true;
  if (wasOffline) {
    logEvent('esp_online', 'ESP32 is sending data');
    activeAlerts.delete('esp_offline');
  }

  // sensor health: MPU returning exact zeros on all axes repeatedly == not responding
  const zero = row.accel_x === 0 && row.accel_y === 0 && row.accel_z === 0;
  state.mpuZeroRun = zero ? state.mpuZeroRun + 1 : 0;
  state.sensors.dht = row.temperature !== null && row.humidity !== null;
  state.sensors.mpu = state.mpuZeroRun < 3;
  condition('dht_fail', state.sensors.dht === false, 'sensor_failure', 'critical', 'DHT11 temperature/humidity sensor returned invalid data');
  condition('mpu_fail', state.sensors.mpu === false, 'sensor_failure', 'critical', 'MPU6500 accelerometer is not responding (all axes 0 g)');

  condition('temp_high', row.temperature !== null && row.temperature > settings.tempHigh,
    'high_temperature', 'warning', `Temperature ${row.temperature?.toFixed(1)} °C above ${settings.tempHigh} °C`, row.temperature);
  condition('hum_high', row.humidity !== null && row.humidity > settings.humHigh,
    'high_humidity', 'warning', `Humidity ${row.humidity?.toFixed(1)} % above ${settings.humHigh} %`, row.humidity);
  condition('batt_low', row.battery_v !== null && row.battery_v < settings.lowBatteryV,
    'low_battery', 'critical', `Battery ${row.battery_v?.toFixed(2)} V below ${settings.lowBatteryV} V`, row.battery_v);

  broadcast('reading', row);
  if (wasOffline) pushStatus();
}

// ---------- MQTT ----------
const client = mqtt.connect(MQTT_URL, { clientId: `eiss2_dashboard_${Math.random().toString(16).slice(2, 8)}`, reconnectPeriod: 3000 });
client.on('connect', () => {
  state.brokerConnected = true;
  client.subscribe([TOPIC_DATA, TOPIC_STATUS], { qos: 0 });
  client.publish(TOPIC_CONFIG, JSON.stringify(configMessage()), { retain: true });
  logEvent('broker_connected', `Connected to MQTT broker ${MQTT_URL}`);
  activeAlerts.delete('broker_down');
  pushStatus();
});
const brokerDown = (why) => {
  const was = state.brokerConnected;
  state.brokerConnected = false;
  if (was) logEvent('broker_disconnected', `MQTT broker connection lost${why ? `: ${why}` : ''}`);
  condition('broker_down', true, 'mqtt_failure', 'critical', `MQTT broker unreachable (${MQTT_URL})${why ? `: ${why}` : ''}`);
  pushStatus();
};
client.on('close', () => brokerDown());
client.on('error', (e) => {
  if (!activeAlerts.has('broker_down')) brokerDown(e.message || e.code);
});
client.on('message', (topic, buf) => {
  const text = buf.toString();
  if (topic === TOPIC_DATA) return ingest(text);
  if (topic === TOPIC_STATUS) {
    try {
      const s = JSON.parse(text);
      const d = state.device;
      if (s.ip) d.ip = s.ip;
      if (s.rssi != null) d.rssi = Number(s.rssi);
      if (s.wifi != null) d.wifi = !!s.wifi;
      if (s.uptime_s != null) { d.uptime_s = Number(s.uptime_s); d.uptimeAt = Date.now(); }
      if (s.online === false) { state.espOnline = false; logEvent('esp_offline', 'ESP32 reported offline (last will)'); }
      pushStatus();
    } catch { state.badMessages++; }
  }
});

function configMessage() {
  return {
    normal_interval: settings.normalIntervalMs,
    alert_interval: settings.alertIntervalMs,
    motion_threshold: settings.motionThreshold,
  };
}

// ---------- watchdog: ESP32 disconnection ----------
setInterval(() => {
  if (!state.espOnline) return;
  const iv = state.lastReading?.sampling_interval ?? settings.normalIntervalMs;
  const limit = Math.max(3 * iv, 15000);
  if (Date.now() - state.lastTs > limit) {
    state.espOnline = false;
    logEvent('esp_offline', `No data for ${Math.round((Date.now() - state.lastTs) / 1000)} s`);
    condition('esp_offline', true, 'esp_disconnected', 'critical', 'ESP32 stopped sending data');
    pushStatus();
  }
}, 1000);
setInterval(pushStatus, 5000); // keeps uptime and counters fresh

// ---------- REST ----------
const parseRange = (req) => {
  const f = Number(req.query.from), t = Number(req.query.to);
  return [Number.isFinite(f) && req.query.from ? f : undefined, Number.isFinite(t) && req.query.to ? t : undefined];
};
const limitOf = (req, d = 200) => Math.min(5000, Number(req.query.limit) || d);

app.get('/api/snapshot', (_req, res) => res.json({
  status: statusPayload(), settings, latest: state.lastReading,
  stats: energyStats(db, undefined, undefined),
}));
app.get('/api/status', (_req, res) => res.json(statusPayload()));
app.get('/api/settings', (_req, res) => res.json(settings));
app.put('/api/settings', (req, res) => {
  settings = saveSettings(db, req.body ?? {});
  if (client.connected) client.publish(TOPIC_CONFIG, JSON.stringify(configMessage()), { retain: true });
  broadcast('settings', settings);
  res.json(settings);
});
app.get('/api/readings', (req, res) => {
  const [f, t] = parseRange(req);
  res.json(readingsRange(db, f, t, Number(req.query.max) || 1500));
});
app.get('/api/stats', (req, res) => {
  const [f, t] = parseRange(req);
  res.json({ ...energyStats(db, f, t), efficiency: efficiency(db, settings, f, t) });
});
app.get('/api/energy-series', (req, res) => { const [f, t] = parseRange(req); res.json(energySeries(db, f, t)); });
app.get('/api/efficiency', (req, res) => { const [f, t] = parseRange(req); res.json(efficiency(db, settings, f, t)); });
const listTable = (table) => (req, res) => {
  const [f, t] = parseRange(req);
  res.json(db.prepare(`SELECT * FROM ${table} WHERE ts >= ? AND ts <= ? ORDER BY ts DESC LIMIT ?`)
    .all(f ?? 0, t ?? Date.now() + 1000, limitOf(req)));
};
app.get('/api/modes', listTable('mode_changes'));
app.get('/api/alerts', listTable('alerts'));
app.get('/api/events', listTable('events'));

const EXPORTABLE = new Set(['readings', 'mode_changes', 'alerts', 'events']);
app.get('/api/export/:table.csv', (req, res) => {
  if (!EXPORTABLE.has(req.params.table)) return res.status(404).end();
  const [f, t] = parseRange(req);
  const rows = db.prepare(`SELECT * FROM ${req.params.table} WHERE ts >= ? AND ts <= ? ORDER BY ts`).all(f ?? 0, t ?? Date.now() + 1000)
    .map((r) => ({ time_iso: new Date(r.ts).toISOString(), ...r }));
  res.type('text/csv').attachment(`${req.params.table}.csv`).send(csvOf(rows));
});

app.get('/api/report.html', (req, res) => {
  const [f, t] = parseRange(req);
  const s = energyStats(db, f, t), e = efficiency(db, settings, f, t);
  const agg = db.prepare(`SELECT AVG(temperature) at, MIN(temperature) mint, MAX(temperature) maxt,
     AVG(humidity) ah, MIN(humidity) minh, MAX(humidity) maxh FROM readings WHERE ts>=? AND ts<=?`).get(f ?? 0, t ?? Date.now() + 1000);
  const alertCount = db.prepare('SELECT COUNT(*) n FROM alerts WHERE ts>=? AND ts<=?').get(f ?? 0, t ?? Date.now() + 1000).n;
  const fx = (v, d = 2) => (v == null ? '–' : Number(v).toFixed(d));
  const dur = (ms) => `${(ms / 60000).toFixed(1)} min`;
  const row = (a, b) => `<tr><th>${a}</th><td>${b}</td></tr>`;
  res.type('html').attachment('experiment-report.html').send(`<!doctype html><meta charset="utf-8"><title>EISS2 experiment report</title>
<style>body{font:15px system-ui;max-width:760px;margin:2rem auto;color:#111}table{border-collapse:collapse;width:100%;margin-bottom:1.5rem}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}th{width:55%;font-weight:500;color:#444}h2{margin-top:2rem}</style>
<h1>Energy-Aware Adaptive IoT Sensing – Experiment Report</h1>
<p>Generated ${new Date().toISOString()}<br>Period: ${f ? new Date(f).toISOString() : 'start of data'} → ${t ? new Date(t).toISOString() : 'now'}</p>
<h2>Summary</h2><table>
${row('Observed time', dur(s.total.duration_ms))}${row('Samples transmitted', s.total.samples)}${row('Mode transitions', s.transitions)}${row('Alerts raised', alertCount)}
${row('Temperature avg / min / max', `${fx(agg.at, 1)} / ${fx(agg.mint, 1)} / ${fx(agg.maxt, 1)} °C`)}
${row('Humidity avg / min / max', `${fx(agg.ah, 1)} / ${fx(agg.minh, 1)} / ${fx(agg.maxh, 1)} %`)}</table>
<h2>Adaptive operation</h2><table>
${row('NORMAL: time / samples / energy', `${dur(s.modes.NORMAL.duration_ms)} / ${s.modes.NORMAL.samples} / ${fx(s.modes.NORMAL.energy_mwh, 3)} mWh`)}
${row('ALERT: time / samples / energy', `${dur(s.modes.ALERT.duration_ms)} / ${s.modes.ALERT.samples} / ${fx(s.modes.ALERT.energy_mwh, 3)} mWh`)}</table>
<h2>Energy efficiency ${e.estimated ? '(power values are <em>estimated</em> from mode, no power sensor data)' : '(measured)'}</h2><table>
${row(`Fixed-rate (${e.fixed.interval_ms} ms) energy`, `${fx(e.fixed.energy_mwh, 3)} mWh`)}
${row('Adaptive energy', `${fx(e.adaptive.energy_mwh, 3)} mWh`)}
${row('Energy saving', `${fx(e.savings_pct, 1)} %`)}
${row('Messages fixed vs adaptive', `${e.fixed.messages} vs ${e.adaptive.messages} (−${fx(e.message_reduction_pct, 1)} %)`)}</table>`);
});

// Serve the built dashboard (npm run build) from the same port
const DIST = new URL('../../dashboard/dist/', import.meta.url).pathname;
if (existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^\/(?!api|ws).*/, (_req, res) => res.sendFile(DIST + 'index.html'));
}

server.listen(PORT, () => console.log(`EISS2 server on :${PORT}  broker=${MQTT_URL}  topic=${TOPIC_DATA}  db=${DB_PATH}`));
wss.on('connection', (ws) => ws.send(JSON.stringify({ type: 'status', data: statusPayload() })));
