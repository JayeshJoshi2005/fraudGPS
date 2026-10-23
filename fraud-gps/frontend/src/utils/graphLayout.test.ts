import { describe, expect, it } from 'vitest';
import type { GraphData } from '../types';
import { flowPositions } from './graphLayout';

function makeGraph(ids: string[], transfers: [string, string][]): GraphData {
  return {
    dataset_version: 'test',
    nodes: ids.map((id) => ({
      data: {
        id,
        label: id,
        bank_name: 'Synthetic',
        holder_name: 'Demo',
        risk_score: 0,
        risk_level: 'Low',
        role: 'Normal',
        total_inflow: '0',
        total_outflow: '0',
        transaction_count: 0,
      },
    })),
    edges: transfers.map(([source, target], index) => ({
      data: {
        id: `tx-${index}`,
        source,
        target,
        kind: 'transaction',
        amount: '100',
        amount_display: '₹100',
        timestamp: '2026-01-01T00:00:00Z',
        date_display: '01-Jan-2026',
        channel: 'UPI',
        attributed_amount: '100',
      },
    })),
  };
}

describe('readable transaction layout', () => {
  it('orders split branches left to right and separates labels in each column', () => {
    const graph = makeGraph(
      ['v', 's', 'a', 'b', 'c', 'd'],
      [
        ['v', 's'],
        ['s', 'a'],
        ['s', 'b'],
        ['a', 'c'],
        ['b', 'd'],
      ],
    );
    const p = flowPositions(graph, 1500, 750, 'v');
    expect(p.v.x).toBeLessThan(p.s.x);
    expect(p.s.x).toBeLessThan(p.a.x);
    expect(p.a.x).toBe(p.b.x);
    expect(p.a.y).toBeLessThan(p.b.y);
    expect(p.c.y).toBeLessThan(p.d.y);
    expect(p.b.y - p.a.y).toBeGreaterThanOrEqual(78);
    expect(
      flowPositions(
        { ...graph, nodes: [...graph.nodes].reverse(), edges: [...graph.edges].reverse() },
        1500,
        750,
        'v',
      ),
    ).toEqual(p);
  });

  it('handles cycles, parallel transfers and disconnected accounts without mutating evidence', () => {
    const graph = makeGraph(
      ['v', 'a', 'b', 'c', 'isolated'],
      [
        ['v', 'a'],
        ['v', 'a'],
        ['a', 'v'],
        ['b', 'c'],
        ['c', 'b'],
      ],
    );
    const before = JSON.stringify(graph);
    const positions = flowPositions(graph, 1000, 700, 'v');
    expect(Object.keys(positions).sort()).toEqual(graph.nodes.map((n) => n.data.id).sort());
    expect(new Set(Object.values(positions).map((p) => `${p.x}:${p.y}`)).size).toBe(5);
    expect(JSON.stringify(graph)).toBe(before);
    expect(
      Object.values(positions).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    ).toBe(true);
  });

  it('keeps shared identifier peers outside the transaction hops', () => {
    const graph = makeGraph(['v', 's', 'peer'], [['v', 's']]);
    graph.edges.push({
      data: {
        id: 'dna',
        source: 'v',
        target: 'peer',
        kind: 'entity_link',
        entity_ids: ['e'],
        complaint_ids: ['case'],
        label: 'Shared device',
      },
    });
    const positions = flowPositions(graph, 1000, 700, 'v');
    expect(positions.v.x).toBeLessThan(positions.s.x);
    expect(positions.s.x).toBeLessThan(positions.peer.x);
  });

  it('supports empty and single account graphs and uses the available width', () => {
    expect(flowPositions(makeGraph([], []), 300, 400)).toEqual({});
    expect(Object.values(flowPositions(makeGraph(['one'], []), 300, 400))).toHaveLength(1);
    const graph = makeGraph(['v', 's'], [['v', 's']]);
    expect(flowPositions(graph, 1600, 750, 'v').s.x).toBeGreaterThan(
      flowPositions(graph, 900, 750, 'v').s.x,
    );
  });
});
