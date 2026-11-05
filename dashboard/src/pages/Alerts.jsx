import { useState } from 'react';
import { Download } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { ago, dateTimeOf } from '../lib/format.js';
import { Btn, Card, Grid, PageHeader, Pill, Stat } from '../components/ui.jsx';

const LABEL = {
  motion: 'Motion detected', high_temperature: 'High temperature', high_humidity: 'High humidity', esp_disconnected: 'ESP32 disconnected',
  mqtt_failure: 'MQTT failure', sensor_failure: 'Sensor failure', low_battery: 'Low battery',
};

export default function Alerts() {
  const { alerts, now, settings } = useStore();
  const [type, setType] = useState('all');
  const list = alerts.filter((a) => type === 'all' || a.type === type);
  const day = alerts.filter((a) => now - a.ts < 86400e3);
  return (
    <>
      <PageHeader title="Alerts & Notifications" subtitle="Alerts are raised when a condition starts and re-arm once it clears">
        <a href="/api/export/alerts.csv"><Btn><Download size={14} /> CSV</Btn></a>
      </PageHeader>
      <Grid cols={4}>
        <Stat label="Last 24 h" value={day.length} />
        <Stat label="Critical (24 h)" value={day.filter((a) => a.severity === 'critical').length} accent="text-alert" />
        <Stat label="Temperature limit" value={settings?.tempHigh} unit="°C" sub="change in Settings" />
        <Stat label="Humidity limit" value={settings?.humHigh} unit="%" sub="change in Settings" />
      </Grid>
      <Card className="mt-3" title="Alert history" right={
        <select value={type} onChange={(e) => setType(e.target.value)} className="card bg-transparent px-2 py-1 text-sm" aria-label="Filter by type">
          <option value="all">All types</option>{Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>}>
        {list.length === 0 ? <div className="muted py-10 text-center text-sm">No alerts{type !== 'all' ? ' of this type' : ''}.</div> : (
          <ul className="divide-y divide-[var(--line)]">{list.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
              <Pill kind={a.severity === 'critical' ? 'ALERT' : 'WARNING'}>{LABEL[a.type] ?? a.type}</Pill>
              <span className="min-w-0 flex-1">{a.message}</span>
              <span className="muted text-xs tabular-nums" title={dateTimeOf(a.ts)}>{dateTimeOf(a.ts)} · {ago(a.ts, now)}</span>
            </li>))}</ul>
        )}
      </Card>
    </>
  );
}
