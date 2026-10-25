import { describe, expect, it } from 'vitest';
import type { TraceResult } from '../types';
import type { CaseSummary } from '../types/reports';
import { validateSummary } from './reports';

// Independent minimal evidence contracts; unused presentation fields are omitted.
const trace: TraceResult = {
  dataset_version: 'v1',
  complaint_id: 'case-a',
  start_account: 'victim',
  options: { max_depth: 4, min_amount: '100', forwarding_window_hours: 24 },
  steps: [
    {
      tx_id: 'seed',
      from_account: 'victim',
      to_account: 'a',
      amount: '100',
      attributed_amount: '100',
      timestamp: '2026-10-25T10:00:00+05:30',
      channel: 'UPI',
      depth: 1,
      allocations: [],
    },
  ],
  summary: 'Observed source note.',
  summary_transaction_ids: ['seed'],
  detections: [],
  balances: [],
  warnings: [],
  metrics: {
    seed_amount: '100',
    hop_volume: '100',
    retained_amount: '100',
    stopped_amount: '0',
    probable_terminal_amount: '100',
    account_count: 2,
    transaction_count: 1,
    max_depth_reached: 1,
  },
  roles: { a: { role: 'Collector', confidence: 0.8, reasons: ['Source transfer.'] } },
  statistics: {
    probable_endpoint_account_ids: ['a'],
    other_linked_complaint_ids: ['case-b'],
    fastest_forward_minutes: null,
    transfer_duration_seconds: 0,
  },
};
const summary = {
  dataset_version: 'v1',
  complaint: { complaint_id: 'case-a', victim_account: 'victim' },
  trace,
  narrative: trace.summary,
  narrative_transaction_ids: ['seed'],
  flagged_accounts: [
    {
      account_id: 'a',
      label: 'XXXX1234',
      risk: { dataset_version: 'v1', account_id: 'a', total_score: 0.7 },
      trail_role: trace.roles.a,
      transaction_ids: ['seed'],
      other_complaint_ids: ['case-b'],
    },
  ],
  recommendations: [
    {
      action_id: 'review-a',
      kind: 'freeze_review',
      priority: 'High',
      title: 'Review account a',
      rationale: 'Review the cited source transfer.',
      account_ids: ['a'],
      entity_ids: [],
      transaction_ids: ['seed'],
      complaint_ids: ['case-b'],
    },
  ],
  dna: {
    dataset_version: 'v1',
    complaint_id: 'case-a',
    options: trace.options,
    signature_score: 0,
    best_match_complaint_id: null,
    weights: { entity: 0.4, behavioral: 0.35, network: 0.25 },
    component_scores: { entity: 0, behavioral: 0, network: 0 },
    entity_dna: {
      dataset_version: 'v1',
      subject_id: 'case-a',
      scope_account_ids: ['victim', 'a'],
      linked_complaint_ids: [],
      entity_matches: [],
    },
    link_graph: { dataset_version: 'v1', nodes: [], edges: [] },
    similar_cases: [],
  },
} as unknown as CaseSummary;

describe('case summary evidence', () => {
  it('accepts equivalent object key ordering without relaxing evidence values', () => {
    const reordered = structuredClone(summary);
    reordered.trace.options = { forwarding_window_hours: 24, min_amount: '100', max_depth: 4 };
    expect(() => validateSummary(reordered, trace)).not.toThrow();
    Object.assign(reordered.trace, { metrics: { seed_amount: '999' } });
    expect(() => validateSummary(reordered, trace)).toThrow();
  });
  it('accepts the same trace, narrative, and cited review actions', () =>
    expect(() => validateSummary(summary, trace)).not.toThrow());
  it.each([
    'version',
    'case',
    'options',
    'transfer',
    'narrative',
    'reference',
    'risk',
    'victim',
    'self',
    'duplicate-action',
    'action-account',
    'action-entity',
    'action-case',
    'action-priority',
    'action-kind',
    'action-evidence',
    'flagged-case',
    'flagged-role',
    'flagged-evidence',
    'victim-account',
  ])('rejects %s mismatches', (kind) => {
    const changed = structuredClone(summary);
    if (kind === 'version') changed.dataset_version = 'v2';
    if (kind === 'case') changed.complaint.complaint_id = 'old';
    if (kind === 'options') changed.trace.options.max_depth = 7;
    if (kind === 'transfer') changed.trace.steps[0].attributed_amount = '1';
    if (kind === 'narrative') changed.narrative = 'Unrelated source note.';
    if (kind === 'reference') changed.recommendations[0].transaction_ids = ['unrelated'];
    if (kind === 'risk') changed.flagged_accounts[0].risk.total_score = Number.NaN;
    if (kind === 'victim') changed.flagged_accounts[0].account_id = 'victim';
    if (kind === 'self') changed.flagged_accounts[0].other_complaint_ids = ['case-a'];
    if (kind === 'duplicate-action') changed.recommendations.push(changed.recommendations[0]);
    if (kind === 'action-account') changed.recommendations[0].account_ids = ['unrelated'];
    if (kind === 'action-entity') changed.recommendations[0].entity_ids = ['unrelated'];
    if (kind === 'action-case') changed.recommendations[0].complaint_ids = ['unrelated'];
    if (kind === 'action-priority') changed.recommendations[0].priority = 'Info';
    if (kind === 'action-kind') Object.assign(changed.recommendations[0], { kind: 'unknown' });
    if (kind === 'action-evidence') changed.recommendations[0].transaction_ids = [];
    if (kind === 'flagged-case') changed.flagged_accounts[0].other_complaint_ids = ['unrelated'];
    if (kind === 'flagged-role')
      changed.flagged_accounts[0].trail_role = {
        ...changed.flagged_accounts[0].trail_role,
        role: 'Victim',
      };
    if (kind === 'flagged-evidence') changed.flagged_accounts[0].transaction_ids = [];
    if (kind === 'victim-account') changed.complaint.victim_account = 'unrelated';
    expect(() => validateSummary(changed, trace)).toThrow();
  });
  it('validates external phone links, probable endpoints, and eligible case comparisons', () => {
    const value = structuredClone(summary);
    value.dna.entity_dna.entity_matches = [
      {
        entity_id: 'phone-a',
        entity_type: 'phone',
        masked_value: 'XXXX12',
        matched_account_ids: ['a'],
        shared_with_accounts: ['external'],
        shared_with_complaints: ['case-b'],
      },
    ];
    value.dna.similar_cases = [
      {
        complaint_id: 'case-b',
        similarity: 0.8,
        component_scores: { entity: 0.8, behavioral: 0.8, network: 0.8 },
        shared_entity_ids: ['phone-a'],
      } as CaseSummary['dna']['similar_cases'][number],
    ];
    const base = value.recommendations[0];
    value.recommendations.push(
      {
        ...base,
        action_id: 'phone-review',
        kind: 'telecom_records',
        priority: 'Medium',
        account_ids: ['a', 'external'],
        entity_ids: ['phone-a'],
      },
      {
        ...base,
        action_id: 'endpoint-review',
        kind: 'coordinate',
        priority: 'Medium',
        complaint_ids: [],
      },
      {
        ...base,
        action_id: 'case-review',
        kind: 'link_case',
        priority: 'Info',
        account_ids: [],
        entity_ids: ['phone-a'],
        transaction_ids: [],
      },
    );
    expect(() => validateSummary(value, trace)).not.toThrow();
    for (const mutate of [
      (s: CaseSummary) => (s.recommendations[1].entity_ids = ['unrelated']),
      (s: CaseSummary) => (s.recommendations[1].account_ids = ['a', 'unrelated']),
      (s: CaseSummary) => (s.recommendations[1].transaction_ids = []),
      (s: CaseSummary) => (s.recommendations[2].account_ids = ['victim']),
      (s: CaseSummary) => (s.recommendations[3].complaint_ids = ['unrelated']),
      (s: CaseSummary) => (s.recommendations[3].entity_ids = ['unrelated']),
      (s: CaseSummary) => {
        s.dna.similar_cases[0].shared_entity_ids = [];
        s.dna.similar_cases[0].similarity = 0.6;
        s.dna.similar_cases[0].component_scores = { entity: 0, behavioral: 1, network: 1 };
        s.recommendations[3].entity_ids = [];
      },
    ]) {
      const changed = structuredClone(value);
      mutate(changed);
      expect(() => validateSummary(changed, trace)).toThrow();
    }
  });
  it('accepts a victim-only empty trail without fabricating DNA scope', () => {
    const empty = {
      ...trace,
      steps: [],
      summary: 'No matching transfers.',
      summary_transaction_ids: [],
    };
    const value = structuredClone(summary);
    value.trace = empty;
    value.narrative = empty.summary;
    value.narrative_transaction_ids = [];
    value.flagged_accounts = [];
    value.recommendations = [];
    value.dna.entity_dna.scope_account_ids = ['victim'];
    expect(() => validateSummary(value, empty)).not.toThrow();
  });
});
