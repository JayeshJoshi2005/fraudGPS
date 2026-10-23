"""Public analysis contracts; money remains exact decimal INR."""

from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from app.models.schemas import Account, AccountId, Complaint, Transaction

Amount = Annotated[Decimal, Field(ge=0, max_digits=18, decimal_places=2, allow_inf_nan=False)]
Score = Annotated[float, Field(ge=0, le=1)]
RoleName = Literal[
    "Victim", "Collector", "Splitter", "Layering Node", "Hub", "Cash-Out", "Bridge", "Normal"
]


class TraceOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    max_depth: Annotated[int, Field(ge=1, le=7, strict=True)] = 5
    min_amount: Amount = Decimal("100.00")
    forwarding_window_hours: Annotated[int, Field(ge=1, le=168, strict=True)] = 24


class TraceRequest(TraceOptions):
    complaint_id: Annotated[str, Field(pattern=r"^BH-\d{4}-\d{4}$")] | None = None
    account_id: AccountId | None = None
    start_tx_id: Annotated[str, Field(min_length=1)] | None = None

    @model_validator(mode="after")
    def one_source(self) -> Self:
        if (self.complaint_id is None) == (self.account_id is None):
            raise ValueError("Provide exactly one of complaint_id or account_id")
        if self.complaint_id and self.start_tx_id:
            raise ValueError("A complaint already specifies its initial transaction")
        return self


class Allocation(BaseModel):
    amount: Amount
    path: list[str]
    parent_tx_id: str | None = None
    depth: int


class TrailStep(Transaction):
    attributed_amount: Amount
    depth: int
    allocations: list[Allocation]


class Evidence(BaseModel):
    code: str
    description: str
    transaction_ids: list[str] = Field(default_factory=list)
    entity_ids: list[str] = Field(default_factory=list)
    complaint_ids: list[str] = Field(default_factory=list)
    values: dict[str, str | int | float] = Field(default_factory=dict)


class DetectionOutput(BaseModel):
    transaction_id: str
    to_account: str
    attributed_amount: Amount


class Detection(BaseModel):
    event_id: str
    type: str
    timestamp: AwareDatetime
    account_ids: list[str]
    transaction_ids: list[str]
    amount: Amount = Decimal("0.00")
    description: str
    metrics: dict[str, str | int | float] = Field(default_factory=dict)
    outputs: list[DetectionOutput] = Field(default_factory=list)


class Balance(BaseModel):
    account_id: str
    receipt_tx_id: str
    amount: Amount
    reason: str
    stopping_tx_id: str | None = None


class TraceMetrics(BaseModel):
    seed_amount: Amount
    hop_volume: Amount
    retained_amount: Amount
    stopped_amount: Amount
    probable_terminal_amount: Amount
    account_count: int
    transaction_count: int
    max_depth_reached: int


class Role(BaseModel):
    role: RoleName
    confidence: Score
    reasons: list[str]


class TrailStatistics(BaseModel):
    probable_endpoint_account_ids: list[str]
    fastest_forward_minutes: float | None
    transfer_duration_seconds: float
    other_linked_complaint_ids: list[str]


class TraceResult(BaseModel):
    dataset_version: str
    complaint_id: str | None
    start_account: str
    options: TraceOptions
    attribution_method: str = "chronological FIFO hypothesis; untracked balances unknown"
    steps: list[TrailStep]
    detections: list[Detection]
    balances: list[Balance]
    metrics: TraceMetrics
    roles: dict[str, Role] = Field(default_factory=dict)
    summary: str = ""
    summary_transaction_ids: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    statistics: TrailStatistics | None = None


class RiskResult(BaseModel):
    dataset_version: str
    account_id: str
    total_score: Score
    component_scores: dict[str, Score]
    weights: dict[str, Score]
    method_version: str = "phase1-heuristic-v1"
    component_formulas: dict[str, str]
    risk_level: Literal["Low", "Medium", "High", "Critical"]
    role: RoleName
    confidence: Score
    reasons: list[str]
    evidence: list[Evidence]
    explanations: list[str]


class GraphNodeData(BaseModel):
    id: str
    label: str
    bank_name: str
    holder_name: str
    risk_score: float
    risk_level: str
    role: RoleName
    total_inflow: Amount
    total_outflow: Amount
    transaction_count: int


class GraphEdgeData(BaseModel):
    id: str
    source: str
    target: str
    kind: Literal["transaction"] = "transaction"
    amount: Amount
    amount_display: str
    timestamp: AwareDatetime
    date_display: str
    channel: str
    attributed_amount: Amount | None = None


class GraphNode(BaseModel):
    data: GraphNodeData


class GraphEdge(BaseModel):
    data: GraphEdgeData


class GraphResult(BaseModel):
    dataset_version: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class TimelineEvent(Detection):
    step: int


class ComplaintList(BaseModel):
    total: int
    items: list[Complaint]


class ComplaintDetail(BaseModel):
    complaint: Complaint
    trace: TraceResult


class AccountDetail(BaseModel):
    dataset_version: str
    account: Account
    total_inflow: Amount
    total_outflow: Amount
    transaction_count: int
    distinct_senders: int
    distinct_recipients: int
    average_forward_minutes: float | None
    linked_complaint_ids: list[str]
