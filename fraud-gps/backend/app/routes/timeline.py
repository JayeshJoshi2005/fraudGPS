"""Stable evidence-backed events for later playback."""

from fastapi import APIRouter, Response

from app.models.analysis import TimelineEvent, TraceRequest
from app.routes.dependencies import Analysis, Options

router = APIRouter(prefix="/api/timeline", tags=["timeline"])


@router.get("/{complaint_id}", response_model=list[TimelineEvent])
def timeline(complaint_id: str, response: Response, analysis: Analysis, options: Options):
    trail = analysis.trace(TraceRequest(complaint_id=complaint_id, **options.model_dump()))
    response.headers["X-Dataset-Version"] = trail.dataset_version
    return analysis.timeline(trail)
