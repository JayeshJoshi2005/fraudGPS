import { afterEach, describe, expect, it, vi } from 'vitest';
import cytoscape from 'cytoscape';
import type { Detection, TimelineEvent, TraceResult } from '../types';
import { animateStory, applyStoryFrame } from '../components/graph/graphAnimations';
import {
  cardPosition,
  eventDelay,
  initialPlayback,
  projectStory,
  reducePlayback,
  validateTimeline,
} from './playback';

const time = (minute: number) => new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString();
const transfers = [
  ['seed', 'v', 'a', '100.01', 0],
  ['left', 'a', 'b', '60.00', 1],
  ['right', 'a', 'c', '40.01', 2],
  ['repeat', 'a', 'c', '1.00', 3],
  ['cycle', 'c', 'a', '1.00', 4],
] as const;
const steps = transfers.map(([tx_id, from_account, to_account, amount, minute]) => ({
  tx_id,
  from_account,
  to_account,
  amount,
  attributed_amount: amount,
  timestamp: time(minute),
  channel: 'UPI',
  depth: 1,
  allocations: [],
}));
const detection = (
  event_id: string,
  type: string,
  minute: number,
  ids: string[],
  txs: string[],
): Detection => ({
  event_id,
  type,
  timestamp: time(minute),
  account_ids: ids,
  transaction_ids: txs,
  amount: '100.01',
  description: 'Independent synthetic evidence',
  metrics: {},
  outputs: [],
});
const detections: Detection[] = [
  {
    ...detection('split:seed', 'split', 2, ['a', 'b', 'c'], ['seed', 'left', 'right']),
    outputs: [
      { transaction_id: 'left', to_account: 'b', attributed_amount: '60.00' },
      { transaction_id: 'right', to_account: 'c', attributed_amount: '40.01' },
    ],
  },
  detection('rapid:seed', 'rapid_forward', 2, ['a'], ['seed', 'left', 'right']),
  detection('layering:seed', 'layering', 4, ['v', 'a', 'c', 'a'], ['seed', 'right', 'cycle']),
  detection('terminal:repeat', 'terminal', 1443, ['c'], ['repeat']),
];
const trace: TraceResult = {
  dataset_version: 'test',
  complaint_id: 'BH-2026-0001',
  start_account: 'v',
  options: { max_depth: 4, min_amount: '0', forwarding_window_hours: 24 },
  steps,
  detections,
  metrics: {
    seed_amount: '100.01',
    hop_volume: '202.02',
    retained_amount: '100.01',
    stopped_amount: '0',
    probable_terminal_amount: '1.00',
    account_count: 4,
    transaction_count: 5,
    max_depth_reached: 4,
  },
  roles: {},
  balances: [],
  summary: '',
  summary_transaction_ids: steps.map((s) => s.tx_id),
  warnings: [],
  statistics: {
    probable_endpoint_account_ids: ['c'],
    fastest_forward_minutes: 1,
    transfer_duration_seconds: 240,
    other_linked_complaint_ids: [],
  },
};
const events: TimelineEvent[] = [
  ...steps.map((s): Detection => ({
    ...detection(`transfer:${s.tx_id}`, 'transfer', 0, [s.from_account, s.to_account], [s.tx_id]),
    timestamp: s.timestamp,
    amount: s.attributed_amount,
  })),
  ...detections,
]
  .sort(
    (a, b) =>
      Date.parse(a.timestamp) - Date.parse(b.timestamp) ||
      Number(a.type !== 'transfer') - Number(b.type !== 'transfer') ||
      a.event_id.localeCompare(b.event_id),
  )
  .map((e, i) => ({ ...e, step: i + 1 }));

describe('timeline evidence', () => {
  it('accepts stable ordered evidence and ignores JSON field order', () => {
    validateTimeline(events, trace);
    validateTimeline(
      events.map(
        (event) => Object.fromEntries(Object.entries(event).reverse()) as unknown as TimelineEvent,
      ),
      trace,
    );
  });
  it.each([
    'missing',
    'duplicate',
    'wrong-account',
    'wrong-amount',
    'future-reference',
    'wrong-detection',
    'wrong-order',
  ])('rejects %s evidence', (kind) => {
    const changed = structuredClone(events);
    if (kind === 'missing') changed.pop();
    if (kind === 'duplicate') changed[1] = { ...changed[0], step: 2 };
    if (kind === 'wrong-account') changed[0].account_ids[1] = 'unknown';
    if (kind === 'wrong-amount') changed[0].amount = '200';
    if (kind === 'future-reference') changed[0].transaction_ids = ['cycle'];
    if (kind === 'wrong-detection')
      changed.find((e) => e.type === 'split')!.outputs[0].attributed_amount = '999';
    if (kind === 'wrong-order') [changed[3], changed[4]] = [changed[4], changed[3]];
    expect(() => validateTimeline(changed, trace)).toThrow(/timeline/i);
  });
});

describe('playback controls', () => {
  it('introduces the victim, pauses, resumes, completes, and replays', () => {
    let state = reducePlayback(initialPlayback, { type: 'toggle' }, events.length);
    expect(state).toMatchObject({ mode: 'story', step: 0, playing: true });
    state = reducePlayback(state, { type: 'tick' }, events.length);
    state = reducePlayback(state, { type: 'pause' }, events.length);
    expect(reducePlayback(state, { type: 'tick' }, events.length)).toBe(state);
    state = reducePlayback(state, { type: 'toggle' }, events.length);
    expect(state.step).toBe(1);
    for (let i = 0; i < events.length; i++)
      state = reducePlayback(state, { type: 'tick' }, events.length);
    expect(state).toMatchObject({ step: events.length, playing: false });
    expect(reducePlayback(state, { type: 'toggle' }, events.length)).toMatchObject({
      step: 0,
      playing: true,
    });
  });
  it('scrubs and steps pause even when already on the requested boundary', () => {
    let state = reducePlayback(initialPlayback, { type: 'replay' }, events.length);
    state = reducePlayback(state, { type: 'seek', step: 0 }, events.length);
    expect(state).toMatchObject({ step: 0, playing: false });
    expect(reducePlayback(state, { type: 'seek', step: -50 }, events.length).step).toBe(0);
    expect(reducePlayback(state, { type: 'seek', step: 999 }, events.length).step).toBe(
      events.length,
    );
  });
  it('uses the selected speed for event cadence and gives long chains time to cascade', () => {
    expect(eventDelay(undefined, 0.5)).toBe(2000);
    expect(eventDelay(events[0], 2)).toBe(500);
    expect(
      eventDelay({ ...events[0], type: 'layering', account_ids: Array(10).fill('a') }, 3),
    ).toBe(500);
    const state = reducePlayback(initialPlayback, { type: 'speed', speed: 3 }, events.length);
    expect(reducePlayback(state, { type: 'replay' }, events.length).speed).toBe(3);
    expect(reducePlayback(state, { type: 'overview' }, events.length).mode).toBe('overview');
  });
  it('keeps empty trails out of story mode', () =>
    expect(reducePlayback(initialPlayback, { type: 'replay' }, 0)).toBe(initialPlayback));
});

describe('story reconstruction', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it('cascades an independent layering chain every 150ms and cancels all timers', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const cy = cytoscape({
      headless: true,
      elements: ['v', 'a', 'c'].map((id) => ({ data: { id } })),
    });
    const event = events.find((e) => e.type === 'layering')!;
    const stop = animateStory(cy, event, 1);
    vi.advanceTimersByTime(0);
    expect(cy.nodes('.story-cascade').map((n) => n.id())).toEqual(['v']);
    vi.advanceTimersByTime(150);
    expect(cy.nodes('.story-cascade').map((n) => n.id())).toEqual(['a']);
    vi.advanceTimersByTime(150);
    expect(cy.nodes('.story-cascade').map((n) => n.id())).toEqual(['c']);
    stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(cy.nodes('.story-cascade')).toHaveLength(0);
    cy.destroy();
  });
  it('starts with only the victim and preserves parallel/cyclic transaction identities', () => {
    expect([...projectStory(events, 0, trace).nodes]).toEqual(['v']);
    const frame = projectStory(events, events.length, trace);
    expect([...frame.edges].sort()).toEqual(steps.map((s) => s.tx_id).sort());
    expect([...frame.terminalNodes]).toEqual(['c']);
    expect(frame.rapidEdges.has('right')).toBe(true);
    expect(frame.complete).toBe(true);
  });
  it('produces the same canvas classes after forward/backward/arbitrary jumps', () => {
    const cy = cytoscape({
      headless: true,
      elements: [
        ...['v', 'a', 'b', 'c', 'context'].map((id) => ({ data: { id } })),
        ...steps.map((s) => ({
          data: { id: s.tx_id, source: s.from_account, target: s.to_account },
        })),
        { data: { id: 'context-tx', source: 'v', target: 'context' } },
      ],
    });
    const classes = () => cy.elements().map((e) => [e.id(), [...e.classes()].sort()]);
    for (const target of [0, 1, 4, 7, events.length]) {
      applyStoryFrame(cy, projectStory(events, target, trace), trace);
      const expected = classes();
      for (const intermediate of [events.length, 0, 6, 1])
        applyStoryFrame(cy, projectStory(events, intermediate, trace), trace);
      applyStoryFrame(cy, projectStory(events, target, trace), trace);
      expect(classes()).toEqual(expected);
      expect(cy.getElementById('context').hasClass('story-dim')).toBe(true);
    }
    applyStoryFrame(cy, undefined, trace);
    expect(cy.elements('.story-dim')).toHaveLength(0);
    cy.destroy();
  });
  it('clamps floating cards within the canvas at zoomed and off-screen node positions', () => {
    expect(cardPosition(-20, -10, 600, 400)).toEqual({ left: 8, top: 8 });
    expect(cardPosition(900, 900, 600, 400)).toEqual({ left: 368, top: 268 });
    expect(cardPosition(100, 250, 600, 400)).toEqual({ left: 120, top: 110 });
  });
});
