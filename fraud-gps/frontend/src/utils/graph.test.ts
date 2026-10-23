import { describe, expect, it } from 'vitest';
import type { GraphData, GraphNode, GraphEdge } from '../types';
import { filterGraph, mergeGraphs } from './graph';

const node = (id: string, risk: number): { data: GraphNode } => ({
  data: {
    id,
    label: 'XXXX1234',
    holder_name: 'Synthetic',
    bank_name: 'Test',
    risk_score: risk,
    risk_level: 'Low',
    role: 'Normal',
    total_inflow: '100',
    total_outflow: '0',
    transaction_count: 1,
  },
});
const edge = (
  id: string,
  source: string,
  target: string,
  attributed: string | null,
): { data: GraphEdge } => ({
  data: {
    id,
    source,
    target,
    kind: 'transaction',
    amount: '100',
    amount_display: '₹100',
    attributed_amount: attributed,
    timestamp: '2026-01-01T00:00:00Z',
    date_display: '01-Jan-2026',
    channel: 'UPI',
  },
});
const graph: GraphData = {
  dataset_version: 'v1',
  nodes: [node('victim', 0), node('suspect', 0.8), node('normal', 0.2)],
  edges: [edge('a', 'victim', 'suspect', '100'), edge('b', 'suspect', 'normal', '100')],
};
describe('graph evidence integrity', () => {
  it('keeps the victim and removes orphan edges when filtering', () => {
    const filtered = filterGraph(graph, true, 'victim');
    expect(filtered.nodes.map((n) => n.data.id)).toEqual(['victim', 'suspect']);
    expect(filtered.edges.map((e) => e.data.id)).toEqual(['a']);
  });
  it('preserves parallel transfers and original attribution on expansion', () => {
    const merged = mergeGraphs(graph, {
      ...graph,
      edges: [edge('a', 'victim', 'suspect', null), edge('parallel', 'victim', 'suspect', null)],
    });
    expect(merged.edges).toHaveLength(3);
    const original = merged.edges.find((e) => e.data.id === 'a')?.data;
    expect(original?.kind === 'transaction' && original.attributed_amount).toBe('100');
    expect(graph.edges).toHaveLength(2);
  });
  it('rejects mixed dataset versions', () =>
    expect(() => mergeGraphs(graph, { ...graph, dataset_version: 'v2' })).toThrow(
      'dataset changed',
    ));
  it('preserves the graph when filtering is disabled', () =>
    expect(filterGraph(graph, false)).toBe(graph));
});
