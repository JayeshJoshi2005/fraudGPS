import type { DNAReport, BehavioralFingerprint, ComponentScores } from '../types/dna';
import type { TraceResult } from '../types';
import { sameDataset } from './dataset';
import { formatCurrency } from './formatters';

export const percent = (score: number) => `${(score * 100).toFixed(1)}%`;
export function operatingWindow(hours: BehavioralFingerprint['operating_hours']) {
  if (!hours.active_hours.length || hours.start_hour === null || hours.end_hour === null)
    return 'Not observed';
  if (hours.active_hours.length === 24) return 'All hours observed · IST';
  const hour = (value: number) => `${String(value).padStart(2, '0')}:00`;
  return `${hour(hours.start_hour)}–${hour(hours.end_hour)} IST${hours.wraps_midnight ? ' · crosses midnight' : ''}`;
}
const combined = (scores: ComponentScores) =>
  0.4 * scores.entity + 0.35 * scores.behavioral + 0.25 * scores.network;
export function validateDNA(report: DNAReport, trace: TraceResult) {
  sameDataset(
    trace.dataset_version,
    report.dataset_version,
    report.entity_dna.dataset_version,
    report.link_graph.dataset_version,
  );
  const fail = () => {
    throw new Error('Fraud DNA evidence does not match this trace. Retry the analysis.');
  };
  const validScore = (score: number) => Number.isFinite(score) && score >= 0 && score <= 1;
  if (
    !validScore(report.signature_score) ||
    Object.values(report.component_scores).some((value) => !validScore(value))
  )
    fail();
  if (
    report.complaint_id !== trace.complaint_id ||
    report.entity_dna.subject_id !== trace.complaint_id ||
    report.options.max_depth !== trace.options.max_depth ||
    report.options.forwarding_window_hours !== trace.options.forwarding_window_hours ||
    formatCurrency(report.options.min_amount) !== formatCurrency(trace.options.min_amount) ||
    report.weights.entity !== 0.4 ||
    report.weights.behavioral !== 0.35 ||
    report.weights.network !== 0.25 ||
    Math.abs(combined(report.component_scores) - report.signature_score) > 1e-9
  )
    fail();
  const traceAccounts = new Set([
    trace.start_account,
    ...trace.steps.flatMap((step) => [step.from_account, step.to_account]),
  ]);
  if (
    report.entity_dna.scope_account_ids.some((id) => !traceAccounts.has(id)) ||
    report.entity_dna.linked_complaint_ids.includes(trace.complaint_id!)
  )
    fail();
  for (const row of report.similar_cases) {
    if (
      row.complaint_id === trace.complaint_id ||
      !Number.isFinite(row.similarity) ||
      Object.values(row.component_scores).some((value) => !validScore(value)) ||
      row.similarity < 0 ||
      row.similarity > 1 ||
      Math.abs(combined(row.component_scores) - row.similarity) > 1e-9
    )
      fail();
  }
  if (report.best_match_complaint_id) {
    const best = report.similar_cases[0];
    if (
      !best ||
      best.complaint_id !== report.best_match_complaint_id ||
      Math.abs(best.similarity - report.signature_score) > 1e-9 ||
      ['entity', 'behavioral', 'network'].some(
        (key) =>
          best.component_scores[key as keyof ComponentScores] !==
          report.component_scores[key as keyof ComponentScores],
      )
    )
      fail();
  }
  const scope = new Set(report.entity_dna.scope_account_ids);
  const nodes = new Set(report.link_graph.nodes.map((node) => node.data.id));
  const entities = new Map(
    report.entity_dna.entity_matches.map((match) => [match.entity_id, match]),
  );
  for (const { data } of report.link_graph.edges) {
    if (
      data.kind !== 'entity_link' ||
      'amount' in data ||
      'timestamp' in data ||
      !scope.has(data.source) ||
      scope.has(data.target) ||
      !nodes.has(data.source) ||
      !nodes.has(data.target) ||
      data.source === data.target ||
      !data.entity_ids.length ||
      !data.complaint_ids.length
    )
      fail();
    for (const id of data.entity_ids) {
      const match = entities.get(id);
      if (
        !match ||
        !match.matched_account_ids.includes(data.source) ||
        !match.shared_with_accounts.includes(data.target) ||
        data.complaint_ids.some((cid) => !match.shared_with_complaints.includes(cid))
      )
        fail();
    }
  }
}
