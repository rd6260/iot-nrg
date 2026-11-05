import { useEffect, useState } from 'react';
import { Moon, Save, Sun } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { Btn, Card, Notice, PageHeader } from '../components/ui.jsx';

const GROUPS = [
  ['Alert thresholds', [
    ['tempHigh', 'Temperature alert', '°C', 1], ['humHigh', 'Humidity alert', '%', 1], ['lowBatteryV', 'Low-battery warning', 'V', 0.05]]],
  ['Adaptive sampling (sent to ESP32 on eiss2/config)', [
    ['motionThreshold', 'Motion detection threshold', 'g', 0.01], ['normalIntervalMs', 'NORMAL sampling interval', 'ms', 100], ['alertIntervalMs', 'ALERT sampling interval', 'ms', 100]]],
  ['Energy model & baseline', [
    ['powerNormalMw', 'Estimated NORMAL power', 'mW', 10], ['powerAlertMw', 'Estimated ALERT power', 'mW', 10], ['fixedIntervalMs', 'Fixed-rate baseline interval', 'ms', 100]]],
  ['Dashboard', [['refreshSec', 'Data refresh interval', 's', 1]]],
];

export default function SettingsPage() {
  const { settings, saveSettings, theme, setTheme } = useStore();
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (settings && !form) setForm(settings); }, [settings, form]);
  if (!form) return <div className="muted">Loading…</div>;
  const dirty = JSON.stringify(form) !== JSON.stringify(settings);
  const save = async () => {
    try { await saveSettings(form); setMsg('Saved'); } catch { setMsg('Save failed – is the server running?'); }
    setTimeout(() => setMsg(''), 3000);
  };
  return (
    <>
      <PageHeader title="Settings"><span className="muted text-sm">{msg}</span><Btn onClick={save} disabled={!dirty} className="disabled:opacity-40"><Save size={14} /> Save changes</Btn></PageHeader>
      <Notice kind="WARNING">Sampling interval and motion-threshold changes are published (retained) to <code>eiss2/config</code>. The current firmware uses compile-time constants, so it must be updated to subscribe to that topic before these take effect on the device.</Notice>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Appearance">
          <div className="flex gap-2">{[['light', Sun], ['dark', Moon]].map(([t, I]) => (
            <Btn key={t} onClick={() => setTheme(t)} className={theme === t ? 'ring-2 ring-[var(--s1)]' : ''}><I size={14} /> {t === 'light' ? 'Light' : 'Dark'}</Btn>))}</div>
        </Card>
        {GROUPS.map(([title, fields]) => (
          <Card key={title} title={title}>
            <div className="grid gap-3 sm:grid-cols-2">{fields.map(([k, label, unit, step]) => (
              <label key={k} className="flex flex-col gap-1 text-sm"><span className="muted text-xs">{label}</span>
                <span className="card flex items-center px-2"><input type="number" step={step} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full bg-transparent py-1.5 tabular-nums outline-none" /><span className="muted text-xs">{unit}</span></span></label>))}</div>
          </Card>))}
      </div>
    </>
  );
}
