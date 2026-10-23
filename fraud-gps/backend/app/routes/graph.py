"""Cytoscape-compatible transaction graph endpoints."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.models.analysis import GraphResult, TraceRequest
from app.routes.dependencies import Analysis, Options

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/full", response_model=GraphResult)
def full_graph(analysis: Analysis):
    return analysis.serialize_graph()


@router.get("/subgraph/{account_id}", response_model=GraphResult)
def subgraph(account_id: str, analysis: Analysis, depth: Annotated[int, Query(ge=0, le=7)] = 3):
    return analysis.serialize_graph(analysis.graph.get_subgraph(account_id, depth).nodes)


@router.get("/trail/{complaint_id}", response_model=GraphResult)
def trail_graph(complaint_id: str, analysis: Analysis, options: Options):
    trail = analysis.trace(TraceRequest(complaint_id=complaint_id, **options.model_dump()))
    return analysis.serialize_graph(trail=trail)
