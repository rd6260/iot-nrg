import { useMemo, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { useApi, useStore } from '../lib/store.jsx';
import { dateTimeOf, fmt } from '../lib/format.js';
import { Btn, Card, PageHeader, Pill } from '../components/ui.jsx';
import { TimeChart } from '../components/TimeChart.jsx';

const toLocalInput = (ts) => { const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
const PAGE = 25;

export default function HistoryPage() {
  const { now } = useStore();
  const [from, setFrom] = useState(() => toLocalInput(Date.now() - 3600e3));
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const f = new Date(from).getTime(), t = to ? new Date(to).getTime() : null;
  const qs = `from=${f}${t ? `&to=${t}` : ''}`;
  const { data } = useApi(`/api/readings?${qs}&max=1000`);
  const rows = data ?? [];
  const desc = useMemo(() => [...rows].reverse(), [rows]);
  const preset = (ms) => { setFrom(toLocalInput(Date.now() - ms)); setTo(''); setPage(0); };
  const pages = Math.max(1, Math.ceil(desc.length / PAGE));
  const exp = (name) => `/api/export/${name}.csv?${qs}`;

  return (
    <>
      <PageHeader title="Historical Data" subtitle="Browse, export and report on everything stored in SQLite" />
      <Card className="mb-3">
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1"><span className="muted text-xs">From</span>
            <input type="datetime-local" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} className="card bg-transparent px-2 py-1.5" /></label>
          <label className="flex flex-col gap-1"><span className="muted text-xs">To (blank = now)</span>
            <input type="datetime-local" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} className="card bg-transparent px-2 py-1.5" /></label>
          <div className="flex gap-1.5">{[['1h', 3600e3], ['6h', 6 * 3600e3], ['24h', 24 * 3600e3], ['7d', 7 * 24 * 3600e3]].map(([l, ms]) => <Btn key={l} onClick={() => preset(ms)}>Last {l}</Btn>)}</div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
          {['readings', 'mode_changes', 'alerts', 'events'].map((n) => <a key={n} href={exp(n)}><Btn><Download size={14} /> {n.replace('_', ' ')}.csv</Btn></a>)}
          <a href={`/api/report.html?${qs}`}><Btn><FileText size={14} /> Experiment report</Btn></a>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Temperature & humidity"><TimeChart data={rows} unit="" series={[{ key: 'temperature', label: 'Temperature (°C)' }, { key: 'humidity', label: 'Humidity (%)' }]} height={220} /></Card>
        <Card title="Power & sampling interval">
          <TimeChart data={rows} series={[{ key: 'power_mw', label: 'Power (mW)' }]} unit="mW" digits={0} height={110} />
          <div className="mt-2"><TimeChart data={rows} kind="step" series={[{ key: 'sampling_interval', label: 'Interval (ms)' }]} unit="ms" digits={0} height={110} /></div>
        </Card>
      </div>

      <Card title={`Records (${desc.length}${desc.length >= 1000 ? '+, downsampled' : ''})`} className="mt-3"
        right={<div className="flex items-center gap-2 text-xs"><Btn disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Btn><span>{page + 1} / {pages}</span><Btn disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Btn></div>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm tabular-nums">
            <thead className="muted text-left text-xs"><tr><th className="py-1">Time</th><th>Temp °C</th><th>Hum %</th><th>X g</th><th>Y g</th><th>Z g</th><th>Mode</th><th>Interval ms</th><th>V</th><th>mA</th><th>mW</th></tr></thead>
            <tbody>{desc.slice(page * PAGE, page * PAGE + PAGE).map((r) => (
              <tr key={r.id} className="border-t border-[var(--line)]"><td className="py-1">{dateTimeOf(r.ts)}</td><td>{fmt(r.temperature)}</td><td>{fmt(r.humidity)}</td>
                <td>{fmt(r.accel_x, 3)}</td><td>{fmt(r.accel_y, 3)}</td><td>{fmt(r.accel_z, 3)}</td><td><Pill kind={r.mode} /></td><td>{r.sampling_interval}</td>
                <td>{fmt(r.voltage, 2)}</td><td>{fmt(r.current_ma, 1)}</td><td>{fmt(r.power_mw, 0)}{r.power_estimated ? '*' : ''}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <p className="muted mt-2 text-xs">* estimated from operating mode (no power sensor reading)</p>
      </Card>
    </>
  );
}
