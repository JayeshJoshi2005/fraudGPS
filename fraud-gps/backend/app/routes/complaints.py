"""Complaint selection and detail, required for Phase 2 investigation flows."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.models.analysis import ComplaintDetail, ComplaintList, TraceRequest
from app.routes.dependencies import Analysis, Options

router = APIRouter(prefix="/api/complaints", tags=["complaints"])


@router.get("", response_model=ComplaintList)
def complaints(
    analysis: Analysis,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
):
    records = sorted(analysis.graph.complaints.values(), key=lambda c: c.complaint_id)
    return ComplaintList(total=len(records), items=records[offset : offset + limit])


@router.get("/{complaint_id}", response_model=ComplaintDetail)
def detail(complaint_id: str, analysis: Analysis, options: Options):
    complaint = analysis.complaint(complaint_id)
    trail = analysis.trace(TraceRequest(complaint_id=complaint_id, **options.model_dump()))
    return ComplaintDetail(complaint=complaint, trace=trail)
