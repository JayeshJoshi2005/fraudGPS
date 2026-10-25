"""Shared evidence contract for case summaries and PDF reports."""

from typing import Literal

from pydantic import BaseModel, Field

from app.models.analysis import RiskResult, Role, TraceOptions, TraceResult
from app.models.dna import DNAReport
from app.models.schemas import Complaint


class ReportRequest(TraceOptions):
    expected_dataset_version: str | None = Field(default=None, min_length=1, max_length=128)


class FlaggedAccount(BaseModel):
    account_id: str
    label: str
    bank_name: str
    location: str
    risk: RiskResult
    trail_role: Role
    other_complaint_ids: list[str]
    transaction_ids: list[str]


class RecommendedAction(BaseModel):
    action_id: str
    kind: Literal["freeze_review", "telecom_records", "coordinate", "link_case"]
    priority: Literal["High", "Medium", "Info"]
    title: str
    rationale: str
    account_ids: list[str] = Field(default_factory=list)
    entity_ids: list[str] = Field(default_factory=list)
    transaction_ids: list[str] = Field(default_factory=list)
    complaint_ids: list[str] = Field(default_factory=list)


class CaseSummary(BaseModel):
    dataset_version: str
    method_version: str = "evidence-summary-v1"
    complaint: Complaint
    trace: TraceResult
    dna: DNAReport
    narrative: str
    narrative_transaction_ids: list[str]
    flagged_accounts: list[FlaggedAccount]
    recommendations: list[RecommendedAction]
    limitations: list[str]
