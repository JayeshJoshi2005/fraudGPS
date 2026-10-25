"""Paginated investigation reports from the shared, structured case summary."""

from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from threading import Lock
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    LongTable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    TableStyle,
)

from app.engines.explainer import format_date, format_inr
from app.models.reports import CaseSummary
from app.repository import Dataset

FONT_DIR = Path(__file__).resolve().parents[1] / "assets" / "fonts"
FONT_LOCK = Lock()
INK = colors.HexColor("#17243a")
BLUE = colors.HexColor("#235f99")
MUTED = colors.HexColor("#526078")
WIDTH = A4[0] - 84


def register_fonts():
    with FONT_LOCK:
        if "FraudSans" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("FraudSans", str(FONT_DIR / "DejaVuSans.ttf")))
            pdfmetrics.registerFont(TTFont("FraudSans-Bold", str(FONT_DIR / "DejaVuSans-Bold.ttf")))
            pdfmetrics.registerFontFamily("FraudSans", normal="FraudSans", bold="FraudSans-Bold")


def render_report(
    summary: CaseSummary, dataset: Dataset, generated_at: datetime | None = None
) -> bytes:
    register_fonts()
    generated_at = generated_at or datetime.now(UTC)
    styles = {
        "body": ParagraphStyle(
            "Body",
            fontName="FraudSans",
            fontSize=9,
            leading=14,
            textColor=INK,
            spaceAfter=8,
            splitLongWords=True,
        ),
        "small": ParagraphStyle(
            "Small",
            fontName="FraudSans",
            fontSize=7.5,
            leading=11,
            textColor=MUTED,
            spaceAfter=5,
            splitLongWords=True,
        ),
        "heading": ParagraphStyle(
            "Heading",
            fontName="FraudSans-Bold",
            fontSize=19,
            leading=25,
            textColor=INK,
            spaceAfter=18,
            keepWithNext=True,
        ),
        "sub": ParagraphStyle(
            "Sub",
            fontName="FraudSans-Bold",
            fontSize=11,
            leading=16,
            textColor=BLUE,
            spaceBefore=10,
            spaceAfter=8,
            keepWithNext=True,
        ),
        "cover": ParagraphStyle(
            "Cover",
            fontName="FraudSans-Bold",
            fontSize=27,
            leading=37,
            textColor=INK,
            spaceAfter=22,
        ),
        "th": ParagraphStyle(
            "TableHead",
            fontName="FraudSans-Bold",
            fontSize=8,
            leading=11,
            textColor=colors.white,
            splitLongWords=True,
        ),
    }
    story = []

    def p(value, style="body"):
        # Source text is data, never ReportLab's inline markup.
        clean = "".join(c for c in str(value) if c in "\n\t" or ord(c) >= 32)
        return Paragraph(escape(clean).replace("\n", "<br/>"), styles[style])

    def text(value, style="body"):
        story.append(p(value, style))

    def section(number, title):
        story.extend([PageBreak(), p(f"{number:02}  {title}", "heading")])

    def table(headers, rows, widths):
        if not rows:
            text("No records meet the selected criteria.")
            return
        data = [[p(value, "th") for value in headers]] + [
            [p(value, "small") for value in row] for row in rows
        ]
        grid = LongTable(
            data,
            colWidths=widths,
            repeatRows=1,
            splitByRow=1,
            splitInRow=1,
            hAlign="LEFT",
            spaceAfter=14,
        )
        grid.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), BLUE),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#f3f6fa")],
                    ),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd4e0")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 7),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(grid)

    complaint, trace, dna = summary.complaint, summary.trace, summary.dna
    account = dataset.accounts_by_id
    victim = account[complaint.victim_account]
    text("CONFIDENTIAL · SYNTHETIC DEMONSTRATION", "sub")
    story.append(Spacer(1, 72))
    text("FRAUD INVESTIGATION\nREPORT", "cover")
    text("Fraud GPS — Cyber Crime Investigation Platform", "sub")
    text("Powered by Fraud DNA")
    story.append(Spacer(1, 34))
    table(
        ["Case", "Report scope"],
        [
            [
                complaint.complaint_id,
                f"Generated {format_date(generated_at)}\n"
                f"Depth {trace.options.max_depth}; minimum {format_inr(trace.options.min_amount)}; "
                f"forwarding window {trace.options.forwarding_window_hours} hours",
            ]
        ],
        [155, WIDTH - 155],
    )
    text(
        "Six sections: complaint, money trail, suspicious accounts, Fraud DNA, and "
        "recommendations follow this cover. Long sections continue onto additional pages."
    )
    text(
        f"Dataset version: {summary.dataset_version}\nSummary method: {summary.method_version}",
        "small",
    )
    text(
        "Investigation hypothesis from synthetic source records. This report does not "
        "establish guilt, ownership, fund recovery, or an executed restriction.",
        "small",
    )

    section(2, "Complaint summary")
    table(
        ["Field", "Source record"],
        [
            ["Complaint ID", complaint.complaint_id],
            ["Victim", complaint.victim_name],
            ["Victim account", f"{victim.masked_account} ({victim.account_id})"],
            ["Bank", complaint.victim_bank],
            ["Reported loss", format_inr(complaint.amount_lost)],
            ["Scam type", complaint.scam_type],
            ["Complaint date", complaint.complaint_date.isoformat()],
            ["Status", complaint.status],
            ["Initial transaction", complaint.initial_tx_id],
        ],
        [125, WIDTH - 125],
    )
    text("Complaint description", "sub")
    text(complaint.description)

    section(3, "Money trail summary")
    text(summary.narrative)
    table(
        ["Measure", "Observed result"],
        [
            ["Seeded funds (counted once)", format_inr(trace.metrics.seed_amount)],
            [
                "Accounts / transfers",
                f"{trace.metrics.account_count} / {trace.metrics.transaction_count}",
            ],
            [
                "Split events / deepest layer",
                f"{sum(d.type == 'split' for d in trace.detections)} / "
                f"{trace.metrics.max_depth_reached} hops",
            ],
            ["Layering detections", str(sum(d.type == "layering" for d in trace.detections))],
            ["Probable endpoints", str(len(trace.statistics.probable_endpoint_account_ids))],
            ["Withdrawal method", "Unknown"],
            ["Tracked retained balance", format_inr(trace.metrics.retained_amount)],
            ["Stopped at limits / filters", format_inr(trace.metrics.stopped_amount)],
            ["Repeated hop volume", f"{format_inr(trace.metrics.hop_volume)} (not unique funds)"],
        ],
        [210, WIDTH - 210],
    )
    for warning in trace.warnings:
        text(warning, "small")
    text("Chronological transfer path", "sub")
    text(
        "Original transfer amount and FIFO-attributed amount are shown separately. "
        "Internal account IDs disambiguate repeated masked labels.",
        "small",
    )
    table(
        [
            "#",
            "Transaction / accounts",
            "Original INR",
            "Attributed INR",
            "Observed time",
            "Channel",
        ],
        [
            [
                str(i),
                f"{step.tx_id}\n{account[step.from_account].masked_account} ({step.from_account})"
                f"\n→ {account[step.to_account].masked_account} ({step.to_account})",
                format_inr(step.amount),
                format_inr(step.attributed_amount),
                format_date(step.timestamp),
                step.channel,
            ]
            for i, step in enumerate(trace.steps, 1)
        ],
        [22, 160, 79, 79, 105, WIDTH - 445],
    )
    text(
        "Narrative transaction references: "
        + (", ".join(summary.narrative_transaction_ids) or "None"),
        "small",
    )

    section(4, "Suspicious accounts")
    text(
        "Selected-trail accounts with dataset-wide risk ≥0.50, excluding the victim. "
        "Roles below use this report's trace options; scores and risk evidence "
        "use the full dataset."
    )
    table(
        ["Account / bank", "Risk", "Trail role", "Other cases", "Key indicators"],
        [
            [
                f"{item.label}\n{item.account_id}\n{item.bank_name}",
                f"{item.risk.total_score:.2f}",
                item.trail_role.role,
                str(len(item.other_complaint_ids)),
                "\n".join(item.risk.reasons[:2]),
            ]
            for item in summary.flagged_accounts
        ],
        [105, 40, 70, 55, WIDTH - 270],
    )
    text("Top five account assessments", "sub")
    for item in summary.flagged_accounts[:5]:
        text(f"{item.label} · {item.account_id} · Risk {item.risk.total_score:.2f}", "sub")
        text(
            f"Trail role: {item.trail_role.role} (confidence {item.trail_role.confidence:.2f}); "
            f"dataset-wide role: {item.risk.role}. Source account location: {item.location}."
        )
        table(
            ["Risk component", "Score", "Weight"],
            [
                [name.title(), f"{value:.3f}", f"{item.risk.weights[name]:.0%}"]
                for name, value in item.risk.component_scores.items()
            ],
            [WIDTH - 150, 75, 75],
        )
        for evidence in item.risk.evidence:
            text(f"{evidence.code}: {evidence.description}", "small")
            refs = [*evidence.transaction_ids, *evidence.entity_ids, *evidence.complaint_ids]
            if refs:
                text("Dataset evidence: " + ", ".join(refs), "small")
        text("Selected-trail references: " + ", ".join(item.transaction_ids), "small")
        text("Other linked complaints: " + (", ".join(item.other_complaint_ids) or "None"), "small")

    section(5, "Fraud DNA analysis")
    text(
        f"Closest other case: {dna.best_match_complaint_id or 'Not available'}; "
        f"signature match {dna.signature_score:.1%}. "
        "Matching strength is not a probability of guilt."
    )
    table(
        ["Component", "Similarity", "Weight"],
        [
            [name.title(), f"{value:.1%}", f"{dna.weights[name]:.0%}"]
            for name, value in dna.component_scores.model_dump().items()
        ],
        [WIDTH - 170, 85, 85],
    )
    if dna.campaign:
        family = dna.campaign
        text(f"Inferred family: {family.campaign_name}", "sub")
        text(
            f"{family.case_count} cases; reported losses {format_inr(family.total_loss)}, "
            f"counting each complaint once. Family ID: {family.campaign_id}."
        )
        text("Family members: " + ", ".join(family.complaint_ids), "small")
    else:
        text("No inferred campaign family at the current thresholds.")
    fingerprint = dna.behavioral_dna.fingerprint
    text("Behavioral signature", "sub")
    table(
        ["Feature", "Observed value"],
        [
            [
                "Average transfer",
                format_inr(fingerprint.avg_transaction_amount)
                if fingerprint.avg_transaction_amount is not None
                else "Not observed",
            ],
            [
                "Average forwarding",
                f"{fingerprint.avg_time_to_forward_minutes:.2f} minutes"
                if fingerprint.avg_time_to_forward_minutes is not None
                else "Not observed",
            ],
            ["Split ratio", f"{fingerprint.split_ratio:.3f}"],
            ["Observed depth", f"{fingerprint.num_hops} hops"],
            [
                "Active hours (IST)",
                ", ".join(f"{hour:02}:00" for hour in fingerprint.operating_hours.active_hours)
                or "Not observed",
            ],
            [
                "Channels",
                ", ".join(
                    f"{name}: {value:.1%}" for name, value in fingerprint.channel_histogram.items()
                )
                or "Not observed",
            ],
            [
                "Observed dormancy",
                f"{fingerprint.dormancy_days:.2f} days"
                if fingerprint.dormancy_days is not None
                else "Not observed",
            ],
            ["Withdrawal method", "Unknown"],
            ["Topology", dna.network_dna.topology_type],
        ],
        [170, WIDTH - 170],
    )
    text("Shared source identifiers", "sub")
    text(
        f"{dna.entity_dna.total_entity_overlaps} shared identifier records; "
        f"{dna.entity_dna.unique_linked_complaints} other cases. "
        "Identifiers are not money transfers."
    )
    table(
        ["Identifier (masked)", "Current accounts", "Other accounts", "Other cases"],
        [
            [
                f"{item.entity_type}\n{item.masked_value}\n{item.entity_id}",
                ", ".join(item.matched_account_ids),
                ", ".join(item.shared_with_accounts),
                str(len(item.shared_with_complaints)),
            ]
            for item in dna.entity_dna.entity_matches
        ],
        [155, 120, 175, WIDTH - 450],
    )
    text(
        "Identifier-linked cases: " + (", ".join(dna.entity_dna.linked_complaint_ids) or "None"),
        "small",
    )
    text("Similar cases", "sub")
    table(
        ["Case", "Match", "Entity / behavior / network", "Reported loss"],
        [
            [
                item.complaint_id,
                f"{item.similarity:.1%}",
                f"{item.component_scores.entity:.1%} / "
                f"{item.component_scores.behavioral:.1%} / "
                f"{item.component_scores.network:.1%}",
                format_inr(item.amount_lost),
            ]
            for item in dna.similar_cases
        ],
        [105, 55, 230, WIDTH - 390],
    )

    section(6, "Recommended review actions")
    text(
        "Prioritized review checklist. No accounts are frozen, records requested, or agencies "
        "contacted by this application. Local checklist marks are not execution records."
    )
    if not summary.recommendations:
        text("No recommendations meet the evidence thresholds at these trace settings.")
    for i, action in enumerate(summary.recommendations, 1):
        text(f"{i}. [{action.priority}] {action.title}", "sub")
        text(action.rationale)
        refs = [
            *action.account_ids,
            *action.transaction_ids,
            *action.entity_ids,
            *action.complaint_ids,
        ]
        text(f"Action ID: {action.action_id}\nEvidence: " + (", ".join(refs) or "None"), "small")
    text("Interpretation and limitations", "sub")
    for limitation in summary.limitations:
        text("• " + limitation, "small")

    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        leftMargin=42,
        rightMargin=42,
        topMargin=66,
        bottomMargin=46,
        title=f"Fraud investigation {complaint.complaint_id}",
        author="Fraud GPS",
        pageCompression=1,
    )

    def frame(canvas, doc):
        canvas.saveState()
        canvas.setFont("FraudSans-Bold", 9)
        canvas.setFillColor(BLUE)
        canvas.drawString(42, A4[1] - 31, "FRAUD GPS  /  INVESTIGATION REPORT")
        canvas.setFont("FraudSans", 8)
        canvas.drawRightString(A4[0] - 42, A4[1] - 31, complaint.complaint_id)
        canvas.setStrokeColor(colors.HexColor("#cbd4e0"))
        canvas.line(42, A4[1] - 42, A4[0] - 42, A4[1] - 42)
        canvas.setFillColor(MUTED)
        canvas.setFont("FraudSans", 7)
        canvas.drawString(42, 24, f"CONFIDENTIAL · SYNTHETIC DATA · {summary.dataset_version[:16]}")
        canvas.drawRightString(A4[0] - 42, 24, f"Page {doc.page}")
        canvas.restoreState()

    document.build(story, onFirstPage=frame, onLaterPages=frame)
    return output.getvalue()
