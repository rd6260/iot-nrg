import { useMemo } from 'react';
import { Leaf } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { useRange, useStats } from '../lib/hooks.js';
import { energy, fmt, durationMs } from '../lib/format.js';
import { Card, Grid, Notice, PageHeader, RangeSelect, Stat } from '../components/ui.jsx';
import { CompareBars, TimeChart } from '../components/TimeChart.jsx';
import { useEnergySeries } from './Energy.jsx';
import { useColors } from '../lib/colors.js';

export default function Efficiency() {
  const { settings } = useStore();
  const c = useColors();
  const { key, setKey, ms } = useRange('1h');
  const { data: stats } = useStats(ms);
  const series = useEnergySeries(ms);
  const e = stats?.efficiency;
  const cmp = useMemo(() => series.map((r) => ({
    ts: r.ts, adaptive: r.cum, fixed: (r.cumDt * (e?.fixed.power_mw ?? 0)) / 3.6e6,
    adaptiveMsgs: r.cumMsgs, fixedMsgs: r.cumDt / (settings?.fixedIntervalMs ?? 1000),
  })), [series, e, settings]);

  if (!e || e.observed_ms === 0) return (<><PageHeader title="Energy Efficiency Analytics"><RangeSelect value={key} onChange={setKey} /></PageHeader><Card><div className="muted py-10 text-center">Waiting for data in this range…</div></Card></>);

  return (
    <>
      <PageHeader title="Energy Efficiency Analytics" subtitle={`Adaptive sensing vs. a fixed ${e.fixed.interval_ms / 1000}s sampling baseline · ${durationMs(e.observed_ms)} observed`}><RangeSelect value={key} onChange={setKey} /></PageHeader>
      {e.estimated && <Notice kind="WARNING">Energy figures use the estimated power model, so the saving reflects the model, not measured current. The message-count comparison is exact.</Notice>}
      <Grid cols={4}>
        <div className="card p-4 sm:col-span-2 xl:col-span-1">
          <div className="muted flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide"><Leaf size={14} /> Energy saved</div>
          <div className="mt-1.5 text-5xl font-semibold tabular-nums text-normal">{fmt(e.savings_pct, 1)}<span className="text-2xl">%</span></div>
          <div className="muted mt-1 text-xs">{energy(e.fixed.energy_mwh - e.adaptive.energy_mwh)} less than fixed-rate</div>
        </div>
        <Stat label="Fixed-rate energy" value={energy(e.fixed.energy_mwh)} sub={`${fmt(e.fixed.power_mw, 0)} mW constant`} />
        <Stat label="Adaptive energy" value={energy(e.adaptive.energy_mwh)} sub={`${fmt(e.adaptive.power_mw, 0)} mW average`} />
        <Stat label="Transmissions saved" value={fmt(e.message_reduction_pct, 1)} unit="%" sub={`${e.adaptive.messages} sent vs ${e.fixed.messages}`} />
      </Grid>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card title="Cumulative energy: adaptive vs fixed-rate"><TimeChart data={cmp} kind="line" unit="mWh" digits={3}
          series={[{ key: 'adaptive', label: 'Adaptive' }, { key: 'fixed', label: 'Fixed-rate' }]} /></Card>
        <Card title="Cumulative transmissions"><TimeChart data={cmp} kind="line" unit="msgs" digits={0}
          series={[{ key: 'adaptiveMsgs', label: 'Adaptive' }, { key: 'fixedMsgs', label: 'Fixed-rate' }]} /></Card>
        <Card title="Total energy (mWh)"><CompareBars unit="mWh" digits={3} data={[{ name: 'Adaptive', value: e.adaptive.energy_mwh, slot: 0 }, { name: 'Fixed-rate', value: e.fixed.energy_mwh, slot: 1 }]} /></Card>
        <Card title="Average power (mW)"><CompareBars unit="mW" digits={0} data={[{ name: 'Adaptive', value: e.adaptive.power_mw, slot: 0 }, { name: 'Fixed-rate', value: e.fixed.power_mw, slot: 1 }]} /></Card>
        <Card title="Sampling frequency (Hz)"><CompareBars unit="Hz" digits={3} data={[{ name: 'Adaptive (avg)', value: e.adaptive.freq_hz, slot: 0 }, { name: 'Fixed-rate', value: e.fixed.freq_hz, slot: 1 }]} /></Card>
        <Card title="Performance summary">
          <ul className="space-y-2 text-sm leading-relaxed">
            <li>Over <b>{durationMs(e.observed_ms)}</b> the adaptive system sent <b>{e.adaptive.messages}</b> messages; a fixed {e.fixed.interval_ms / 1000}s schedule would have sent about <b>{e.fixed.messages}</b> (<b>{fmt(e.message_reduction_pct, 1)}%</b> fewer).</li>
            <li>It consumed <b>{energy(e.adaptive.energy_mwh)}</b> against <b>{energy(e.fixed.energy_mwh)}</b>, saving <b className="text-normal">{fmt(e.savings_pct, 1)}%</b>.</li>
            <li>Average sampling rate was <b>{fmt(e.adaptive.freq_hz, 3)} Hz</b> vs {fmt(e.fixed.freq_hz, 3)} Hz, with ALERT mode keeping full-rate resolution during motion.</li>
          </ul>
          <p className="muted mt-3 text-xs">Baseline: the ALERT-rate power draw sustained for the whole period ({e.estimated ? 'estimated' : 'measured'}). Change the baseline interval in Settings.</p>
        </Card>
      </div>
    </>
  );
}
