import { Clock3, LockKeyhole, Play } from 'lucide-react';
import type { TraceResult } from '../../types';
import { formatDate, formatTime } from '../../utils/formatters';

export function TimelineBar({ trace, ready }: { trace?: TraceResult; ready: boolean }) {
  const first = trace?.steps[0];
  const last = trace?.steps.at(-1);
  return (
    <footer className="timeline-bar">
      <div className="timeline-label">
        <Clock3 size={18} />
        <div>
          <strong>Evidence timeline</strong>
          <small>
            {trace
              ? `${trace.steps.length} ordered transfers`
              : 'Trace a case to reveal its chronology'}
          </small>
        </div>
      </div>
      <div className="time-range">
        <span>
          {first ? `${formatDate(first.timestamp)} · ${formatTime(first.timestamp)}` : 'START'}
        </span>
        <div className="time-rule">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <span>
          {last ? `${formatDate(last.timestamp)} · ${formatTime(last.timestamp)} IST` : 'END'}
        </span>
      </div>
      <button disabled title="Timeline playback is introduced in Phase 3">
        <Play size={15} />
        Playback
        <LockKeyhole size={12} />
        <small>Phase 3</small>
      </button>
      <span className="connection-status">
        <i className={ready ? 'status-dot' : 'status-dot offline'} />
        {ready ? 'API CONNECTED' : 'API UNAVAILABLE'}
      </span>
    </footer>
  );
}
