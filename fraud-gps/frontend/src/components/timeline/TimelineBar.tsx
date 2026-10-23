import type { CSSProperties } from 'react';
import { Clock3, Pause, Play, SkipBack, SkipForward, Eye } from 'lucide-react';
import type { PlaybackState, PlaybackSpeed, TimelineEvent, TraceResult } from '../../types';
import type { PlaybackAction } from '../../utils/playback';
import { eventTitle } from '../../utils/playback';
import { formatDate, formatTime } from '../../utils/formatters';
import { ErrorState, Loading } from '../common/Status';

interface Props {
  trace?: TraceResult;
  ready: boolean;
  events: TimelineEvent[];
  playback: PlaybackState;
  dispatch: (action: PlaybackAction) => void;
  loading: boolean;
  error?: string;
  retry: () => void;
}
export function TimelineBar({
  trace,
  ready,
  events,
  playback,
  dispatch,
  loading,
  error,
  retry,
}: Props) {
  const { step, playing, speed, mode } = playback;
  const enabled = events.length > 0 && !loading && !error;
  const current = mode === 'story' ? events[step - 1] : undefined;
  const timestamp = current?.timestamp || trace?.steps[0]?.timestamp;
  const progress = events.length ? (step / events.length) * 100 : 0;
  const milestones = [
    events.find((e) => e.type === 'split'),
    events.find((e) => e.type === 'layering'),
    events.find((e) => e.type === 'terminal'),
  ].filter((e): e is TimelineEvent => !!e);
  return (
    <footer className="timeline-bar" aria-label="Evidence timeline">
      <div className="playback-controls">
        <button
          aria-label="Previous event"
          disabled={!enabled || (mode === 'story' && step === 0)}
          onClick={() => dispatch({ type: 'seek', step: Math.max(0, step - 1) })}
        >
          <SkipBack size={16} />
        </button>
        <button
          className="play-control"
          aria-label={playing ? 'Pause timeline' : 'Play timeline'}
          disabled={!enabled}
          onClick={() => dispatch({ type: 'toggle' })}
        >
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button
          aria-label="Next event"
          disabled={!enabled || step === events.length}
          onClick={() => dispatch({ type: 'seek', step: step + 1 })}
        >
          <SkipForward size={16} />
        </button>
        <select
          aria-label="Playback speed"
          value={speed}
          disabled={!enabled}
          onChange={(e) =>
            dispatch({ type: 'speed', speed: Number(e.target.value) as PlaybackSpeed })
          }
        >
          {[0.5, 1, 2, 3].map((value) => (
            <option key={value} value={value}>
              {value}x
            </option>
          ))}
        </select>
        <button
          aria-label="Show full trail"
          title="Return to the full investigation"
          disabled={mode === 'overview'}
          onClick={() => dispatch({ type: 'overview' })}
        >
          <Eye size={16} />
        </button>
      </div>
      <div className="timeline-content">
        {loading ? (
          <Loading>Loading evidence timeline…</Loading>
        ) : error ? (
          <ErrorState message={error} retry={retry} />
        ) : (
          <>
            <div
              className="scrubber-wrap"
              style={{ '--progress': `${progress}%` } as CSSProperties}
            >
              <input
                aria-label="Timeline event"
                aria-valuetext={
                  mode === 'overview'
                    ? 'Full trail overview'
                    : step === 0
                      ? 'Introduction: victim account'
                      : `Event ${step}: ${current?.description}`
                }
                type="range"
                min={0}
                max={events.length || 1}
                step={1}
                value={step}
                disabled={!enabled}
                onPointerDown={() => dispatch({ type: 'seek', step })}
                onKeyDown={(e) => {
                  if (
                    ['Home', 'End', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
                      e.key,
                    )
                  )
                    dispatch({ type: 'seek', step });
                }}
                onChange={(e) => dispatch({ type: 'seek', step: Number(e.target.value) })}
              />
              <div className="timeline-markers" aria-hidden="true">
                {events.map((event) => (
                  <button
                    key={event.event_id}
                    tabIndex={-1}
                    className={`timeline-marker ${event.type} ${event.step <= step ? 'passed' : ''}`}
                    style={{ left: `${(event.step / events.length) * 100}%` }}
                    title={`${event.step} · ${eventTitle(event.type)} · ${event.description}`}
                    onClick={() => dispatch({ type: 'seek', step: event.step })}
                  />
                ))}
              </div>
            </div>
            <div className="timeline-event-row">
              <span className="current-event-label" title={current?.description}>
                <Clock3 size={11} />
                {current
                  ? eventTitle(current.type) + ' · ' + current.description
                  : trace
                    ? mode === 'story'
                      ? 'Victim account · ready to follow the funds'
                      : `${events.length} events · Play to follow the trail`
                    : 'Trace a case to reveal its chronology'}
              </span>
              <div className="event-pills">
                {milestones.map((event) => (
                  <button
                    key={event.event_id}
                    title={event.description}
                    onClick={() => dispatch({ type: 'seek', step: event.step })}
                  >
                    {eventTitle(event.type)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="timeline-position">
        <strong aria-label="Replay progress">
          {mode === 'overview' ? 'OVERVIEW' : `${step} / ${events.length} EVENTS`}
        </strong>
        <time
          dateTime={timestamp}
          title={timestamp ? `${formatDate(timestamp)} · ${formatTime(timestamp)} IST` : ''}
        >
          {timestamp
            ? `${formatDate(timestamp)} · ${formatTime(timestamp)} IST`
            : 'EVENT-PACED REPLAY'}
        </time>
        <span className="connection-status">
          <i className={ready ? 'status-dot' : 'status-dot offline'} />
          {ready ? 'API CONNECTED' : 'API UNAVAILABLE'}
        </span>
      </div>
    </footer>
  );
}
