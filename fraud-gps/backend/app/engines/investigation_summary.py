"""Deterministic review suggestions, never operational instructions or actions."""

from collections import defaultdict
from hashlib import sha256
from typing import TYPE_CHECKING

from app.models.analysis import TraceOptions, TraceRequest
from app.models.reports import CaseSummary, FlaggedAccount, RecommendedAction

if TYPE_CHECKING:
    from app.engines.service import AnalysisService


def build_case_summary(
    analysis: "AnalysisService", complaint_id: str, options: TraceOptions
) -> CaseSummary:
    complaint = analysis.complaint(complaint_id)
    trace = analysis.trace(TraceRequest(complaint_id=complaint_id, **options.model_dump()))
    dna = analysis.dna_report(complaint_id, options)
    account_ids = {trace.start_account} | {
        account for step in trace.steps for account in (step.from_account, step.to_account)
    }
    transactions = {
        account: sorted(
            step.tx_id for step in trace.steps if account in (step.from_account, step.to_account)
        )
        for account in account_ids
    }
    flagged = []
    for account_id in sorted(account_ids - {trace.start_account}):
        risk = analysis.risk.compute_risk_score(account_id)
        if risk.total_score < 0.5:
            continue
        account = analysis.graph.dataset.accounts_by_id[account_id]
        linked = set(analysis.account_detail(account_id).linked_complaint_ids) - {complaint_id}
        flagged.append(
            FlaggedAccount(
                account_id=account_id,
                label=account.masked_account,
                bank_name=account.bank_name,
                location=account.location,
                risk=risk,
                trail_role=trace.roles[account_id],
                other_complaint_ids=sorted(linked),
                transaction_ids=transactions[account_id],
            )
        )
    flagged.sort(key=lambda item: (-item.risk.total_score, item.account_id))
    actions: list[RecommendedAction] = []

    def add(kind, target, priority, title, rationale, **references):
        digest = sha256(f"{complaint_id}:{kind}:{target}".encode()).hexdigest()[:16]
        actions.append(
            RecommendedAction(
                action_id=f"action-{digest}",
                kind=kind,
                priority=priority,
                title=title,
                rationale=rationale,
                **references,
            )
        )

    for item in flagged:
        add(
            "freeze_review",
            item.account_id,
            "High" if item.risk.total_score >= 0.7 else "Medium",
            f"Review freeze request: {item.label} ({item.account_id})",
            f"Dataset-wide risk {item.risk.total_score:.2f}; selected-trail role "
            f"{item.trail_role.role}; {len(item.other_complaint_ids)} other complaint links. "
            "Verify the referenced transfers and bank records before proposing a restriction.",
            account_ids=[item.account_id],
            transaction_ids=item.transaction_ids,
            complaint_ids=item.other_complaint_ids,
        )
    for entity in dna.entity_dna.entity_matches:
        subjects = set(entity.matched_account_ids) & (account_ids - {trace.start_account})
        linked = subjects | set(entity.shared_with_accounts)
        if entity.entity_type != "phone" or not subjects or len(linked) < 2:
            continue
        add(
            "telecom_records",
            entity.entity_id,
            "Medium",
            f"Review telecom-record request: {entity.masked_value}",
            f"The source phone identifier links {len(linked)} accounts. "
            "Review subscriber and call-detail record (CDR) requests "
            "through the applicable process.",
            account_ids=sorted(linked),
            entity_ids=[entity.entity_id],
            transaction_ids=sorted({tx for account in subjects for tx in transactions[account]}),
            complaint_ids=entity.shared_with_complaints,
        )
    locations: dict[str, list[str]] = defaultdict(list)
    for account_id in trace.statistics.probable_endpoint_account_ids:
        location = analysis.graph.dataset.accounts_by_id[account_id].location.strip()
        if location:
            locations[location].append(account_id)
    for location, endpoints in sorted(locations.items()):
        add(
            "coordinate",
            location,
            "Medium",
            f"Coordinate endpoint verification: {location}",
            f"{len(endpoints)} probable endpoint account(s) have this source-listed location. "
            "Confirm the appropriate jurisdiction and verify endpoint activity. "
            "An account address does not establish a withdrawal location or method.",
            account_ids=sorted(endpoints),
            transaction_ids=sorted({tx for account in endpoints for tx in transactions[account]}),
        )
    for other in dna.similar_cases:
        if other.similarity < 0.65 and not other.shared_entity_ids:
            continue
        add(
            "link_case",
            other.complaint_id,
            "Info",
            f"Compare linked case {other.complaint_id}",
            f"Signature similarity {other.similarity:.1%}; "
            f"{len(other.shared_entity_ids)} shared source identifiers. "
            "Compare the cited records; pattern similarity alone "
            "does not establish common control.",
            entity_ids=other.shared_entity_ids,
            complaint_ids=[other.complaint_id],
        )
    priority = {"High": 0, "Medium": 1, "Info": 2}
    actions.sort(key=lambda action: priority[action.priority])
    return CaseSummary(
        dataset_version=trace.dataset_version,
        complaint=complaint,
        trace=trace,
        dna=dna,
        narrative=trace.summary,
        narrative_transaction_ids=trace.summary_transaction_ids,
        flagged_accounts=flagged,
        recommendations=actions,
        limitations=list(
            dict.fromkeys(
                [
                    "Synthetic records only. Recommendations are review suggestions; "
                    "no action is sent.",
                    "Risk scores use dataset-wide evidence; trail roles use "
                    "the selected trace options.",
                    "Probable endpoints do not prove a withdrawal. Withdrawal method is unknown.",
                    "Locations are source account addresses, not verified cash-out locations.",
                    *trace.warnings,
                    *dna.limitations,
                ]
            )
        ),
    )
