"""Money trail input validation and response serialization."""

from fastapi import APIRouter

from app.models.analysis import TraceRequest, TraceResult
from app.routes.dependencies import Analysis

router = APIRouter(prefix="/api/trace", tags=["trace"])


@router.post("", response_model=TraceResult)
def trace(request: TraceRequest, analysis: Analysis) -> TraceResult:
    return analysis.trace(request)
