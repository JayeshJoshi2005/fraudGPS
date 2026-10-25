import type { Complaint, RiskResult, Role, TraceResult } from './index';
import type { DNAReport } from './dna';

export interface RecommendedAction {
  action_id: string;
  kind: 'freeze_review' | 'telecom_records' | 'coordinate' | 'link_case';
  priority: 'High' | 'Medium' | 'Info';
  title: string;
  rationale: string;
  account_ids: string[];
  entity_ids: string[];
  transaction_ids: string[];
  complaint_ids: string[];
}
export interface FlaggedAccount {
  account_id: string;
  label: string;
  bank_name: string;
  location: string;
  risk: RiskResult;
  trail_role: { role: Role; confidence: number; reasons: string[] };
  other_complaint_ids: string[];
  transaction_ids: string[];
}
export interface CaseSummary {
  dataset_version: string;
  method_version: string;
  complaint: Complaint;
  trace: TraceResult;
  dna: DNAReport;
  narrative: string;
  narrative_transaction_ids: string[];
  flagged_accounts: FlaggedAccount[];
  recommendations: RecommendedAction[];
  limitations: string[];
}
export interface ToastMessage {
  id: string;
  kind: 'story' | 'system';
  tone: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  detail: string;
}
