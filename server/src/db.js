import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const DEFAULT_SETTINGS = {
  tempHigh: 35,            // °C
  humHigh: 80,             // %
  motionThreshold: 0.2,    // g (change between samples)
  normalIntervalMs: 5000,
  alertIntervalMs: 1000,
  refreshSec: 5,           // dashboard REST refresh
  fixedIntervalMs: 1000,   // baseline for "fixed-rate sensing" comparison
  powerNormalMw: 380,      // estimated draw when no power sensor is present
  powerAlertMw: 420,
  lowBatteryV: 3.4,
};

export function openDb(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      temperature REAL, humidity REAL,
      accel_x REAL, accel_y REAL, accel_z REAL,
      mode TEXT, sampling_interval INTEGER,
      voltage REAL, current_ma REAL, power_mw REAL,
      power_estimated INTEGER NOT NULL DEFAULT 1,
      battery_v REAL,
      dt_ms INTEGER NOT NULL DEFAULT 0,
      energy_mwh REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(ts);
    CREATE TABLE IF NOT EXISTS mode_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL, from_mode TEXT, to_mode TEXT NOT NULL, sampling_interval INTEGER
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL, type TEXT NOT NULL, severity TEXT NOT NULL,
      message TEXT NOT NULL, value REAL
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL, kind TEXT NOT NULL, message TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  return db;
}

export function loadSettings(db) {
  const out = { ...DEFAULT_SETTINGS };
  for (const r of db.prepare('SELECT key, value FROM settings').all()) {
    if (r.key in out) out[r.key] = Number(r.value);
  }
  return out;
}

export function saveSettings(db, patch) {
  const up = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  for (const [k, v] of Object.entries(patch)) {
    if (k in DEFAULT_SETTINGS && Number.isFinite(Number(v))) up.run(k, String(Number(v)));
  }
  return loadSettings(db);
}
