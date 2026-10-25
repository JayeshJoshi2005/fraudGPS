import { describe, expect, it } from 'vitest';
import type { GraphNode, TimelineEvent } from '../types';
import type { CaseSummary } from '../types/reports';
import { eventNotifications } from './notifications';
const nodes = [
  { id: 'a', label: 'XXXX1234', role: 'Splitter', risk_score: 0.7 },
  { id: 'victim', label: 'XXXX1234', role: 'Victim', risk_score: 0.99 },
] as GraphNode[];
const event = {
  event_id: 'split:seed',
  type: 'split',
  account_ids: ['a'],
  amount: '100000.01',
  metrics: { destination_count: 3 },
  description: 'Observed split',
  outputs: [],
} as unknown as TimelineEvent;
const summary = {
  flagged_accounts: [
    { account_id: 'a', label: 'XXXX1234', other_complaint_ids: ['case-b', 'case-c'] },
  ],
} as CaseSummary;
describe('source-based playback notifications', () => {
  it('uses exact Indian money formatting and measured split counts', () => {
    const values = eventNotifications(event, nodes, undefined, new Set());
    expect(values.at(-1)?.detail).toBe('₹1,00,000.01 split into 3 accounts.');
  });
  it('deduplicates account risk and case links while preserving new significant events', () => {
    const seen = new Set<string>();
    const first = eventNotifications(event, nodes, summary, seen);
    expect(first.map((item) => item.id)).toEqual(['risk:a', 'cases:a', 'split:seed']);
    expect(first[1].detail).toContain('2 other complaints');
    expect(eventNotifications(event, nodes, summary, seen)).toEqual([]);
    expect(
      eventNotifications({ ...event, event_id: 'split:next' }, nodes, summary, seen).map(
        (item) => item.id,
      ),
    ).toEqual(['split:next']);
    expect(eventNotifications(event, nodes, summary, new Set()).length).toBe(3);
  });
  it('never invents withdrawal methods for endpoints', () => {
    const values = eventNotifications(
      { ...event, type: 'terminal', description: 'ATM withdrawal' },
      [],
      undefined,
      new Set(),
    );
    expect(values[0].title).toBe('Probable endpoint reached');
    expect(values[0].detail).toContain('Withdrawal method unknown');
    expect(values[0].detail).not.toContain('ATM');
  });
  it('does not call a victim high risk or invent missing account evidence', () => {
    expect(
      eventNotifications(
        { ...event, type: 'transfer', account_ids: ['victim', 'unknown'] },
        nodes,
        undefined,
        new Set(),
      ),
    ).toEqual([]);
  });
  it('uses the measured threshold and preserves stable IDs with colliding masks', () => {
    const data = [
      { ...nodes[0], id: 'a', risk_score: 0.49 },
      { ...nodes[0], id: 'b', risk_score: 0.5 },
    ];
    const values = eventNotifications(
      { ...event, type: 'transfer', account_ids: ['a', 'b'] },
      data,
      undefined,
      new Set(),
    );
    expect(values.map((item) => item.id)).toEqual(['risk:b']);
    expect(values[0].detail).toContain('(b)');
  });
});
