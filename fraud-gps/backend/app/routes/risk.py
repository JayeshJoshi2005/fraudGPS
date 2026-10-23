"""Account risk and ordered ranking endpoints."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.models.analysis import RiskResult
from app.routes.dependencies import Analysis

router = APIRouter(prefix="/api/risk", tags=["risk"])


@router.get("/top", response_model=list[RiskResult])
def top_risks(analysis: Analysis, limit: Annotated[int, Query(ge=1, le=200)] = 20):
    return analysis.risk.score_all_nodes()[:limit]


@router.get("/{account_id}", response_model=RiskResult)
def account_risk(account_id: str, analysis: Analysis):
    return analysis.risk.compute_risk_score(account_id)
