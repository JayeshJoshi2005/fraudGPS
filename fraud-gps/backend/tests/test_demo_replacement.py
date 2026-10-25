"""A complete independent input set must work across the final report pipeline."""

from decimal import Decimal

from fastapi.testclient import TestClient
from replacement_data import write_fixture

from app.config import Settings
from app.main import create_app


def test_replacement_inputs_drive_trace_dna_summary_and_pdf(tmp_path):
    directory = write_fixture(tmp_path / "replacement")
    with TestClient(create_app(Settings(directory, ("http://localhost:3000",)))) as client:
        health = client.get("/health").json()
        assert health["counts"] == {
            "accounts": 6,
            "complaints": 2,
            "transactions": 4,
            "entities": 1,
        }
        case_id = "BH-2026-9901"
        trace = client.post("/api/trace", json={"complaint_id": case_id}).json()
        assert [row["tx_id"] for row in trace["steps"]] == [
            "replacement-a-seed",
            "replacement-a-forward",
        ]
        assert Decimal(trace["metrics"]["seed_amount"]) == Decimal("100001.35")
        dna = client.get(f"/api/dna/{case_id}").json()
        assert dna["dataset_version"] == health["dataset_version"]
        assert dna["similar_cases"][0]["complaint_id"] == "BH-2026-9902"
        note = client.get(f"/api/report/{case_id}/summary").json()
        assert note["trace"] == trace
        assert "replacement-a-seed" in note["narrative_transaction_ids"]
        report = client.post(
            f"/api/report/{case_id}", json={"expected_dataset_version": health["dataset_version"]}
        )
        assert report.status_code == 200
        assert report.content.startswith(b"%PDF-")
