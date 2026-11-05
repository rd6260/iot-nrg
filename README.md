# EISS2 – Energy-Aware Adaptive IoT Sensing dashboard

```
ESP32 ──MQTT──> Mosquitto ──> server (Express + SQLite) ──WebSocket──> React dashboard
```

- `microcontroller/arduino.ino` – firmware (publishes JSON to `eiss2/sensors`)
- `server/` – subscribes to MQTT, stores to SQLite (`node:sqlite`, Node ≥ 22.13), evaluates alerts, serves REST + WebSocket + CSV/report export
- `dashboard/` – React + Tailwind v4 + Recharts, 9 pages

## Run

```bash
npm run setup     # once: installs root, server and dashboard deps
npm run build     # once (and after UI changes): builds the dashboard

npm start         # ONE process: embedded MQTT broker :1883 + API + dashboard on http://localhost:4000
npm run sim       # optional, second terminal: fake ESP32 if you have no hardware
```

Development with hot reload: `npm run dev` (dashboard on http://localhost:5173).

Using Mosquitto instead of the embedded broker: run `node server/src/index.js` (no `--broker`)
and set `MQTT_URL=mqtt://host:1883` if it isn't on localhost. Other env: `PORT`, `DB_PATH`.

## MQTT contract

| Topic | Direction | Payload |
|---|---|---|
| `eiss2/sensors` | ESP32 → | existing firmware JSON; optional `voltage`, `current_ma`, `power_mw`, `battery_v` |
| `eiss2/status` (optional) | ESP32 → | `{"ip","rssi","wifi":true,"uptime_s"}` – fills IP/RSSI/uptime on Device Health |
| `eiss2/config` | → ESP32 (retained) | `{normal_interval, alert_interval, motion_threshold}` from Settings |

## Known gaps with the current firmware

- **No power sensor** → power/energy are *estimated* from mode (editable in Settings) and labelled as such. Publish INA219 values to get measured numbers.
- Firmware doesn't publish `eiss2/status` or subscribe to `eiss2/config`, so IP/uptime show "–" and Settings interval changes don't reach the device yet.
- Online/offline is inferred from data freshness (no data for max(3× interval, 15 s)).
