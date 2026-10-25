"""Factual display text from the same structured evidence returned by the API."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models.analysis import RiskResult, TraceResult
from app.models.schemas import Account, Complaint

IST = timezone(timedelta(hours=5, minutes=30), "Asia/Kolkata")


def format_inr(amount: Decimal) -> str:
    integer, fraction = f"{amount:.2f}".split(".")
    tail = integer[-3:]
    head = integer[:-3]
    groups = []
    while head:
        groups.insert(0, head[-2:])
        head = head[:-2]
    grouped = ",".join([*groups, tail])
    return f"₹{grouped}" + (f".{fraction}" if fraction != "00" else "")


def format_date(value: datetime) -> str:
    return value.astimezone(IST).strftime("%d-%b-%Y %H:%M IST")


def generate_explanation(account_id: str, risk_data: RiskResult) -> list[str]:
    if account_id != risk_data.account_id:
        raise ValueError("Risk evidence belongs to another account")
    return [
        evidence.description
        + (" [" + ", ".join(evidence.transaction_ids) + "]" if evidence.transaction_ids else "")
        for evidence in risk_data.evidence
    ]


def generate_case_summary(
    trail: TraceResult,
    complaint: Complaint | None = None,
    victim: Account | None = None,
    recipient: Account | None = None,
) -> str:
    metrics = trail.metrics
    if not trail.steps:
        return (
            "No transfers meet the selected trace criteria. "
            "No attributed funds or endpoints were found."
        )
    splits = sum(e.type == "split" for e in trail.detections)
    terminals = {a for e in trail.detections if e.type == "terminal" for a in e.account_ids}
    context = (
        f"In complaint {complaint.complaint_id}, dated "
        f"{complaint.complaint_date.strftime('%d-%b-%Y')}, {complaint.victim_name} "
        f"({victim.masked_account}, {victim.bank_name}) reported "
        f"{format_inr(complaint.amount_lost)} lost in a {complaint.scam_type} case. "
        if complaint is not None and victim is not None
        else ""
    )
    first = trail.steps[0]
    initial = (
        f"The initial recorded transfer sent {format_inr(first.amount)} via {first.channel} "
        f"to {recipient.masked_account} ({recipient.bank_name}). "
        if recipient is not None
        else ""
    )
    return (
        f"{context}{initial}From {format_date(first.timestamp)}, the FIFO trace seeded "
        f"{format_inr(metrics.seed_amount)} and reached {metrics.account_count} accounts "
        f"through {metrics.transaction_count} transfers. "
        f"It detected {splits} split events and {len(terminals)} probable endpoints; "
        "withdrawal methods are unknown. "
        "Tracked balances at their window/cutoff total "
        f"{format_inr(metrics.retained_amount)}, while "
        f"{format_inr(metrics.stopped_amount)} stopped at trace limits or filtered transfers. "
        f"Hop volume is {format_inr(metrics.hop_volume)} "
        "and counts money again at successive hops. "
        "This attribution is an investigative hypothesis, not proof of ownership or recovery."
    )
