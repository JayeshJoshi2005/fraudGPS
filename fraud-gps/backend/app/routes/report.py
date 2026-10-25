"""Shared investigation summary and downloadable PDF; rendering lives in engines."""

from fastapi import APIRouter, HTTPException, Response

from app.engines.report_pdf import render_report
from app.models.analysis import TraceOptions
from app.models.reports import CaseSummary, ReportRequest
from app.routes.dependencies import Analysis, Options

router = APIRouter(prefix="/api/report", tags=["report"])


@router.get("/{complaint_id}/summary", response_model=CaseSummary)
def case_summary(complaint_id: str, analysis: Analysis, options: Options):
    return analysis.case_summary(complaint_id, options)


@router.post(
    "/{complaint_id}",
    response_class=Response,
    responses={
        200: {"content": {"application/pdf": {"schema": {"type": "string", "format": "binary"}}}}
    },
)
def download_report(complaint_id: str, analysis: Analysis, request: ReportRequest | None = None):
    request = request or ReportRequest()
    version = analysis.graph.dataset.version
    if request.expected_dataset_version and request.expected_dataset_version != version:
        raise HTTPException(
            status_code=409, detail="The dataset changed. Reload the workspace and trace again."
        )
    options = TraceOptions(**request.model_dump(exclude={"expected_dataset_version"}))
    summary = analysis.case_summary(complaint_id, options)
    filename = f"FraudGPS-{summary.complaint.complaint_id}-Investigation.pdf"
    return Response(
        render_report(summary, analysis.graph.dataset),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Dataset-Version": version,
            "Cache-Control": "no-store",
        },
    )
