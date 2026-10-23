"""Stable evidence-backed events for later playback."""

from fastapi import APIRouter

from app.models.analysis import TimelineEvent, TraceRequest
from app.routes.dependencies import Analysis, Options

router = APIRouter(prefix="/api/timeline", tags=["timeline"])


@router.get("/{complaint_id}", response_model=list[TimelineEvent])
def timeline(complaint_id: str, analysis: Analysis, options: Options):
    trail = analysis.trace(TraceRequest(complaint_id=complaint_id, **options.model_dump()))
    return analysis.timeline(trail)
