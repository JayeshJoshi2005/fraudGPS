import type { PlaybackState, TimelineEvent, TraceResult } from '../types';

export const initialPlayback: PlaybackState = {
  mode: 'overview',
  step: 0,
  playing: false,
  speed: 1,
  revision: 0,
};
export type PlaybackAction =
  | { type: 'toggle' | 'replay' | 'tick' | 'overview' | 'pause' }
  | { type: 'seek'; step: number }
  | { type: 'speed'; speed: PlaybackState['speed'] };

export function reducePlayback(
  state: PlaybackState,
  action: PlaybackAction,
  total: number,
): PlaybackState {
  if (action.type === 'speed') return { ...state, speed: action.speed };
  if (action.type === 'overview')
    return { ...state, mode: 'overview', step: 0, playing: false, revision: state.revision + 1 };
  if (action.type === 'pause') return { ...state, playing: false };
  if (!total) return state;
  if (
    action.type === 'replay' ||
    (action.type === 'toggle' && (state.mode === 'overview' || state.step === total))
  )
    return { ...state, mode: 'story', step: 0, playing: true, revision: state.revision + 1 };
  if (action.type === 'toggle') return { ...state, playing: !state.playing };
  if (action.type === 'seek')
    return {
      ...state,
      mode: 'story',
      step: Math.max(0, Math.min(total, Math.trunc(action.step))),
      playing: false,
      revision: state.revision + 1,
    };
  if (action.type === 'tick' && state.playing) {
    const step = Math.min(total, state.step + 1);
    return { ...state, step, playing: step < total };
  }
  return state;
}

export function eventDelay(event: TimelineEvent | undefined, speed: PlaybackState['speed']) {
  return Math.max(1000, event?.type === 'layering' ? event.account_ids.length * 150 : 0) / speed;
}

// Validate references and event ordering against the exact trace used by the canvas.
export function validateTimeline(events: TimelineEvent[], trace: TraceResult) {
  const steps = new Map(trace.steps.map((s) => [s.tx_id, s]));
  const accounts = new Set([
    trace.start_account,
    ...trace.steps.flatMap((s) => [s.from_account, s.to_account]),
  ]);
  const seen = new Set<string>();
  const transfers = new Set<string>();
  const detections = new Map(trace.detections.map((d) => [d.event_id, d]));
  let previous = -Infinity;
  let previousTie = '';
  for (const [index, event] of events.entries()) {
    const time = Date.parse(event.timestamp);
    const tie = `${event.type === 'transfer' ? '0' : '1'}:${event.event_id}`;
    if (
      event.step !== index + 1 ||
      seen.has(event.event_id) ||
      !Number.isFinite(time) ||
      time < previous ||
      (time === previous && tie < previousTie) ||
      !event.account_ids.length ||
      event.account_ids.some((id) => !accounts.has(id)) ||
      !event.transaction_ids.length ||
      event.transaction_ids.some(
        (id) => !steps.has(id) || Date.parse(steps.get(id)!.timestamp) > time,
      )
    )
      throw new Error('Timeline evidence does not match this trace. Retry the timeline.');
    if (event.type === 'transfer') {
      const tx = steps.get(event.transaction_ids[0])!;
      if (
        event.transaction_ids.length !== 1 ||
        event.event_id !== `transfer:${tx.tx_id}` ||
        transfers.has(tx.tx_id) ||
        time !== Date.parse(tx.timestamp) ||
        event.amount !== tx.attributed_amount ||
        event.account_ids.join('|') !== [tx.from_account, tx.to_account].join('|')
      )
        throw new Error('Timeline transfer does not match this trace. Retry the timeline.');
      transfers.add(tx.tx_id);
    } else {
      const expected = detections.get(event.event_id);
      if (!expected || detectionSignature(event) !== detectionSignature(expected))
        throw new Error('Timeline detection does not match this trace. Retry the timeline.');
      if (event.transaction_ids.some((id) => !transfers.has(id)))
        throw new Error('Timeline detection precedes its transfers. Retry the timeline.');
    }
    seen.add(event.event_id);
    previous = time;
    previousTie = tie;
  }
  if (transfers.size !== steps.size || events.length !== steps.size + detections.size)
    throw new Error('The timeline is incomplete. Retry the timeline.');
}

function detectionSignature(event: Omit<TimelineEvent, 'step'>) {
  return JSON.stringify([
    event.event_id,
    event.type,
    Date.parse(event.timestamp),
    event.account_ids,
    event.transaction_ids,
    event.amount,
    event.description,
    Object.entries(event.metrics).sort(([a], [b]) => a.localeCompare(b)),
    event.outputs.map((o) => [o.transaction_id, o.to_account, o.attributed_amount]),
  ]);
}

export const isSignificant = (event: TimelineEvent) =>
  ['split', 'rapid_forward', 'terminal', 'layering', 'merge'].includes(event.type);
export const eventTitle = (type: string) =>
  ({
    transfer: 'Transfer',
    split: 'Split detected',
    rapid_forward: 'Rapid forward',
    terminal: 'Probable endpoint',
    layering: 'Layering chain',
    merge: 'Receipts merged',
  })[type] || type;

export function projectStory(events: TimelineEvent[], step: number, trace: TraceResult) {
  const nodes = new Set([trace.start_account]);
  const edges = new Set<string>();
  const rapidEdges = new Set<string>();
  const terminalEdges = new Set<string>();
  const terminalNodes = new Set<string>();
  let card: TimelineEvent | undefined;
  for (const event of events.slice(0, Math.max(0, step))) {
    event.account_ids.forEach((id) => nodes.add(id));
    event.transaction_ids.forEach((id) => edges.add(id));
    if (event.type === 'rapid_forward')
      event.transaction_ids.slice(1).forEach((id) => rapidEdges.add(id));
    if (event.type === 'terminal') {
      event.transaction_ids.forEach((id) => terminalEdges.add(id));
      event.account_ids.forEach((id) => terminalNodes.add(id));
    }
    if (isSignificant(event)) card = event;
  }
  // Include both endpoints for every revealed transfer, including detection references.
  for (const tx of trace.steps)
    if (edges.has(tx.tx_id)) {
      nodes.add(tx.from_account);
      nodes.add(tx.to_account);
    }
  return {
    nodes,
    edges,
    rapidEdges,
    terminalEdges,
    terminalNodes,
    card,
    current: events[step - 1],
    complete: events.length > 0 && step >= events.length,
  };
}
export type StoryFrame = ReturnType<typeof projectStory>;

export function roleLabel(role: string) {
  return role === 'Cash-Out' ? 'Probable endpoint' : role === 'Layering Node' ? 'Layering' : role;
}

export function cardPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  cardWidth = 224,
  cardHeight = 124,
) {
  return {
    left: Math.max(8, Math.min(x + 20, width - cardWidth - 8)),
    top: Math.max(8, Math.min(y - cardHeight - 16, height - cardHeight - 8)),
  };
}
