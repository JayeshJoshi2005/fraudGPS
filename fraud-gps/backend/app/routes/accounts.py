"""Source account details and measured statistics for the investigation inspector."""

from fastapi import APIRouter

from app.models.analysis import AccountDetail
from app.routes.dependencies import Analysis

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("/{account_id}", response_model=AccountDetail)
def account_detail(account_id: str, analysis: Analysis):
    return analysis.account_detail(account_id)
