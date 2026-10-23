import type { GraphData, Money, TraceOptions } from './index';

export interface EntityMatch {
  entity_id: string;
  entity_type: string;
  masked_value: string;
  matched_account_ids: string[];
  shared_with_accounts: string[];
  shared_with_complaints: string[];
}
export interface EntityDNA {
  dataset_version: string;
  method_version: string;
  options: TraceOptions;
  subject_id: string;
  scope_account_ids: string[];
  entity_matches: EntityMatch[];
  total_entity_overlaps: number;
  linked_complaint_ids: string[];
  unique_linked_complaints: number;
}
export interface ComponentScores {
  entity: number;
  behavioral: number;
  network: number;
}
export interface Campaign {
  campaign_id: string;
  campaign_name: string;
  complaint_ids: string[];
  case_count: number;
  total_loss: Money;
  topology_type: string;
  operating_period: string;
}
export interface CampaignList {
  dataset_version: string;
  method_version: string;
  options: TraceOptions;
  entity_threshold: number;
  signature_threshold: number;
  items: Campaign[];
}
export interface BehavioralFingerprint {
  transaction_count: number;
  avg_transaction_amount: Money | null;
  avg_time_to_forward_minutes: number | null;
  split_ratio: number;
  operating_hours: {
    timezone: string;
    histogram: number[];
    active_hours: number[];
    start_hour: number | null;
    end_hour: number | null;
    wraps_midnight: boolean;
  };
  num_hops: number;
  channel_histogram: Record<string, number>;
  cashout_method: 'unknown';
  dormancy_days: number | null;
  dormancy_sample_accounts: number;
  transaction_ids: string[];
}
export interface NetworkFeatures {
  topology_type: string;
  node_count: number;
  edge_count: number;
  unique_edge_count: number;
  max_degree: number;
  avg_degree: number;
  fan_in_count: number;
  fan_out_count: number;
  density: number;
  clustering_coefficient: number;
}
export interface EntityLinkEdge {
  id: string;
  source: string;
  target: string;
  kind: 'entity_link';
  entity_ids: string[];
  complaint_ids: string[];
  label: string;
}
export interface SimilarCase {
  complaint_id: string;
  similarity: number;
  component_scores: ComponentScores;
  behavioral_coverage: number;
  shared_entity_ids: string[];
  amount_lost: Money;
  scam_type: string;
  campaign_id: string | null;
}
export interface DNAReport {
  dataset_version: string;
  method_version: string;
  complaint_id: string;
  options: TraceOptions;
  signature_score: number;
  best_match_complaint_id: string | null;
  component_scores: ComponentScores;
  weights: ComponentScores;
  component_formulas: Record<string, string>;
  campaign: Campaign | null;
  entity_dna: EntityDNA;
  behavioral_dna: {
    fingerprint: BehavioralFingerprint;
    similar_cases: { complaint_id: string; similarity: number }[];
    similar_campaigns: { campaign: Campaign; similarity: number; compared_case_count: number }[];
  };
  network_dna: {
    topology_type: string;
    topology_features: NetworkFeatures;
    similar_topologies: { complaint_id: string; similarity: number }[];
  };
  similar_cases: SimilarCase[];
  compared_case_count: number;
  link_graph: GraphData & {
    edges: { data: EntityLinkEdge }[];
    total_link_count: number;
    truncated: boolean;
  };
  limitations: string[];
}
