"""Source-derived Fraud DNA. Keep calculations in engines."""

from fastapi import APIRouter

from app.models.dna import CampaignList, DNAReport, EntityDNA
from app.routes.dependencies import Analysis, Options

router = APIRouter(prefix="/api/dna", tags=["dna"])


@router.get("/campaigns", response_model=CampaignList)
def campaigns(analysis: Analysis, options: Options):
    return analysis.dna.campaigns(options)


@router.get("/entity/{account_id}", response_model=EntityDNA)
def entity_dna(account_id: str, analysis: Analysis, options: Options):
    analysis.graph.require_account(account_id)
    return analysis.dna.compute_entity_dna(account_id, options)


@router.get("/{complaint_id}", response_model=DNAReport)
def fraud_dna(complaint_id: str, analysis: Analysis, options: Options):
    return analysis.dna_report(complaint_id, options)
