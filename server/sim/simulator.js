// Fake ESP32: mimics the firmware's payload and adaptive behaviour (occasional "shaking").
// Optional: SIM_POWER=1 adds voltage/current/power fields like an INA219 would.
import mqtt from 'mqtt';
const c = mqtt.connect(process.env.MQTT_URL ?? 'mqtt://localhost:1883');
const SPEED = Number(process.env.SIM_SPEED ?? 1); // >1 compresses time
const topic = 'eiss2/sensors';
let alertUntil = 0, shakeAt = Date.now() + 15000 / SPEED, t0 = Date.now();
const r = (a, b) => a + Math.random() * (b - a);

function tick() {
  const now = Date.now();
  if (now > shakeAt) { alertUntil = now + r(6000, 12000) / SPEED; shakeAt = alertUntil + r(20000, 45000) / SPEED; }
  const alert = now < alertUntil;
  const interval = alert ? 1000 : 5000;
  const m = (now - t0) / 60000;
  const p = {
    temperature: +(27 + 3 * Math.sin(m / 2) + r(-0.2, 0.2)).toFixed(2),
    humidity: +(55 + 8 * Math.cos(m / 3) + r(-0.5, 0.5)).toFixed(2),
    accel_x: +(alert ? r(-0.6, 0.6) : r(-0.02, 0.02)).toFixed(3),
    accel_y: +(alert ? r(-0.6, 0.6) : r(-0.02, 0.02)).toFixed(3),
    accel_z: +((alert ? r(0.4, 1.6) : 1) + r(-0.02, 0.02)).toFixed(3),
    mode: alert ? 'ALERT' : 'NORMAL',
    sampling_interval: interval,
  };
  if (process.env.SIM_POWER) {
    p.voltage = +r(4.95, 5.05).toFixed(2);
    p.current_ma = +(alert ? r(95, 110) : r(70, 80)).toFixed(1);
    p.power_mw = +(p.voltage * p.current_ma).toFixed(1);
  }
  c.publish(topic, JSON.stringify(p));
  c.publish('eiss2/status', JSON.stringify({ ip: '10.0.3.57', wifi: true, rssi: Math.round(r(-62, -55)), uptime_s: Math.round((now - t0) / 1000) }));
  setTimeout(tick, interval / SPEED);
}
c.on('connect', () => { console.log('simulator connected'); tick(); });
