import { MODE } from '../lib/colors.js';
import { buildSegments } from '../lib/hooks.js';
import { durationMs, timeOf } from '../lib/format.js';
import { Empty } from './ui.jsx';

export default function ModeTimeline({ modes, from, to }) {
  const segs = buildSegments(modes, from, to);
  if (!segs.length) return <Empty>No mode data in this range yet.</Empty>;
  const total = to - from;
  return (
    <div>
      <div className="flex h-8 w-full gap-[2px] overflow-hidden rounded-md" role="img" aria-label="Mode timeline">
        {segs.map((s, i) => (
          <div key={i} title={`${s.mode}: ${timeOf(s.start)} – ${timeOf(s.end)} (${durationMs(s.end - s.start)})`}
            className={`${MODE[s.mode].bg} flex min-w-[3px] items-center justify-center overflow-hidden text-[10px] font-bold text-white`}
            style={{ width: `${((s.end - s.start) / total) * 100}%` }}>
            {(s.end - s.start) / total > 0.08 && s.mode}
          </div>
        ))}
      </div>
      <div className="muted mt-1 flex justify-between text-xs"><span>{timeOf(from)}</span><span>{timeOf(to)}</span></div>
      <div className="mt-2 flex gap-4 text-xs">
        {['NORMAL', 'ALERT'].map((m) => <span key={m} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${MODE[m].bg}`} />{m}</span>)}
      </div>
    </div>
  );
}
