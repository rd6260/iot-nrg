import { useStore } from '../lib/store.jsx';
import { ago, dateTimeOf, duration } from '../lib/format.js';
import { Card, Grid, PageHeader, Pill, Stat } from '../components/ui.jsx';

const tri = (v) => (v === null || v === undefined ? ['OFFLINE', 'Unknown'] : v ? ['NORMAL', 'OK'] : ['ALERT', 'Failed']);

export default function Device() {
  const { status: s, events, now, wsUp, latest } = useStore();
  const rows = [
    ['ESP32', s?.espOnline ? ['NORMAL', 'Online'] : ['OFFLINE', 'Offline']],
    ['Wi-Fi', s?.wifiConnected == null ? ['OFFLINE', 'Unknown'] : s.wifiConnected ? ['NORMAL', 'Connected'] : ['ALERT', 'Disconnected']],
    ['MQTT broker', s?.brokerConnected ? ['NORMAL', 'Connected'] : ['ALERT', 'Disconnected']],
    ['MQTT messages', s?.espOnline ? ['NORMAL', 'Receiving'] : ['OFFLINE', 'Not receiving']],
    ['Dashboard server link', wsUp ? ['NORMAL', 'Connected'] : ['ALERT', 'Disconnected']],
    ['DHT11 (temp / humidity)', tri(s?.sensors?.dht)],
    ['MPU6500 (accelerometer)', tri(s?.sensors?.mpu)],
  ];
  const errs = events.filter((e) => /disconnect|offline|bad_payload|broker/.test(e.kind));
  return (
    <>
      <PageHeader title="Device Health" subtitle="ESP32, network and MQTT status" />
      <Grid cols={4}>
        <Stat label="IP address" value={s?.ip ?? '–'} sub={s?.rssi != null ? `Wi-Fi ${s.rssi} dBm` : 'send eiss2/status for IP & RSSI'} />
        <Stat label="Uptime" value={duration(s?.uptime_s)} sub={s?.uptime_s == null ? 'needs eiss2/status uptime_s' : 'ESP32 since boot'} />
        <Stat label="MQTT messages" value={s?.messagesTotal ?? '–'} sub={`${s?.badMessages ?? 0} malformed`} />
        <Stat label="Last transmission" value={latest ? ago(latest.ts, now) : 'never'} sub={dateTimeOf(latest?.ts)} />
      </Grid>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card title="Connectivity & sensors"><ul className="divide-y divide-[var(--line)] text-sm">{rows.map(([n, [k, l]]) => (
          <li key={n} className="flex items-center justify-between py-2"><span>{n}</span><Pill kind={k}>{l}</Pill></li>))}</ul></Card>
        <Card title="Communication error log">
          {errs.length === 0 ? <div className="muted py-8 text-center text-sm">No communication errors recorded.</div> : (
            <ul className="max-h-80 divide-y divide-[var(--line)] overflow-auto text-sm">{errs.map((e) => (
              <li key={e.id} className="py-2"><div className="muted text-xs tabular-nums">{dateTimeOf(e.ts)}</div>{e.message}</li>))}</ul>)}
        </Card>
      </div>
    </>
  );
}
