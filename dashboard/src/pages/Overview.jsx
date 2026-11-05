import { Link } from 'react-router-dom';
import { Droplets, Move3d, Thermometer, Timer, Cpu, RadioTower, Clock, Gauge, ArrowRight, Wifi, Zap, Radio, MonitorSmartphone, BrainCircuit, Activity } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { MODE } from '../lib/colors.js';
import { ago, fmt, dateTimeOf } from '../lib/format.js';
import { Card, Grid, PageHeader, Pill, Stat, Notice } from '../components/ui.jsx';
import { TimeChart } from '../components/TimeChart.jsx';
import { useWindowReadings } from '../lib/store.jsx';

function PipelineStep({ icon: Icon, title, value, ok = true }) {
  return (
    <div className="card flex min-w-[120px] flex-1 flex-col items-center gap-1 p-3 text-center">
      <Icon size={20} className={ok ? '' : 'text-offline'} aria-hidden />
      <div className="text-xs font-semibold">{title}</div>
      <div className={`muted text-xs ${ok ? '' : 'italic'}`}>{value}</div>
    </div>
  );
}

export default function Overview() {
  const { latest, status, system, now, alerts, settings } = useStore();
  const rows = useWindowReadings(15 * 60e3);
  const fresh = system.online && latest;
  const mode = !fresh ? 'OFFLINE' : latest.mode;
  const motion = fresh && latest.mode === 'ALERT';
  const sensorsOk = status?.sensors?.dht !== false && status?.sensors?.mpu !== false;

  return (
    <>
      <PageHeader title="Overview" subtitle="Sensor data collection → edge intelligence → adaptive sampling → MQTT → live monitoring → energy analysis" />
      {!system.online && <Notice kind="OFFLINE"><b>{system.reason}.</b> Showing the last known values{latest ? ` from ${ago(latest.ts, now)}` : ''}.</Notice>}

      <div className="mb-4 flex flex-wrap gap-2">
        <PipelineStep icon={Thermometer} title="Sensing" value={sensorsOk ? 'DHT11 + MPU6500' : 'sensor fault'} ok={sensorsOk} />
        <PipelineStep icon={BrainCircuit} title="Edge intelligence" value={fresh ? `${mode} mode` : 'idle'} ok={!!fresh} />
        <PipelineStep icon={Timer} title="Adaptive sampling" value={latest ? `every ${latest.sampling_interval / 1000}s` : '–'} ok={!!fresh} />
        <PipelineStep icon={RadioTower} title="MQTT" value={status?.brokerConnected ? 'broker connected' : 'broker down'} ok={!!status?.brokerConnected} />
        <PipelineStep icon={MonitorSmartphone} title="Live monitoring" value={status ? `${status.messagesTotal} msgs` : '–'} ok={system.online} />
        <PipelineStep icon={Zap} title="Energy analysis" value={latest ? `${fmt(latest.power_mw, 0)} mW${latest.power_estimated ? ' (est.)' : ''}` : '–'} ok={!!latest} />
      </div>

      <Grid cols={4}>
        <Stat icon={Thermometer} label="Temperature" value={fmt(latest?.temperature)} unit="°C"
          accent={latest?.temperature > settings?.tempHigh ? 'text-warn' : ''} sub={latest?.temperature > settings?.tempHigh ? `Above ${settings.tempHigh} °C threshold` : 'DHT11'} />
        <Stat icon={Droplets} label="Humidity" value={fmt(latest?.humidity)} unit="%"
          accent={latest?.humidity > settings?.humHigh ? 'text-warn' : ''} sub={latest?.humidity > settings?.humHigh ? `Above ${settings.humHigh} % threshold` : 'DHT11'} />
        <div className="card p-4">
          <div className="muted flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide"><Move3d size={14} /> Motion</div>
          <div className="mt-2"><Pill kind={!fresh ? 'OFFLINE' : motion ? 'ALERT' : 'NORMAL'}>{!fresh ? 'Unknown' : motion ? 'Motion detected' : 'Still'}</Pill></div>
          <div className="muted mt-2 text-xs tabular-nums">x {fmt(latest?.accel_x, 2)} · y {fmt(latest?.accel_y, 2)} · z {fmt(latest?.accel_z, 2)} g</div>
        </div>
        <div className="card p-4">
          <div className="muted flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide"><Gauge size={14} /> Operating mode</div>
          <div className="mt-2"><Pill kind={mode}>{mode}</Pill></div>
          <div className="muted mt-2 text-xs">Sampling every <b className="text-[var(--ink)] tabular-nums">{latest ? latest.sampling_interval / 1000 : '–'} s</b></div>
        </div>
      </Grid>

      <Grid cols={4} className="mt-3">
        <Stat icon={Cpu} label="ESP32" value={status?.espOnline ? 'Online' : 'Offline'} accent={status?.espOnline ? MODE.NORMAL.text : MODE.OFFLINE.text} sub={status?.ip ?? 'IP unknown'} />
        <Stat icon={Radio} label="MQTT broker" value={status?.brokerConnected ? 'Connected' : 'Disconnected'} accent={status?.brokerConnected ? MODE.NORMAL.text : MODE.OFFLINE.text} sub={status?.mqttUrl} />
        <Stat icon={Clock} label="Last data received" value={latest ? ago(latest.ts, now) : 'never'} sub={dateTimeOf(latest?.ts)} />
        <Stat icon={Wifi} label="Messages received" value={status?.messagesTotal ?? '–'} sub={`topic ${status?.topic ?? ''}`} />
      </Grid>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card title="Temperature · last 15 min" className="lg:col-span-1"><TimeChart data={rows} series={[{ key: 'temperature', label: 'Temperature' }]} unit="°C" height={200} /></Card>
        <Card title="Humidity · last 15 min" className="lg:col-span-1"><TimeChart data={rows} series={[{ key: 'humidity', label: 'Humidity' }]} unit="%" height={200} /></Card>
        <Card title="Latest alerts" right={<Link to="/alerts" className="muted inline-flex items-center gap-1 text-xs">All <ArrowRight size={12} /></Link>}>
          {alerts.length === 0 ? <div className="muted py-6 text-center text-sm">No alerts yet.</div> : (
            <ul className="space-y-2 text-sm">{alerts.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-start gap-2"><Pill kind={a.severity === 'critical' ? 'ALERT' : 'WARNING'} className="shrink-0">{a.type.replace(/_/g, ' ')}</Pill><span className="muted">{ago(a.ts, now)}</span></li>
            ))}</ul>
          )}
        </Card>
      </div>
    </>
  );
}
