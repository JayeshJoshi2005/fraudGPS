import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Core } from 'cytoscape';
import { Check, GitFork, Zap, MapPin, Layers, Merge } from 'lucide-react';
import type { GraphData, PlaybackState, TimelineEvent, TraceResult, Selection } from '../../types';
import { cardPosition, eventTitle, roleLabel, type StoryFrame } from '../../utils/playback';
import { formatCurrency, formatDate, formatDuration, formatTime } from '../../utils/formatters';

export const roleColors: Record<string, string> = {
  Collector: '#c4b5fd',
  Splitter: '#fbbf24',
  Hub: '#f9a8d4',
  'Cash-Out': '#fda4af',
  'Layering Node': '#67e8f9',
  Bridge: '#93c5fd',
};
interface Position {
  id: string;
  x: number;
  y: number;
  radius: number;
}
function EventCard({
  event,
  position,
  width,
  height,
  playing,
}: {
  event: TimelineEvent;
  position?: Position;
  width: number;
  height: number;
  playing: boolean;
}) {
  const [visible, setVisible] = useState(true);
  const [accent, setAccent] = useState(true);
  const [cardHeight, setCardHeight] = useState(124);
  const card = useRef<HTMLElement>(null);
  const remaining = useRef({ card: 3000, accent: 2000 });
  useEffect(() => {
    if (!playing || !visible) return;
    const start = performance.now();
    const hide = window.setTimeout(() => setVisible(false), remaining.current.card);
    const dim = window.setTimeout(() => setAccent(false), remaining.current.accent);
    return () => {
      clearTimeout(hide);
      clearTimeout(dim);
      const elapsed = performance.now() - start;
      remaining.current.card = Math.max(0, remaining.current.card - elapsed);
      remaining.current.accent = Math.max(0, remaining.current.accent - elapsed);
    };
  }, [playing, visible]);
  useLayoutEffect(() => {
    if (!card.current) return;
    const observer = new ResizeObserver(() => {
      if (card.current) setCardHeight(card.current.offsetHeight);
    });
    observer.observe(card.current);
    return () => observer.disconnect();
  }, []);
  if (!visible) return null;
  const Icon =
    { split: GitFork, rapid_forward: Zap, terminal: MapPin, layering: Layers, merge: Merge }[
      event.type
    ] || Zap;
  const elapsed = Number(event.metrics.elapsed_seconds);
  return (
    <article
      ref={card}
      className={`story-event-card ${event.type} ${accent ? 'accent' : ''}`}
      data-event-id={event.event_id}
      data-anchor-id={position?.id || ''}
      style={{
        ...cardPosition(
          position?.x ?? 0,
          position?.y ?? height,
          width,
          height,
          Math.min(224, width - 16),
          cardHeight,
        ),
        animation: playing ? undefined : 'none',
      }}
      aria-label="Story event"
    >
      <div>
        <Icon size={15} />
        <strong>{eventTitle(event.type)}</strong>
      </div>
      <p className="story-event-amount">
        {formatCurrency(event.amount)}
        {event.type === 'split' && ` → ${event.metrics.destination_count} accounts`}
      </p>
      <p>{event.description}</p>
      {Number.isFinite(elapsed) && <small>Observed over {formatDuration(elapsed)}</small>}
      <small>
        {formatDate(event.timestamp)} · {formatTime(event.timestamp)} IST
      </small>
      {!position && <small>Account hidden by display filter</small>}
    </article>
  );
}

export function StoryOverlay({
  cy,
  graph,
  trace,
  story,
  playback,
  selection,
}: {
  cy: Core | null;
  graph: GraphData;
  trace?: TraceResult;
  story?: StoryFrame;
  playback: PlaybackState;
  selection: Selection;
}) {
  const [viewport, setViewport] = useState({ width: 600, height: 400, nodes: [] as Position[] });
  useEffect(() => {
    if (!cy || cy.destroyed()) return;
    const update = () => {
      if (cy.destroyed()) return;
      setViewport({
        width: cy.width(),
        height: cy.height(),
        nodes: cy.nodes().map((node) => ({
          id: node.id(),
          ...node.renderedPosition(),
          radius: node.renderedOuterHeight() / 2,
        })),
      });
    };
    update();
    cy.on('pan zoom resize position layoutstop', update);
    return () => {
      cy.off('pan zoom resize position layoutstop', update);
    };
  }, [cy, graph]);
  const positions = new Map(viewport.nodes.map((n) => [n.id, n]));
  const event = story?.card;
  const anchor = event?.type === 'layering' ? event.account_ids.at(-1) : event?.account_ids[0];
  return (
    <>
      <div className="role-labels" aria-hidden="true">
        {trace &&
          graph.nodes
            .filter(
              (node) =>
                roleColors[node.data.role] &&
                (story
                  ? story.current?.account_ids.includes(node.data.id)
                  : selection?.kind === 'node' && selection.id === node.data.id),
            )
            .map(({ data }) => {
              const p = positions.get(data.id);
              if (!p || p.x < 0 || p.y < 0 || p.x > viewport.width || p.y > viewport.height)
                return null;
              return (
                <span
                  key={data.id}
                  className="node-role-label"
                  data-account-id={data.id}
                  style={{ left: p.x, top: p.y + p.radius + 27, color: roleColors[data.role] }}
                >
                  {roleLabel(data.role)}
                </span>
              );
            })}
      </div>
      {event && (
        <EventCard
          key={`${playback.revision}:${event.event_id}`}
          event={event}
          position={positions.get(anchor || '')}
          width={viewport.width}
          height={viewport.height}
          playing={playback.playing}
        />
      )}
      {story?.complete && trace && (
        <div className="story-complete" role="status">
          <Check size={20} />
          <div>
            <strong>Trail complete</strong>
            <span>
              {trace.metrics.account_count} accounts ·{' '}
              {trace.detections.filter((e) => e.type === 'split').length} splits ·{' '}
              {trace.statistics.probable_endpoint_account_ids.length} probable endpoints
            </span>
            <small>Withdrawal method unknown · Full trail totals</small>
          </div>
        </div>
      )}
    </>
  );
}
