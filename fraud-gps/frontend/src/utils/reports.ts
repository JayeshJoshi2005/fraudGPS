import type { CaseSummary } from '../types/reports';
import type { TraceResult } from '../types';
import { sameDataset } from './dataset';
import { validateDNA } from './dna';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

function sameIds(actual: string[], expected: Iterable<string>) {
  const ids = new Set(expected);
  return (
    actual.length === ids.size &&
    new Set(actual).size === actual.length &&
    actual.every((id) => ids.has(id))
  );
}

export function validateSummary(summary: CaseSummary, trace: TraceResult) {
  sameDataset(trace.dataset_version, summary.dataset_version, summary.trace.dataset_version);
  const fail = () => {
    throw new Error('Case summary evidence does not match this trace. Retry the summary.');
  };
  if (
    summary.complaint.complaint_id !== trace.complaint_id ||
    summary.complaint.victim_account !== trace.start_account ||
    summary.trace.complaint_id !== trace.complaint_id ||
    canonical(summary.trace) !== canonical(trace) ||
    summary.narrative !== trace.summary ||
    JSON.stringify(summary.narrative_transaction_ids) !==
      JSON.stringify(trace.summary_transaction_ids)
  )
    fail();
  validateDNA(summary.dna, trace);
  const accounts = new Set([
    trace.start_account,
    ...trace.steps.flatMap((s) => [s.from_account, s.to_account]),
  ]);
  const steps = new Set(trace.steps.map((s) => s.tx_id));
  const linkedCases = new Set(trace.statistics.other_linked_complaint_ids);
  const transactionIds = (subjects: Iterable<string>) => {
    const ids = new Set(subjects);
    return trace.steps
      .filter((step) => ids.has(step.from_account) || ids.has(step.to_account))
      .map((step) => step.tx_id);
  };
  const ids = new Set<string>();
  for (const item of summary.flagged_accounts) {
    sameDataset(trace.dataset_version, item.risk.dataset_version);
    if (
      ids.has(item.account_id) ||
      !accounts.has(item.account_id) ||
      item.account_id === trace.start_account ||
      item.risk.account_id !== item.account_id ||
      !Number.isFinite(item.risk.total_score) ||
      item.risk.total_score < 0.5 ||
      item.risk.total_score > 1 ||
      canonical(item.trail_role) !== canonical(trace.roles[item.account_id]) ||
      !sameIds(item.transaction_ids, transactionIds([item.account_id])) ||
      new Set(item.other_complaint_ids).size !== item.other_complaint_ids.length ||
      item.other_complaint_ids.some((id) => !linkedCases.has(id))
    )
      fail();
    ids.add(item.account_id);
  }
  const flagged = new Map(summary.flagged_accounts.map((item) => [item.account_id, item]));
  const entities = new Map(
    summary.dna.entity_dna.entity_matches.map((item) => [item.entity_id, item]),
  );
  const similar = new Map(summary.dna.similar_cases.map((item) => [item.complaint_id, item]));
  const endpoints = new Set(trace.statistics.probable_endpoint_account_ids);
  const actionIds = new Set<string>();
  for (const action of summary.recommendations) {
    if (
      !action.action_id.trim() ||
      !action.title.trim() ||
      !action.rationale.trim() ||
      actionIds.has(action.action_id) ||
      [action.account_ids, action.entity_ids, action.transaction_ids, action.complaint_ids].some(
        (references) => new Set(references).size !== references.length,
      ) ||
      action.transaction_ids.some((id) => !steps.has(id)) ||
      action.complaint_ids.includes(trace.complaint_id!)
    )
      fail();
    actionIds.add(action.action_id);
    switch (action.kind) {
      case 'freeze_review': {
        const item = flagged.get(action.account_ids[0]);
        if (
          !item ||
          action.account_ids.length !== 1 ||
          action.entity_ids.length ||
          action.priority !== (item.risk.total_score >= 0.7 ? 'High' : 'Medium') ||
          !sameIds(action.transaction_ids, item.transaction_ids) ||
          !sameIds(action.complaint_ids, item.other_complaint_ids)
        )
          fail();
        break;
      }
      case 'telecom_records': {
        const entity = entities.get(action.entity_ids[0]);
        const subjects =
          entity?.matched_account_ids.filter(
            (id) => accounts.has(id) && id !== trace.start_account,
          ) ?? [];
        const linked = new Set([...subjects, ...(entity?.shared_with_accounts ?? [])]);
        if (
          !entity ||
          entity.entity_type !== 'phone' ||
          !subjects.length ||
          linked.size < 2 ||
          action.entity_ids.length !== 1 ||
          action.priority !== 'Medium' ||
          !sameIds(action.account_ids, linked) ||
          !sameIds(action.transaction_ids, transactionIds(subjects)) ||
          !sameIds(action.complaint_ids, entity.shared_with_complaints)
        )
          fail();
        break;
      }
      case 'coordinate':
        if (
          action.priority !== 'Medium' ||
          !action.account_ids.length ||
          action.account_ids.some((id) => !endpoints.has(id)) ||
          action.entity_ids.length ||
          action.complaint_ids.length ||
          !sameIds(action.transaction_ids, transactionIds(action.account_ids))
        )
          fail();
        break;
      case 'link_case': {
        const other = similar.get(action.complaint_ids[0]);
        if (
          !other ||
          action.complaint_ids.length !== 1 ||
          action.priority !== 'Info' ||
          action.account_ids.length ||
          action.transaction_ids.length ||
          (other.similarity < 0.65 && !other.shared_entity_ids.length) ||
          !sameIds(action.entity_ids, other.shared_entity_ids)
        )
          fail();
        break;
      }
      default:
        fail();
    }
  }
}
