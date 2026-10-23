"""Independent source fixtures verify inference, not prepared demo labels."""

import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.engines.fraud_dna import WEIGHTS, mask_entity
from app.engines.service import AnalysisService
from app.main import create_app
from app.models.analysis import TraceOptions
from app.repository import load_dataset

BASE = datetime(2026, 1, 1, tzinfo=UTC)
CASE_A, CASE_B = "BH-2026-8001", "BH-2026-8002"


def aid(number):
    return f"ACC-{800000 + number:06}"


@pytest.fixture
def make_data(tmp_path):
    counter = 0

    def make(transfers=None, entities=None, cases=None):
        nonlocal counter
        counter += 1
        directory = tmp_path / str(counter)
        directory.mkdir()
        transfers = (
            transfers
            if transfers is not None
            else [
                ("a-seed", 1, 2, "100.00", 0),
                ("a-next", 2, 3, "100.00", 5),
                ("b-seed", 4, 5, "100.00", 20),
                ("b-next", 5, 6, "100.00", 25),
            ]
        )
        entities = (
            entities
            if entities is not None
            else [
                ("shared", "device_id", "synthetic-shared-device", [2, 5]),
                ("a-only", "email", "synthetic-a@example.invalid", [3]),
                ("b-only", "email", "synthetic-b@example.invalid", [6]),
            ]
        )
        cases = cases if cases is not None else [(CASE_A, "a-seed"), (CASE_B, "b-seed")]
        accounts = [
            dict(
                account_id=aid(i),
                masked_account="XXXX1234",
                holder_name=f"Synthetic Neha {i}",
                bank_name="Synthetic Bank",
                ifsc_code="TEST0000001",
                account_type="Savings",
                account_age_days=90,
                age_as_of="2026-01-01",
                kyc_status="Full KYC",
                phone=f"+91-90000000{i:02}",
                location="Patna",
            )
            for i in range(1, 21)
        ]
        transactions = [
            dict(
                tx_id=txid,
                from_account=aid(source),
                to_account=aid(target),
                amount=str(amount),
                timestamp=(BASE + timedelta(minutes=minute)).isoformat(),
                channel="UPI",
                remarks="Independent synthetic test transfer",
                status="Success",
            )
            for txid, source, target, amount, minute in transfers
        ]
        transactions.append(
            dict(
                tx_id="horizon",
                from_account=aid(19),
                to_account=aid(20),
                amount="1",
                timestamp=(BASE + timedelta(days=100)).isoformat(),
                channel="NEFT",
                remarks="Independent horizon",
                status="Success",
            )
        )
        index = {tx["tx_id"]: tx for tx in transactions}
        complaints = []
        for cid, initial in cases:
            tx = index[initial]
            account = next(a for a in accounts if a["account_id"] == tx["from_account"])
            complaints.append(
                dict(
                    complaint_id=cid,
                    victim_name=account["holder_name"],
                    victim_account=account["account_id"],
                    victim_bank=account["bank_name"],
                    suspect_account=tx["to_account"],
                    amount_lost=tx["amount"],
                    scam_type="OTP Fraud",
                    complaint_date=tx["timestamp"][:10],
                    description="Independent synthetic complaint evidence.",
                    status="Pending",
                    initial_tx_id=initial,
                )
            )
        records = dict(
            accounts=accounts,
            transactions=transactions,
            complaints=complaints,
            entities=[
                dict(
                    entity_id=eid,
                    entity_type=kind,
                    entity_value=value,
                    linked_accounts=[aid(i) for i in numbers],
                )
                for eid, kind, value, numbers in entities
            ],
        )
        for name, values in records.items():
            (directory / f"{name}.json").write_text(json.dumps(values), encoding="utf-8")
        return directory

    return make


def service(directory):
    return AnalysisService(load_dataset(directory))


def test_exact_components_symmetry_and_same_pair_composite(make_data):
    analysis = service(make_data())
    a = analysis.dna_report(CASE_A, TraceOptions())
    b = analysis.dna_report(CASE_B, TraceOptions())
    assert a.best_match_complaint_id == CASE_B
    assert a.component_scores.entity == pytest.approx(1 / 3)
    assert a.component_scores.behavioral == pytest.approx(1)
    assert a.component_scores.network == pytest.approx(1)
    assert a.signature_score == pytest.approx(
        sum(WEIGHTS[key] * value for key, value in a.component_scores.model_dump().items())
    )
    assert a.signature_score == pytest.approx(b.signature_score)
    assert a.similar_cases[0].complaint_id == CASE_B
    assert a.similar_cases[0].behavioral_coverage == pytest.approx(0.94)
    assert a.entity_dna.linked_complaint_ids == [CASE_B]
    assert a.campaign.case_count == 2
    assert a.campaign.total_loss == Decimal("200.00")
    assert all(cid != CASE_A for cid in a.entity_dna.linked_complaint_ids)


def test_no_identifier_evidence_is_zero_and_cannot_form_family(make_data):
    analysis = service(make_data(entities=[]))
    report = analysis.dna_report(CASE_A, TraceOptions())
    assert report.component_scores.entity == 0
    assert report.signature_score == pytest.approx(0.60)
    assert report.campaign is None
    assert analysis.dna.campaigns().items == []
    assert report.entity_dna.entity_matches == []
    assert report.link_graph.edges == []


def test_entity_links_mask_values_preserve_ids_and_have_no_money(make_data):
    report = service(make_data()).dna_report(CASE_A, TraceOptions())
    match = next(m for m in report.entity_dna.entity_matches if m.entity_id == "shared")
    assert match.masked_value != "synthetic-shared-device"
    assert match.matched_account_ids == [aid(2)]
    assert match.shared_with_accounts == [aid(5)]
    assert match.shared_with_complaints == [CASE_B]
    assert len(report.link_graph.edges) == 1
    edge = report.link_graph.edges[0].data
    assert edge.kind == "entity_link"
    assert (edge.source, edge.target) == (aid(2), aid(5))
    assert edge.entity_ids == ["shared"]
    assert not {"amount", "timestamp", "channel", "attributed_amount"} & edge.model_dump().keys()
    # Colliding display masks must never merge account identities.
    assert {n.data.id for n in report.link_graph.nodes} == {aid(2), aid(5)}


def test_unknown_forwarding_dormancy_and_cashout_are_not_invented(make_data):
    analysis = service(make_data())
    report = analysis.dna_report(CASE_A, TraceOptions(max_depth=1))
    fp = report.behavioral_dna.fingerprint
    assert fp.avg_time_to_forward_minutes is None
    assert fp.dormancy_days is None
    assert fp.dormancy_sample_accounts == 0
    assert fp.cashout_method == "unknown"
    assert report.similar_cases[0].behavioral_coverage == pytest.approx(0.76)


def test_empty_and_singleton_reports_exclude_self(make_data):
    analysis = service(make_data(cases=[(CASE_A, "a-seed")]))
    report = analysis.dna_report(CASE_A, TraceOptions())
    assert report.signature_score == 0
    assert report.best_match_complaint_id is None
    assert report.similar_cases == []
    assert report.campaign is None
    empty = analysis.dna_report(CASE_A, TraceOptions(min_amount="1000"))
    assert empty.behavioral_dna.fingerprint.avg_transaction_amount is None
    assert empty.entity_dna.scope_account_ids == []
    assert empty.network_dna.topology_type == "empty"
    assert empty.signature_score == 0


def test_midnight_hours_exact_mean_and_observed_dormancy(make_data):
    directory = make_data(
        transfers=[
            ("old", 18, 2, "1", 1100 - 45 * 1440),
            ("a-seed", 1, 2, "1000.01", 1100),  # 23:50 IST
            ("left", 2, 3, "500.00", 1120),  # 00:10 IST
            ("right", 2, 7, "500.01", 1121),
        ],
        cases=[(CASE_A, "a-seed")],
        entities=[],
    )
    fp = service(directory).dna.compute_behavioral_dna(CASE_A).fingerprint
    assert fp.operating_hours.active_hours == [0, 23]
    assert (fp.operating_hours.start_hour, fp.operating_hours.end_hour) == (23, 1)
    assert fp.operating_hours.wraps_midnight
    assert sum(fp.operating_hours.histogram) == pytest.approx(1)
    assert fp.avg_transaction_amount == Decimal("666.67")
    assert fp.split_ratio == 2
    assert fp.dormancy_days == 45
    assert fp.dormancy_sample_accounts == 1
    assert fp.avg_time_to_forward_minutes == pytest.approx((500 * 20 + 500.01 * 21) / 1000.01)


def test_parallel_transfers_are_not_extra_topological_neighbors(make_data):
    directory = make_data(
        transfers=[("a-seed", 1, 2, 1000, 0), ("one", 2, 3, 500, 1), ("two", 2, 3, 500, 2)],
        cases=[(CASE_A, "a-seed")],
        entities=[],
    )
    network = service(directory).dna.compute_network_dna(CASE_A).topology_features
    assert network.edge_count == 2
    assert network.unique_edge_count == 1
    assert network.max_degree == 1
    assert network.avg_degree == 1
    assert network.topology_type == "chain"


def test_dataset_and_option_cache_isolation_and_copy_safety(make_data):
    first = service(make_data())
    second = service(make_data(entities=[]))
    options = TraceOptions()
    report = first.dna_report(CASE_A, options)
    score = report.signature_score
    report.behavioral_dna.fingerprint.avg_transaction_amount = Decimal("0")
    report.campaign.complaint_ids.clear()
    fresh = first.dna_report(CASE_A, TraceOptions(min_amount="100.000"))
    assert fresh.behavioral_dna.fingerprint.avg_transaction_amount == Decimal("100")
    assert fresh.campaign.case_count == len(fresh.campaign.complaint_ids) == 2
    assert fresh.signature_score == score
    changed = second.dna_report(CASE_A, options)
    assert changed.dataset_version != fresh.dataset_version
    assert changed.signature_score != fresh.signature_score
    assert first.dna_report(CASE_A, TraceOptions(min_amount="101")).signature_score == 0
    assert first.dna_report(CASE_A, options).signature_score == score


@pytest.mark.parametrize(
    "kind,value",
    [
        ("phone", "+91-9000000012"),
        ("device_id", "ABCD-device"),
        ("upi_id", "synthetic@bank"),
        ("email", "test@example.invalid"),
        ("ip_address", "192.0.2.1"),
        ("ip_address", "2001:db8::1"),
        ("device_id", "ab"),
    ],
)
def test_identifier_display_is_masked(kind, value):
    assert mask_entity(kind, value) != value
    assert "*" in mask_entity(kind, value)


def test_demo_expected_overlap_independence_and_bounds(generated_dir):
    analysis = service(generated_dir)
    gamma = analysis.dna_report("BH-2026-0001", TraceOptions())
    delta = analysis.dna_report("BH-2026-0031", TraceOptions())
    lone = analysis.dna_report("BH-2026-0047", TraceOptions())
    assert [item.case_count for item in analysis.dna.campaigns().items] == [30, 16, 4]
    assert "BH-2026-0031" in gamma.entity_dna.linked_complaint_ids
    assert "BH-2026-0001" in delta.entity_dna.linked_complaint_ids
    assert set(lone.entity_dna.linked_complaint_ids) <= {
        "BH-2026-0048",
        "BH-2026-0049",
        "BH-2026-0050",
    }
    assert lone.link_graph.edges == []
    for a, b in analysis.dna._context(TraceOptions()).pairs:
        pair = analysis.dna._context(TraceOptions()).pairs[a, b]
        assert 0 <= pair.similarity <= 1
        assert pair.similarity == pytest.approx(
            sum(WEIGHTS[k] * v for k, v in pair.components.model_dump().items())
        )
    for campaign in analysis.dna.campaigns().items:
        assert campaign.total_loss == sum(
            analysis.graph.complaints[cid].amount_lost for cid in campaign.complaint_ids
        )


def test_api_routes_filters_missing_and_empty(make_data):
    with TestClient(create_app(Settings(make_data(), ("http://localhost:3000",)))) as client:
        campaigns = client.get("/api/dna/campaigns")
        assert campaigns.status_code == 200
        assert campaigns.json()["items"][0]["case_count"] == 2
        response = client.get(f"/api/dna/{CASE_A}")
        assert response.status_code == 200
        data = response.json()
        assert data["dataset_version"] == client.get("/health").json()["dataset_version"]
        assert data["best_match_complaint_id"] == CASE_B
        assert client.get(f"/api/dna/entity/{aid(2)}").status_code == 200
        assert client.get(f"/api/dna/entity/{aid(19)}").json()["entity_matches"] == []
        assert client.get("/api/dna/BH-2026-9999").status_code == 404
        assert client.get("/api/dna/entity/ACC-999999").status_code == 404
        assert client.get(f"/api/dna/{CASE_A}?max_depth=8").status_code == 422
        assert client.get("/api/dna/campaigns?min_amount=-1").status_code == 422
        empty = client.get(f"/api/dna/{CASE_A}?min_amount=1000").json()
        assert empty["signature_score"] == 0
        assert empty["entity_dna"]["entity_matches"] == []
        assert empty["similar_cases"] == []


def test_empty_complaint_collection_has_no_campaigns(make_data):
    analysis = service(make_data(transfers=[], entities=[], cases=[]))
    assert analysis.dna.campaigns().items == []


def test_campaign_transitivity_does_not_invent_pairwise_entity_evidence(make_data):
    directory = make_data(
        transfers=[
            ("a-seed", 1, 2, 100, 0),
            ("a-next", 2, 3, 100, 5),
            ("b-seed", 4, 5, 100, 20),
            ("b-next", 5, 6, 100, 25),
            ("c-seed", 7, 8, 100, 40),
            ("c-next", 8, 9, 100, 45),
        ],
        entities=[
            ("ab", "device_id", "synthetic-ab-device", [2, 5]),
            ("bc", "phone", "synthetic-bc-phone", [5, 8]),
        ],
        cases=[(CASE_A, "a-seed"), (CASE_B, "b-seed"), ("BH-2026-8003", "c-seed")],
    )
    dna = service(directory).dna
    families = dna.campaigns().items
    assert len(families) == 1
    assert families[0].case_count == 3
    report = dna.compute_fraud_dna(CASE_A)
    assert "BH-2026-8003" not in report.entity_dna.linked_complaint_ids
    assert (
        next(
            row for row in report.similar_cases if row.complaint_id == "BH-2026-8003"
        ).component_scores.entity
        == 0
    )


def test_victim_only_entities_do_not_create_operation_matches(make_data):
    analysis = service(
        make_data(entities=[("victims", "phone", "synthetic-victim-shared", [1, 4])])
    )
    report = analysis.dna.compute_fraud_dna(CASE_A)
    assert report.entity_dna.entity_matches == []
    assert report.component_scores.entity == 0
    assert report.campaign is None
    assert analysis.dna.compute_entity_dna(aid(1)).linked_complaint_ids == [CASE_A, CASE_B]


def test_relation_graph_is_bounded_without_losing_identifier_evidence(make_data):
    entities = [
        (f"entity-{i:03}", "device_id", f"synthetic-device-{i:03}", [2, 5]) for i in range(110)
    ]
    report = service(make_data(entities=entities)).dna.compute_fraud_dna(CASE_A)
    assert report.entity_dna.total_entity_overlaps == 110
    assert report.link_graph.total_link_count == 110
    assert report.link_graph.truncated
    assert len(report.link_graph.edges) == 100
    assert len({edge.data.id for edge in report.link_graph.edges}) == 100
