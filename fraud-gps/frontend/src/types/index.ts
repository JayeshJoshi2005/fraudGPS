import type { EntityLinkEdge } from './dna';
export type Money = string;
export type Role =
  'Victim' | 'Collector' | 'Splitter' | 'Layering Node' | 'Hub' | 'Cash-Out' | 'Bridge' | 'Normal';
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export interface Complaint {
  complaint_id: string;
  victim_name: string;
  victim_account: string;
  victim_bank: string;
  suspect_account: string;
  amount_lost: Money;
  scam_type: string;
  complaint_date: string;
  description: string;
  status: string;
  initial_tx_id: string;
}
export interface TraceOptions {
  max_depth: number;
  min_amount: Money;
  forwarding_window_hours: number;
}
export interface GraphNode {
  id: string;
  label: string;
  bank_name: string;
  holder_name: string;
  risk_score: number;
  risk_level: RiskLevel;
  role: Role;
  total_inflow: Money;
  total_outflow: Money;
  transaction_count: number;
}
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: 'transaction';
  amount: Money;
  amount_display: string;
  timestamp: string;
  date_display: string;
  channel: string;
  attributed_amount: Money | null;
}
export interface GraphData {
  dataset_version: string;
  nodes: { data: GraphNode }[];
  edges: { data: GraphEdge | EntityLinkEdge }[];
}
export interface Allocation {
  amount: Money;
  path: string[];
  parent_tx_id: string | null;
  depth: number;
}
export interface TrailStep {
  tx_id: string;
  from_account: string;
  to_account: string;
  amount: Money;
  timestamp: string;
  channel: string;
  attributed_amount: Money;
  depth: number;
  allocations: Allocation[];
}
export interface Detection {
  event_id: string;
  type: string;
  timestamp: string;
  account_ids: string[];
  transaction_ids: string[];
  amount: Money;
  description: string;
  metrics: Record<string, string | number>;
  outputs: { transaction_id: string; to_account: string; attributed_amount: Money }[];
}
export interface TimelineEvent extends Detection {
  step: number;
}
export interface TimelineData {
  dataset_version: string;
  events: TimelineEvent[];
}
export type PlaybackSpeed = 0.5 | 1 | 2 | 3;
export interface PlaybackState {
  mode: 'overview' | 'story';
  step: number;
  playing: boolean;
  speed: PlaybackSpeed;
  revision: number;
}
export interface TraceResult {
  dataset_version: string;
  complaint_id: string | null;
  start_account: string;
  options: TraceOptions;
  steps: TrailStep[];
  detections: Detection[];
  balances: {
    account_id: string;
    receipt_tx_id: string;
    amount: Money;
    reason: string;
    stopping_tx_id: string | null;
  }[];
  metrics: {
    seed_amount: Money;
    hop_volume: Money;
    retained_amount: Money;
    stopped_amount: Money;
    probable_terminal_amount: Money;
    account_count: number;
    transaction_count: number;
    max_depth_reached: number;
  };
  roles: Record<string, { role: Role; confidence: number; reasons: string[] }>;
  summary: string;
  summary_transaction_ids: string[];
  warnings: string[];
  statistics: {
    probable_endpoint_account_ids: string[];
    fastest_forward_minutes: number | null;
    transfer_duration_seconds: number;
    other_linked_complaint_ids: string[];
  };
}
export interface RiskResult {
  dataset_version: string;
  account_id: string;
  total_score: number;
  risk_level: RiskLevel;
  component_scores: Record<string, number>;
  weights: Record<string, number>;
  role: Role;
  confidence: number;
  reasons: string[];
  explanations: string[];
  evidence: {
    code: string;
    description: string;
    transaction_ids: string[];
    entity_ids: string[];
    complaint_ids: string[];
    values: Record<string, string | number>;
  }[];
  component_formulas: Record<string, string>;
}
export interface AccountDetail {
  dataset_version: string;
  account: {
    account_id: string;
    masked_account: string;
    holder_name: string;
    bank_name: string;
    account_type: string;
    kyc_status: string;
    location: string;
    account_age_days: number;
    age_as_of: string;
  };
  total_inflow: Money;
  total_outflow: Money;
  transaction_count: number;
  distinct_senders: number;
  distinct_recipients: number;
  average_forward_minutes: number | null;
  linked_complaint_ids: string[];
}
export type Selection = { kind: 'node'; id: string } | { kind: 'edge'; id: string } | null;
export type ViewMode = 'Graph' | 'Route' | 'Cluster';
