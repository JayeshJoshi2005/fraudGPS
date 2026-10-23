"""Fraud DNA contracts. Identifier relations never have financial fields."""

from typing import Literal

from pydantic import BaseModel, Field

from app.models.analysis import Amount, GraphNode, Score, TraceOptions


class EntityMatch(BaseModel):
    entity_id: str
    entity_type: str
    masked_value: str
    matched_account_ids: list[str]
    shared_with_accounts: list[str]
    shared_with_complaints: list[str]


class EntityDNA(BaseModel):
    dataset_version: str
    method_version: str
    options: TraceOptions
    subject_id: str
    scope_account_ids: list[str]
    entity_matches: list[EntityMatch]
    total_entity_overlaps: int
    linked_complaint_ids: list[str]
    unique_linked_complaints: int


class OperatingHours(BaseModel):
    timezone: str = "Asia/Kolkata"
    histogram: list[Score]
    active_hours: list[int]
    start_hour: int | None
    end_hour: int | None
    wraps_midnight: bool


class BehavioralFingerprint(BaseModel):
    transaction_count: int
    avg_transaction_amount: Amount | None
    avg_time_to_forward_minutes: float | None
    split_ratio: float
    operating_hours: OperatingHours
    num_hops: int
    channel_histogram: dict[str, Score]
    cashout_method: Literal["unknown"] = "unknown"
    dormancy_days: float | None
    dormancy_sample_accounts: int
    transaction_ids: list[str]


class NetworkFeatures(BaseModel):
    topology_type: str
    node_count: int
    edge_count: int
    unique_edge_count: int
    max_degree: int
    avg_degree: float
    fan_in_count: int
    fan_out_count: int
    density: Score
    clustering_coefficient: Score


class ComponentScores(BaseModel):
    entity: Score
    behavioral: Score
    network: Score


class ComponentMatch(BaseModel):
    complaint_id: str
    similarity: Score


class Campaign(BaseModel):
    campaign_id: str
    campaign_name: str
    complaint_ids: list[str]
    case_count: int
    total_loss: Amount
    topology_type: str
    operating_period: str


class CampaignMatch(BaseModel):
    campaign: Campaign
    similarity: Score
    compared_case_count: int


class SimilarCase(BaseModel):
    complaint_id: str
    similarity: Score
    component_scores: ComponentScores
    behavioral_coverage: Score
    shared_entity_ids: list[str]
    amount_lost: Amount
    scam_type: str
    campaign_id: str | None


class BehavioralDNA(BaseModel):
    fingerprint: BehavioralFingerprint
    similar_cases: list[ComponentMatch]
    similar_campaigns: list[CampaignMatch]


class NetworkDNA(BaseModel):
    topology_type: str
    topology_features: NetworkFeatures
    similar_topologies: list[ComponentMatch]


class EntityLinkData(BaseModel):
    id: str
    source: str
    target: str
    kind: Literal["entity_link"] = "entity_link"
    entity_ids: list[str]
    complaint_ids: list[str]
    label: str


class EntityLink(BaseModel):
    data: EntityLinkData


class DNAGraph(BaseModel):
    dataset_version: str
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[EntityLink]
    total_link_count: int
    truncated: bool


class DNAReport(BaseModel):
    dataset_version: str
    method_version: str
    complaint_id: str
    options: TraceOptions
    signature_score: Score
    best_match_complaint_id: str | None
    component_scores: ComponentScores
    weights: dict[str, Score]
    component_formulas: dict[str, str]
    campaign: Campaign | None
    entity_dna: EntityDNA
    behavioral_dna: BehavioralDNA
    network_dna: NetworkDNA
    similar_cases: list[SimilarCase]
    compared_case_count: int
    link_graph: DNAGraph
    limitations: list[str]


class CampaignList(BaseModel):
    dataset_version: str
    method_version: str
    options: TraceOptions
    entity_threshold: Score
    signature_threshold: Score
    items: list[Campaign]
