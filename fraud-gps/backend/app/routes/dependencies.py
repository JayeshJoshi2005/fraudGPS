"""HTTP access to the dataset-scoped analysis service."""

from decimal import Decimal
from typing import Annotated

from fastapi import Depends, Query, Request

from app.engines.service import AnalysisService
from app.models.analysis import TraceOptions


def get_analysis(request: Request) -> AnalysisService:
    return request.app.state.analysis


Analysis = Annotated[AnalysisService, Depends(get_analysis)]


def trace_options(
    max_depth: Annotated[int, Query(ge=1, le=7)] = 5,
    min_amount: Annotated[Decimal, Query(ge=0, max_digits=18, decimal_places=2)] = Decimal(
        "100.00"
    ),
    forwarding_window_hours: Annotated[int, Query(ge=1, le=168)] = 24,
) -> TraceOptions:
    """Parse textual query integers before applying the strict analysis contract."""
    return TraceOptions(
        max_depth=max_depth,
        min_amount=min_amount,
        forwarding_window_hours=forwarding_window_hours,
    )


Options = Annotated[TraceOptions, Depends(trace_options)]
