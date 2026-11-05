import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { useStore, useWindowReadings } from '../lib/store.jsx';
import { useRange, useStats, useFrom } from '../lib/hooks.js';
import { MODE } from '../lib/colors.js';
import { dateTimeOf, durationMs, fmt } from '../lib/format.js';
import { Card, Grid, PageHeader, Pill, RangeSelect, Stat } from '../components/ui.jsx';
import { TimeChart } from '../components/TimeChart.jsx';
import ModeTimeline from '../components/ModeTimeline.jsx';

export default function Adaptive() {
  const { latest, modes, now, settings, system } = useStore();
  const { key, setKey, ms } = useRange('1h');
  const from = useFrom(ms);
  const rows = useWindowReadings(ms);
  const { data: stats } = useStats(ms);
  const freq = useMemo(() => rows.map((r) => ({ ts: r.ts, hz: r.sampling_interval ? 1000 / r.sampling_interval : null })), [rows]);
  const inRange = modes.filter((m) => m.ts >= from);
  const n = stats?.modes.NORMAL.duration_ms ?? 0, a = stats?.modes.ALERT.duration_ms ?? 0;
  const tot = n + a || 1;
  const mode = system.online && latest ? latest.mode : 'OFFLINE';

  return (
    <>
      <PageHeader title="Adaptive Intelligence" subtitle="The ESP32 raises its own sampling rate when the accelerometer detects motion"><RangeSelect value={key} onChange={setKey} /></PageHeader>
      <Grid cols={4}>
        <div className="card p-4"><div className="muted text-xs font-medium uppercase tracking-wide">Current mode</div><div className="mt-2"><Pill kind={mode}>{mode}</Pill></div>
          <div className="muted mt-2 text-xs">{mode === 'ALERT' ? 'Motion seen in the last 3 s' : mode === 'NORMAL' ? 'No recent motion' : 'No live data'}</div></div>
        <Stat label="Sampling interval" value={latest ? latest.sampling_interval / 1000 : '–'} unit="s" sub={latest ? `${fmt(1000 / latest.sampling_interval, 2)} Hz` : ''} />
        <Stat label="Mode transitions" value={stats?.transitions ?? '–'} sub={`in selected range`} />
        <Stat label="Motion threshold" value={settings?.motionThreshold ?? '–'} unit="g" sub="change between consecutive samples" />
      </Grid>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card title="Mode timeline" className="lg:col-span-2"><ModeTimeline modes={modes} from={Math.max(from, modes.length ? Math.min(...modes.map((m) => m.ts)) : from)} to={now} /></Card>
        <Card title="Time in each mode">
          <div className="flex h-6 gap-[2px] overflow-hidden rounded-md">
            <div className={MODE.NORMAL.bg} style={{ width: `${(n / tot) * 100}%` }} /><div className={MODE.ALERT.bg} style={{ width: `${(a / tot) * 100}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            {[['NORMAL', n, stats?.modes.NORMAL.samples], ['ALERT', a, stats?.modes.ALERT.samples]].map(([m, d, s]) => (
              <div key={m}><Pill kind={m} /><div className="mt-1.5 text-xl font-semibold tabular-nums">{durationMs(d)}</div>
                <div className="muted text-xs">{fmt((d / tot) * 100, 1)} % of time · {s ?? 0} samples</div></div>
            ))}
          </div>
        </Card>
        <Card title="Sampling frequency history">
          <TimeChart data={freq} kind="step" series={[{ key: 'hz', label: 'Sampling frequency' }]} unit="Hz" height={190} />
        </Card>
        <Card title="Mode transitions" className="lg:col-span-2">
          {inRange.length === 0 ? <div className="muted py-6 text-center text-sm">No transitions in this range.</div> : (
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm"><thead className="muted text-left text-xs"><tr><th className="py-1">Time</th><th>Transition</th><th>New interval</th></tr></thead>
                <tbody>{inRange.map((m) => (
                  <tr key={m.id} className="border-t border-[var(--line)]"><td className="py-1.5 tabular-nums">{dateTimeOf(m.ts)}</td>
                    <td><span className="inline-flex items-center gap-2">{m.from_mode ? <Pill kind={m.from_mode} /> : <span className="muted">start</span>}<ArrowRight size={14} /><Pill kind={m.to_mode} /></span></td>
                    <td className="tabular-nums">{m.sampling_interval / 1000} s</td></tr>
                ))}</tbody></table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
