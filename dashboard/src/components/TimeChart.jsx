import { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, AreaChart, Area, BarChart, Bar } from 'recharts';
import { useColors } from '../lib/colors.js';
import { timeOf } from '../lib/format.js';
import { Empty } from './ui.jsx';

function Tip({ active, payload, label, unit, digits }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-lg">
      <div className="muted mb-1">{new Date(label).toLocaleString()}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="muted">{p.name}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums">{p.value == null ? '–' : Number(p.value).toFixed(digits)} {unit}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Time-series chart. series: [{ key, label }]; colours are assigned by slot order.
 * kind: 'line' | 'step' | 'area'. Legend is shown for 2+ series; a table view toggle is always available.
 */
export function TimeChart({ data, series, unit = '', digits = 2, height = 240, kind = 'line', yDomain, xKey = 'ts' }) {
  const c = useColors();
  const [table, setTable] = useState(false);
  const rows = useMemo(() => data ?? [], [data]);
  if (!rows.length) return <Empty />;
  const common = { data: rows, margin: { top: 6, right: 8, bottom: 0, left: 0 } };
  const axes = (
    <>
      <CartesianGrid stroke={c.grid} vertical={false} />
      <XAxis dataKey={xKey} type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={timeOf}
        stroke={c.ink2} tick={{ fontSize: 11, fill: c.ink2 }} tickLine={false} minTickGap={50} />
      <YAxis stroke={c.ink2} tick={{ fontSize: 11, fill: c.ink2 }} tickLine={false} axisLine={false} width={44}
        domain={yDomain ?? ['auto', 'auto']} unit="" tickFormatter={(v) => (Math.abs(v) >= 100 ? Math.round(v) : +v.toFixed(2))} />
      <Tooltip content={<Tip unit={unit} digits={digits} />} cursor={{ stroke: c.ink2, strokeDasharray: '3 3' }} />
      {series.length > 1 && <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: c.ink2 }} />}
    </>
  );
  const marks = series.map((s, i) => {
    const color = c.s[i % 4];
    const p = { dataKey: s.key, name: s.label, stroke: color, strokeWidth: 2, dot: false, isAnimationActive: false, connectNulls: true,
      activeDot: { r: 4, stroke: c.surface, strokeWidth: 2 }, type: kind === 'step' ? 'stepAfter' : 'monotone' };
    return kind === 'area' ? <Area key={s.key} {...p} fill={color} fillOpacity={0.15} /> : <Line key={s.key} {...p} />;
  });
  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {kind === 'area' ? <AreaChart {...common}>{axes}{marks}</AreaChart> : <LineChart {...common}>{axes}{marks}</LineChart>}
        </ResponsiveContainer>
      </div>
      <button onClick={() => setTable((t) => !t)} className="muted mt-1 text-xs underline">{table ? 'Hide table' : 'View as table'}</button>
      {table && (
        <div className="mt-2 max-h-48 overflow-auto text-xs">
          <table className="w-full tabular-nums">
            <thead className="muted sticky top-0 bg-[var(--surface)] text-left"><tr><th className="py-1">Time</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
            <tbody>{rows.slice(-100).reverse().map((r) => (
              <tr key={r[xKey]} className="border-t border-[var(--line)]"><td className="py-0.5">{timeOf(r[xKey])}</td>{series.map((s) => <td key={s.key}>{r[s.key] == null ? '–' : Number(r[s.key]).toFixed(digits)}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Simple categorical bar chart (one bar per entity, fixed colour slot per entity). */
export function CompareBars({ data, unit = '', digits = 2, height = 220 }) {
  const c = useColors();
  if (!data?.length) return <Empty />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="name" stroke={c.ink2} tick={{ fontSize: 12, fill: c.ink2 }} tickLine={false} />
          <YAxis stroke={c.ink2} tick={{ fontSize: 11, fill: c.ink2 }} tickLine={false} axisLine={false} width={48} />
          <Tooltip cursor={{ fill: c.grid, opacity: 0.4 }} content={({ active, payload }) => active && payload?.length ? (
            <div className="card px-3 py-2 text-xs shadow-lg"><span className="muted">{payload[0].payload.name}: </span><b className="tabular-nums">{Number(payload[0].value).toFixed(digits)} {unit}</b></div>) : null} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false} label={{ position: 'top', fontSize: 11, fill: c.ink2, formatter: (v) => Number(v).toFixed(digits) }}
            shape={(p) => <rect x={p.x} y={p.y} width={p.width} height={Math.max(0, p.height)} rx={4} fill={p.payload.color ?? c.s[p.payload.slot ?? 0]} />} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
