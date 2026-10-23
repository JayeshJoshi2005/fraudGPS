import { describe, it, expect } from 'vitest';
import type { DNAReport } from '../types/dna';
import type { TraceResult, GraphData } from '../types';
import { operatingWindow, percent, validateDNA } from './dna';
import { filterGraph, mergeGraphs } from './graph';

// Minimal independent contracts: deliberate colliding masks retain distinct IDs.
const trace = {
  dataset_version: 'v1',
  complaint_id: 'case-a',
  start_account: 'victim',
  options: { max_depth: 4, min_amount: '100.00', forwarding_window_hours: 24 },
  steps: [{ from_account: 'victim', to_account: 'a', tx_id: 'seed' }],
} as TraceResult;
const report = {
  dataset_version: 'v1',
  complaint_id: 'case-a',
  options: { ...trace.options, min_amount: '100' },
  signature_score: 0.8,
  best_match_complaint_id: 'case-b',
  weights: { entity: 0.4, behavioral: 0.35, network: 0.25 },
  component_scores: { entity: 0.5, behavioral: 1, network: 1 },
  entity_dna: {
    dataset_version: 'v1',
    subject_id: 'case-a',
    scope_account_ids: ['a'],
    linked_complaint_ids: ['case-b'],
    entity_matches: [
      {
        entity_id: 'device',
        matched_account_ids: ['a'],
        shared_with_accounts: ['b'],
        shared_with_complaints: ['case-b'],
      },
    ],
  },
  similar_cases: [
    {
      complaint_id: 'case-b',
      similarity: 0.8,
      component_scores: { entity: 0.5, behavioral: 1, network: 1 },
    },
  ],
  link_graph: {
    dataset_version: 'v1',
    nodes: [
      { data: { id: 'a', label: 'XXXX1234', risk_score: 0.7 } },
      { data: { id: 'b', label: 'XXXX1234', risk_score: 0.2 } },
    ],
    edges: [
      {
        data: {
          id: 'relation',
          kind: 'entity_link',
          source: 'a',
          target: 'b',
          entity_ids: ['device'],
          complaint_ids: ['case-b'],
          label: 'Also in case case-b',
        },
      },
    ],
  },
} as DNAReport;

describe('Fraud DNA evidence integrity', () => {
  it('accepts source-linked relations and equivalent decimal options', () =>
    expect(() => validateDNA(report, trace)).not.toThrow());
  it.each([
    'version',
    'case',
    'options',
    'weight',
    'composite',
    'self',
    'money',
    'wrong-entity',
    'wrong-peer',
    'nonfinite',
  ])('rejects %s mismatches', (kind) => {
    const changed = structuredClone(report);
    if (kind === 'version') changed.link_graph.dataset_version = 'v2';
    if (kind === 'case') changed.complaint_id = 'old-case';
    if (kind === 'options') changed.options.max_depth = 7;
    if (kind === 'weight') changed.weights.entity = 0.5;
    if (kind === 'composite') changed.signature_score = 0.9;
    if (kind === 'self') changed.similar_cases[0].complaint_id = trace.complaint_id!;
    if (kind === 'money') Object.assign(changed.link_graph.edges[0].data, { amount: '100' });
    if (kind === 'wrong-entity') changed.link_graph.edges[0].data.entity_ids = ['unknown'];
    if (kind === 'wrong-peer') changed.link_graph.edges[0].data.target = 'victim';
    if (kind === 'nonfinite') changed.signature_score = Number.NaN;
    expect(() => validateDNA(changed, trace)).toThrow();
  });
  it('merges separate identifier links without modifying transaction money or labels', () => {
    const base = {
      dataset_version: 'v1',
      nodes: [report.link_graph.nodes[0]],
      edges: [
        {
          data: {
            id: 'seed',
            source: 'a',
            target: 'b',
            kind: 'transaction',
            amount: '100.01',
            attributed_amount: '99.99',
          },
        },
      ],
    } as GraphData;
    const merged = mergeGraphs(base, report.link_graph);
    expect(merged.nodes).toHaveLength(2);
    expect(merged.edges).toHaveLength(2);
    const tx = merged.edges.find((edge) => edge.data.kind === 'transaction')!.data;
    expect(tx.kind === 'transaction' && tx.attributed_amount).toBe('99.99');
    const link = merged.edges.find((edge) => edge.data.kind === 'entity_link')!.data;
    expect('amount' in link).toBe(false);
    expect(filterGraph(merged, true).edges).toHaveLength(0);
  });
});

describe('Fraud DNA display', () => {
  it('shows midnight-spanning activity without reversing the time window', () =>
    expect(
      operatingWindow({
        timezone: 'Asia/Kolkata',
        histogram: [],
        active_hours: [0, 23],
        start_hour: 23,
        end_hour: 1,
        wraps_midnight: true,
      }),
    ).toBe('23:00–01:00 IST · crosses midnight'));
  it('keeps missing activity explicit', () =>
    expect(
      operatingWindow({
        timezone: 'Asia/Kolkata',
        histogram: [],
        active_hours: [],
        start_hour: null,
        end_hour: null,
        wraps_midnight: false,
      }),
    ).toBe('Not observed'));
  it('formats fractional similarities as percentages', () => expect(percent(0.8125)).toBe('81.3%'));
});
