"""Verify source-derived actions and parse/render the actual downloadable PDFs."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from decimal import Decimal

import pymupdf
import pytest
from fastapi.testclient import TestClient
from test_dna import CASE_A, CASE_B, aid
from test_dna import make_data as make_data

from app.config import Settings
from app.engines.report_pdf import render_report
from app.engines.risk_scorer import risk_level
from app.engines.service import AnalysisService
from app.main import create_app
from app.models.analysis import TraceOptions, TraceRequest
from app.repository import load_dataset


def service(directory):
    return AnalysisService(load_dataset(directory))


def pdf_text(data):
    document = pymupdf.open(stream=data, filetype="pdf")
    return document, "\n".join(page.get_text() for page in document)


def test_summary_uses_exact_trace_and_dna_options(make_data):
    analysis = service(make_data())
    options = TraceOptions(max_depth=1, min_amount=Decimal("0.01"), forwarding_window_hours=2)
    summary = analysis.case_summary(CASE_A, options)
    expected = analysis.trace(TraceRequest(complaint_id=CASE_A, **options.model_dump()))
    assert summary.trace == expected
    assert summary.narrative == expected.summary
    assert summary.complaint.scam_type in summary.narrative
    assert summary.complaint.complaint_date.strftime("%d-%b-%Y") in summary.narrative
    assert expected.steps[0].channel in summary.narrative
    assert summary.narrative_transaction_ids == ["a-seed"]
    assert summary.dna.options == options
    assert summary.dataset_version == summary.dna.dataset_version == expected.dataset_version
    assert summary.trace.statistics.probable_endpoint_account_ids == []
    assert not any(action.kind == "coordinate" for action in summary.recommendations)


def test_freeze_review_thresholds_scope_order_and_stable_ids(make_data, monkeypatch):
    analysis = service(make_data())
    original = analysis.risk.compute_risk_score
    scores = {aid(1): 1, aid(2): 0.7, aid(3): 0.5, aid(5): 0.99}

    def measured(account):
        score = scores.get(account, 0.49)
        return original(account).model_copy(
            update={"total_score": score, "risk_level": risk_level(score)}
        )

    monkeypatch.setattr(analysis.risk, "compute_risk_score", measured)
    summary = analysis.case_summary(CASE_A, TraceOptions())
    assert [item.account_id for item in summary.flagged_accounts] == [aid(2), aid(3)]
    freezes = [action for action in summary.recommendations if action.kind == "freeze_review"]
    assert [action.priority for action in freezes] == ["High", "Medium"]
    assert {tuple(action.account_ids) for action in freezes} == {(aid(2),), (aid(3),)}
    assert all(CASE_A not in item.other_complaint_ids for item in summary.flagged_accounts)
    assert all(
        set(action.transaction_ids) <= {"a-seed", "a-next"} for action in summary.recommendations
    )
    assert [action.action_id for action in summary.recommendations] == [
        action.action_id for action in analysis.case_summary(CASE_A, TraceOptions()).recommendations
    ]


def test_phone_and_location_actions_use_source_references(make_data):
    analysis = service(make_data(entities=[("phone-shared", "phone", "+91-9000000002", [2, 5])]))
    summary = analysis.case_summary(CASE_A, TraceOptions())
    phone = next(action for action in summary.recommendations if action.kind == "telecom_records")
    assert phone.entity_ids == ["phone-shared"]
    assert phone.account_ids == [aid(2), aid(5)]
    assert "+91-9000000002" not in phone.title
    assert phone.complaint_ids == [CASE_B]
    coordinate = next(action for action in summary.recommendations if action.kind == "coordinate")
    assert coordinate.account_ids == [aid(3)]
    assert "Patna" in coordinate.title
    assert "withdrawal location or method" in coordinate.rationale
    assert "ATM" not in summary.model_dump_json()
    assert "Cyber Cell" not in coordinate.title


def test_pattern_only_cases_below_threshold_are_not_recommended(make_data):
    analysis = service(make_data(entities=[]))
    summary = analysis.case_summary(CASE_A, TraceOptions())
    assert summary.dna.similar_cases[0].similarity == pytest.approx(0.6)
    assert not any(action.kind == "link_case" for action in summary.recommendations)


def test_empty_trace_report_does_not_invent_funds_or_endpoints(make_data):
    analysis = service(make_data())
    summary = analysis.case_summary(CASE_A, TraceOptions(min_amount=Decimal("1000")))
    assert not summary.trace.steps
    assert not summary.flagged_accounts
    assert not summary.recommendations
    document, text = pdf_text(render_report(summary, analysis.graph.dataset))
    assert len(document) >= 6
    assert "No transfers meet the selected trace criteria" in text
    assert "₹0" in text
    assert "Withdrawal method" in text and "Unknown" in text


def test_pdf_has_all_sections_unicode_evidence_and_numbered_pages(make_data):
    analysis = service(make_data())
    summary = analysis.case_summary(CASE_A, TraceOptions())
    pdf = render_report(summary, analysis.graph.dataset, datetime(2026, 10, 25, tzinfo=UTC))
    assert pdf.startswith(b"%PDF-")
    document, text = pdf_text(pdf)
    titles = [
        "FRAUD INVESTIGATION",
        "Complaint summary",
        "Money trail summary",
        "Suspicious accounts",
        "Fraud DNA analysis",
        "Recommended review actions",
    ]
    offsets = [text.index(title) for title in titles]
    assert offsets == sorted(offsets)
    assert "25-Oct-2026" in text
    assert "₹100" in text
    assert "a-seed" in text and "a-next" in text
    assert "CONFIDENTIAL" in text
    assert "Withdrawal method" in text and "Unknown" in text
    for index, page in enumerate(document, 1):
        assert f"Page {index}" in page.get_text()
        assert CASE_A in page.get_text()
        assert any("DejaVuSans" in font[3] for font in page.get_fonts())


def test_long_trail_and_source_text_paginate_without_omitting_evidence(make_data):
    transfers = [("a-seed", 1, 2, "200.25", 0), ("b-seed", 4, 5, "100.00", 20)] + [
        (f"parallel-transfer-{i:04}", 2, 3, "1.25", (i + 1) / 10) for i in range(120)
    ]
    analysis = service(make_data(transfers=transfers))
    summary = analysis.case_summary(CASE_A, TraceOptions(min_amount=Decimal("0.01")))
    summary.complaint = summary.complaint.model_copy(
        update={"description": "<not-markup>& verified source text. " * 250}
    )
    document, text = pdf_text(render_report(summary, analysis.graph.dataset))
    assert len(summary.trace.steps) == 121
    assert len(document) > 8
    assert "<not-markup>&" in text
    assert "₹200.25" in text and "₹1.25" in text
    assert all(f"parallel-transfer-{i:04}" in text for i in range(120))
    assert " ".join(text.split()).count("Attributed INR") >= 3
    for page in document:
        for block in page.get_text("blocks"):
            assert block[0] >= 19 and block[1] >= 10
            assert block[2] <= page.rect.width - 19
            assert block[3] <= page.rect.height - 10


def test_concurrent_documents_keep_their_own_case_data(make_data):
    analysis = service(make_data())
    summaries = [analysis.case_summary(case, TraceOptions()) for case in (CASE_A, CASE_B)]
    with ThreadPoolExecutor(max_workers=2) as pool:
        pdfs = list(
            pool.map(lambda summary: render_report(summary, analysis.graph.dataset), summaries)
        )
    for summary, pdf in zip(summaries, pdfs, strict=True):
        document, _ = pdf_text(pdf)
        assert summary.complaint.complaint_id in document[0].get_text()
        assert summary.trace.steps[0].tx_id in "\n".join(page.get_text() for page in document)


def test_report_api_options_download_headers_version_and_errors(make_data):
    settings = Settings(data_dir=make_data(), cors_origins=("http://localhost:3000",))
    with TestClient(create_app(settings)) as client:
        content = client.get("/openapi.json").json()["paths"]["/api/report/{complaint_id}"]
        assert content["post"]["responses"]["200"]["content"] == {
            "application/pdf": {"schema": {"type": "string", "format": "binary"}}
        }
        response = client.get(f"/api/report/{CASE_A}/summary", params={"max_depth": 1})
        assert response.status_code == 200
        summary = response.json()
        assert summary["trace"]["options"]["max_depth"] == 1
        assert len(summary["trace"]["steps"]) == 1
        pdf = client.post(
            f"/api/report/{CASE_A}",
            json={"max_depth": 1, "expected_dataset_version": summary["dataset_version"]},
            headers={"Origin": "http://localhost:3000"},
        )
        assert pdf.status_code == 200
        assert pdf.headers["content-type"] == "application/pdf"
        assert CASE_A in pdf.headers["content-disposition"]
        assert "attachment" in pdf.headers["content-disposition"]
        assert pdf.headers["x-dataset-version"] == summary["dataset_version"]
        assert "Content-Disposition" in pdf.headers["access-control-expose-headers"]
        assert pdf.headers["cache-control"] == "no-store"
        assert pdf.content.startswith(b"%PDF-")
        assert (
            client.post(
                f"/api/report/{CASE_A}", json={"expected_dataset_version": "stale"}
            ).status_code
            == 409
        )
        assert client.post(f"/api/report/{CASE_A}", json={"max_depth": 0}).status_code == 422
        assert client.post(f"/api/report/{CASE_A}", json={"unexpected": 1}).status_code == 422
        assert client.get("/api/report/BH-2026-9999/summary").status_code == 404
        assert client.post("/api/report/BH-2026-9999").status_code == 404


def test_demo_summary_and_report_follow_user_depth(generated_dir):
    analysis = service(generated_dir)
    shallow = analysis.case_summary("BH-2026-0001", TraceOptions(max_depth=4))
    deep = analysis.case_summary("BH-2026-0001", TraceOptions(max_depth=5))
    assert shallow.trace.statistics.probable_endpoint_account_ids == []
    assert len(deep.trace.statistics.probable_endpoint_account_ids) == 4
    assert not any(action.kind == "coordinate" for action in shallow.recommendations)
    assert any(action.kind == "coordinate" for action in deep.recommendations)
    document, text = pdf_text(render_report(deep, analysis.graph.dataset))
    assert len(document) >= 6
    assert all(step.tx_id in text for step in deep.trace.steps)
    assert all(action.action_id in text for action in deep.recommendations)
