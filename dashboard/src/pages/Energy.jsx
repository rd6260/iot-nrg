import { useMemo } from 'react';
import { BatteryMedium, Zap, Activity, Plug } from 'lucide-react';
import { useStore, useApi } from '../lib/store.jsx';
import { useRange, useFrom, useStats } from '../lib/hooks.js';
import { MODE } from '../lib/colors.js';
import { energy, fmt } from '../lib/format.js';
import { Card, Grid, Notice, PageHeader, Pill, RangeSelect, Stat } from '../components/ui.jsx';
import { CompareBars, TimeChart } from '../components/TimeChart.jsx';

export function useEnergySeries(ms) {
  const from = useFrom(ms);
  const { data } = useApi(`/api/energy-series?from=${from}`, [ms]);
  return useMemo(() => {
    let cum = 0, cumN = 0, cumA = 0, cumDt = 0, msgs = 0;
    return (data ?? []).map((r) => {
      cum += r.energy_mwh; cumN += r.normal_mwh; cumA += r.alert_mwh; cumDt += r.dt_ms; msgs += r.samples;
      return { ...r, cum, cumN, cumA, cumDt, cumMsgs: msgs };
    });
  }, [data]);
}

export default function Energy() {
  const { latest, settings } = useStore();
  const { key, setKey, ms } = useRange('1h');
  const series = useEnergySeries(ms);
  const { data: stats } = useStats(ms);
  const est = latest?.power_estimated === 1;
  const batt = latest?.battery_v;
  const battKind = batt == null ? 'OFFLINE' : batt < settings.lowBatteryV ? 'ALERT' : batt < settings.lowBatteryV + 0.3 ? 'WARNING' : 'NORMAL';

  return (
    <>
      <PageHeader title="Energy Monitoring" subtitle="Power draw and cumulative consumption"><RangeSelect value={key} onChange={setKey} /></PageHeader>
      {est && <Notice kind="WARNING"><b>Power values are estimated.</b> The firmware doesn’t report voltage/current yet, so power is modelled from the current mode ({settings?.powerNormalMw} mW NORMAL / {settings?.powerAlertMw} mW ALERT – editable in Settings). Add an INA219 and publish <code>voltage</code> and <code>current_ma</code> (or <code>power_mw</code>) to see measured values.</Notice>}
      <Grid cols={4}>
        <Stat icon={Plug} label={`Voltage${est ? ' (n/a)' : ''}`} value={fmt(latest?.voltage, 2)} unit="V" />
        <Stat icon={Activity} label={`Current${est ? ' (n/a)' : ''}`} value={fmt(latest?.current_ma, 1)} unit="mA" />
        <Stat icon={Zap} label={`Power${est ? ' (estimated)' : ''}`} value={fmt(latest?.power_mw, 0)} unit="mW" />
        <Stat icon={Zap} label="Energy in range" value={stats ? energy(stats.total.energy_mwh) : '–'} sub={`avg ${fmt(stats?.total.avg_power_mw, 0)} mW`} />
      </Grid>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card title="Power consumption"><TimeChart data={series} kind="area" series={[{ key: 'power_mw', label: 'Power' }]} unit="mW" digits={0} /></Card>
        <Card title="Cumulative energy (trend)"><TimeChart data={series} kind="area" series={[{ key: 'cum', label: 'Cumulative energy' }]} unit="mWh" digits={3} /></Card>
        <Card title="Energy by operating mode">
          <CompareBars unit="mWh" digits={3} height={200} data={[
            { name: 'NORMAL', value: stats?.modes.NORMAL.energy_mwh ?? 0, color: MODE.NORMAL.hex },
            { name: 'ALERT', value: stats?.modes.ALERT.energy_mwh ?? 0, color: MODE.ALERT.hex }]} />
        </Card>
        <Card title="Battery" right={<Pill kind={battKind}>{batt == null ? 'Not connected' : battKind === 'NORMAL' ? 'Good' : battKind === 'WARNING' ? 'Getting low' : 'Low'}</Pill>}>
          <div className="flex items-center gap-4 py-4"><BatteryMedium size={40} className="muted" aria-hidden />
            <div><div className="text-3xl font-semibold tabular-nums">{fmt(batt, 2)} <span className="muted text-base font-normal">V</span></div>
              <div className="muted text-xs">{batt == null ? 'Publish battery_v from the ESP32 after battery integration.' : `Warning below ${settings.lowBatteryV} V`}</div></div></div>
        </Card>
      </div>
    </>
  );
}
