"""Independent miniature datasets exercise inference, not generator campaign labels."""

import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest

from app.engines.explainer import format_date, format_inr
from app.engines.fraud_gps import FraudGPS
from app.engines.graph_builder import GraphBuilder
from app.engines.risk_scorer import WEIGHTS, risk_level
from app.engines.service import AnalysisService
from app.models.analysis import TraceRequest
from app.repository import load_dataset

BASE = datetime(2026, 1, 1, tzinfo=UTC)
CASE = "BH-2026-9001"


def account_id(number):
    return f"ACC-{900000 + number:06}"


@pytest.fixture
def independent_dataset(tmp_path):
    def build(transfers, horizon=True, complaint=True, entities=()):
        accounts = [
            dict(
                account_id=account_id(i),
                masked_account=f"XXXX{i:04}",
                holder_name=f"Synthetic Person {i}",
                bank_name="Synthetic Bank",
                ifsc_code="TEST0000001",
                account_type="Savings",
                account_age_days=90,
                age_as_of="2026-01-01",
                kyc_status="Full KYC",
                phone=f"+91-90000000{i:02}",
                location="Patna",
            )
            for i in range(1, 11)
        ]
        transactions = [
            dict(
                tx_id=txid,
                from_account=account_id(source),
                to_account=account_id(target),
                amount=str(amount),
                timestamp=(BASE + timedelta(minutes=minute)).isoformat(),
                channel="UPI",
                remarks="Synthetic independent transfer",
                status="Success",
            )
            for txid, source, target, amount, minute in transfers
        ]
        if horizon:
            transactions.append(
                dict(
                    tx_id="observation",
                    from_account=account_id(9),
                    to_account=account_id(10),
                    amount="1.00",
                    timestamp=(BASE + timedelta(days=90)).isoformat(),
                    channel="NEFT",
                    remarks="Independent observation horizon",
                    status="Success",
                )
            )
        complaints = []
        if complaint and transactions:
            initial = next(t for t in transactions if t["tx_id"] == "seed")
            victim = next(a for a in accounts if a["account_id"] == initial["from_account"])
            complaints.append(
                dict(
                    complaint_id=CASE,
                    victim_name=victim["holder_name"],
                    victim_account=victim["account_id"],
                    victim_bank=victim["bank_name"],
                    suspect_account=initial["to_account"],
                    amount_lost=initial["amount"],
                    scam_type="OTP Fraud",
                    complaint_date="2026-01-01",
                    description="Independent synthetic complaint for algorithm verification.",
                    status="Pending",
                    initial_tx_id="seed",
                )
            )
        for name, records in dict(
            accounts=accounts,
            transactions=transactions,
            complaints=complaints,
            entities=list(entities),
        ).items():
            (tmp_path / f"{name}.json").write_text(json.dumps(records), encoding="utf-8")
        return load_dataset(tmp_path)

    return build


def trace(dataset, **options):
    return FraudGPS(GraphBuilder(dataset)).trace_money_trail(account_id(1), "seed", **options)


def assert_conserved(trail):
    assert trail.metrics.seed_amount == trail.metrics.retained_amount + trail.metrics.stopped_amount
    assert sum((b.amount for b in trail.balances), Decimal(0)) == trail.metrics.seed_amount
    steps = {s.tx_id: s for s in trail.steps}
    used = {}
    for step in trail.steps:
        assert 0 < step.attributed_amount <= step.amount
        assert sum(a.amount for a in step.allocations) == step.attributed_amount
        for allocation in step.allocations:
            assert len(allocation.path) == allocation.depth <= trail.options.max_depth
            for left, right in zip(allocation.path, allocation.path[1:], strict=False):
                assert steps[left].timestamp < steps[right].timestamp
            if allocation.parent_tx_id:
                used[allocation.parent_tx_id] = (
                    used.get(allocation.parent_tx_id, 0) + allocation.amount
                )
    assert all(amount <= steps[txid].attributed_amount for txid, amount in used.items())


def test_multigraph_preserves_parallel_transfers_and_entities(independent_dataset):
    entity = dict(
        entity_id="seed",
        entity_type="device_id",
        entity_value="synthetic-device",
        linked_accounts=[account_id(2), account_id(3)],
    )
    dataset = independent_dataset(
        [
            ("seed", 1, 2, 1000, 0),
            ("a", 2, 3, 300, 1),
            ("b", 2, 3, 500, 2),
        ],
        entities=[entity],
    )
    graph = GraphBuilder(dataset)
    assert graph.graph.number_of_edges(account_id(2), account_id(3)) == 2
    assert graph.get_node_data(account_id(2))["total_outflow"] == 800
    assert graph.get_neighbors(account_id(2)) == [account_id(1), account_id(3)]
    assert set(graph.get_subgraph(account_id(1), 1)) == {account_id(1), account_id(2)}
    assert len(graph.get_linked_complaints(account_id(2))) == 1
    assert graph.entity_graph.has_edge(("account", account_id(2)), ("entity", "seed"))
    assert "seed" not in graph.graph
    result = trace(dataset)
    assert [s.tx_id for s in result.steps] == ["seed", "a", "b"]
    assert not any(e.type == "split" for e in result.detections)
    assert_conserved(result)


def test_split_merge_cycle_and_amount_caps(independent_dataset):
    result = trace(
        independent_dataset(
            [
                ("seed", 1, 2, "1000.01", 0),
                ("left", 2, 3, 600, 1),
                ("right", 2, 4, "400.01", 2),
                ("join-left", 3, 5, 600, 3),
                ("join-right", 4, 5, "400.01", 4),
                ("merge", 5, 6, 2000, 5),
                ("cycle", 6, 2, 2000, 6),
                ("final", 2, 7, 2000, 7),
            ]
        ),
        max_depth=7,
    )
    assert_conserved(result)
    assert result.steps[-1].attributed_amount == Decimal("1000.01")
    assert len(result.steps) == 8
    assert {e.type for e in result.detections} >= {"split", "merge", "rapid_forward", "terminal"}
    merge = next(e for e in result.detections if e.type == "merge")
    assert merge.transaction_ids == ["join-left", "join-right", "merge"]
    assert merge.amount == Decimal("1000.01")


def test_chronology_ignores_earlier_and_equal_time_transfers(independent_dataset):
    result = trace(
        independent_dataset(
            [
                ("earlier", 2, 3, 1000, -1),
                ("seed", 1, 2, 1000, 0),
                ("z-equal", 2, 3, 1000, 0),
                ("later", 2, 4, 2000, 1),
            ]
        )
    )
    assert [s.tx_id for s in result.steps] == ["seed", "later"]
    assert result.steps[-1].attributed_amount == 1000
    assert_conserved(result)


def test_filtered_funds_cannot_be_reused(independent_dataset):
    result = trace(
        independent_dataset(
            [
                ("seed", 1, 2, 1000, 0),
                ("small", 2, 3, 50, 1),
                ("later", 2, 4, 1000, 2),
            ]
        )
    )
    assert result.steps[-1].attributed_amount == 950
    assert result.metrics.stopped_amount == 50
    assert any(b.reason == "min_amount" and b.amount == 50 for b in result.balances)
    assert_conserved(result)


@pytest.mark.parametrize("minutes,expected", [(60, 2), (61, 1)])
def test_forwarding_window_is_inclusive(independent_dataset, minutes, expected):
    result = trace(
        independent_dataset(
            [
                ("seed", 1, 2, 1000, 0),
                ("next", 2, 3, 1000, minutes),
            ]
        ),
        forwarding_window_hours=1,
    )
    assert len(result.steps) == expected
    assert_conserved(result)


def test_depth_limit_is_not_a_cashout(independent_dataset):
    result = trace(
        independent_dataset(
            [
                ("seed", 1, 2, 1000, 0),
                ("next", 2, 3, 1000, 1),
            ]
        ),
        max_depth=1,
    )
    assert len(result.steps) == 1
    assert result.metrics.stopped_amount == 1000
    assert result.metrics.probable_terminal_amount == 0
    assert_conserved(result)


def test_observation_cutoff_does_not_claim_terminal(independent_dataset):
    result = trace(independent_dataset([("seed", 1, 2, 1000, 0)], horizon=False))
    assert result.metrics.probable_terminal_amount == 0
    assert result.balances[0].reason == "observation_cutoff"


@pytest.mark.parametrize(
    "amount,minute,detected", [(800, 30, False), (801, 30, True), (900, 31, False)]
)
def test_rapid_forward_boundaries(independent_dataset, amount, minute, detected):
    result = trace(
        independent_dataset(
            [
                ("seed", 1, 2, 1000, 0),
                ("next", 2, 3, amount, minute),
            ]
        )
    )
    assert any(e.type == "rapid_forward" for e in result.detections) is detected


def test_layering_measures_decay_and_time(independent_dataset):
    result = trace(
        independent_dataset(
            [
                ("seed", 1, 2, 1000, 0),
                ("a", 2, 3, 950, 1),
                ("b", 3, 4, 900, 2),
                ("c", 4, 5, 850, 3),
            ]
        )
    )
    event = next(e for e in result.detections if e.type == "layering")
    assert Decimal(event.metrics["amount_decay"]) == 150
    assert event.metrics["elapsed_seconds"] == 180
    assert event.transaction_ids == ["seed", "a", "b", "c"]
    assert_conserved(result)


def test_empty_trace_and_invalid_anchor(independent_dataset):
    dataset = independent_dataset([("seed", 1, 2, 1000, 0)])
    result = trace(dataset, min_amount=Decimal("1001"))
    assert result.steps == []
    assert result.metrics.seed_amount == 0
    gps = FraudGPS(GraphBuilder(dataset))
    with pytest.raises(ValueError, match="originate"):
        gps.trace_money_trail(account_id(3), "seed")
    with pytest.raises(KeyError, match="transaction"):
        gps.trace_money_trail(account_id(1), "missing")


def test_account_mode_without_complaints_or_transactions(independent_dataset):
    service = AnalysisService(independent_dataset([], horizon=False, complaint=False))
    result = service.trace(TraceRequest(account_id=account_id(1)))
    assert result.steps == []
    assert service.risk.compute_risk_score(account_id(1)).total_score == 0
    assert "No transfers" in result.summary


def test_account_mode_seeds_each_outgoing_and_conserves(independent_dataset):
    dataset = independent_dataset(
        [
            ("seed", 1, 2, 1000, 0),
            ("second", 1, 3, 500, 1),
            ("a", 2, 4, 1000, 2),
            ("b", 3, 4, 500, 3),
            ("join", 4, 5, 2000, 4),
        ]
    )
    result = FraudGPS(GraphBuilder(dataset)).trace_money_trail(account_id(1))
    assert result.metrics.seed_amount == 1500
    assert result.steps[-1].attributed_amount == 1500
    assert_conserved(result)


def test_risk_components_evidence_entity_overlap_and_cache(independent_dataset):
    dataset = independent_dataset(
        [
            ("seed", 1, 2, 1000, 0),
            ("a", 2, 3, 600, 1),
            ("b", 2, 4, 400, 2),
        ],
        entities=[
            dict(
                entity_id="device",
                entity_type="device_id",
                entity_value="test",
                linked_accounts=[account_id(2), account_id(3)],
            )
        ],
    )
    service = AnalysisService(dataset)
    risk = service.risk.compute_risk_score(account_id(2))
    assert risk.role == "Splitter"
    assert risk.component_scores["complaints"] == 1
    assert risk.component_scores["entity"] == pytest.approx(1 / 3)
    assert risk.component_scores["dormancy"] == 0
    assert risk.component_scores["temporal"] == 0
    assert risk.total_score == pytest.approx(
        sum(risk.component_scores[k] * w for k, w in WEIGHTS.items())
    )
    assert all(0 <= c <= 1 for c in risk.component_scores.values())
    assert all(set(e.transaction_ids) <= dataset.transactions_by_id.keys() for e in risk.evidence)
    risk.component_scores["entity"] = 100
    assert service.risk.compute_risk_score(account_id(2)).component_scores["entity"] < 1
    assert service.risk.classify_node_role(account_id(1)).role == "Victim"


def test_dormancy_requires_observed_gap_and_new_burst(independent_dataset):
    dataset = independent_dataset(
        [
            ("old", 3, 2, 100, -60 * 24 * 60),
            ("seed", 1, 2, 1000, 0),
            ("a", 2, 3, 400, 1),
            ("b", 2, 4, 600, 2),
        ]
    )
    risk = AnalysisService(dataset).risk.compute_risk_score(account_id(2))
    assert risk.component_scores["dormancy"] == 1
    assert risk.component_scores["temporal"] > 0
    evidence = next(e for e in risk.evidence if e.code == "dormancy")
    assert evidence.values["observed_gap_days"] == 60
    assert set(evidence.transaction_ids) == {"old", "seed", "a", "b"}


def test_replacement_dataset_gets_fresh_scores(independent_dataset):
    first = AnalysisService(independent_dataset([("seed", 1, 2, 1000, 0)]))
    second = AnalysisService(
        independent_dataset(
            [
                ("seed", 1, 2, 1000, 0),
                ("a", 2, 3, 600, 1),
                ("b", 2, 4, 400, 2),
            ]
        )
    )
    before, after = [s.risk.compute_risk_score(account_id(2)) for s in (first, second)]
    assert before.dataset_version != after.dataset_version
    assert before.role == "Cash-Out"
    assert after.role == "Splitter"
    assert before.total_score != after.total_score


@pytest.mark.parametrize(
    "score,level", [(0, "Low"), (0.3, "Medium"), (0.5, "High"), (0.7, "Critical"), (1, "Critical")]
)
def test_risk_level_boundaries(score, level):
    assert risk_level(score) == level


def test_indian_display_formats():
    assert format_inr(Decimal("12345678.90")) == "₹1,23,45,678.90"
    assert format_inr(Decimal("0")) == "₹0"
    assert format_date(BASE) == "01-Jan-2026 05:30 IST"


def test_account_detail_measures_fifo_forward_time(independent_dataset):
    service = AnalysisService(
        independent_dataset(
            [
                ("seed", 1, 2, 1000, 0),
                ("a", 2, 3, 250, 4),
                ("b", 2, 4, 750, 8),
            ]
        )
    )
    result = service.account_detail(account_id(2))
    assert result.average_forward_minutes == 7
    assert result.distinct_senders == 1 and result.distinct_recipients == 2
    assert result.linked_complaint_ids == [CASE]
    assert result.account.kyc_status == "Full KYC"
    assert service.account_detail(account_id(3)).average_forward_minutes is None


def test_later_out_of_window_activity_does_not_erase_endpoint(independent_dataset):
    result = trace(
        independent_dataset(
            [
                ("seed", 1, 2, 1000, 0),
                ("much-later", 2, 3, 1000, 61),
            ]
        ),
        forwarding_window_hours=1,
    )
    assert result.metrics.probable_terminal_amount == 1000
    assert result.balances[0].reason == "probable_terminal"
    assert [s.tx_id for s in result.steps] == ["seed"]
    assert_conserved(result)


def test_merged_paths_share_one_layering_event(independent_dataset):
    dataset = independent_dataset(
        [
            ("seed", 1, 2, 1000, 0),
            ("left", 2, 3, 600, 1),
            ("right", 2, 4, 400, 2),
            ("join-left", 3, 5, 600, 3),
            ("join-right", 4, 5, 400, 4),
            ("merge", 5, 6, 1000, 5),
            ("a", 6, 7, 950, 6),
            ("b", 7, 8, 900, 7),
            ("c", 8, 9, 850, 8),
        ]
    )
    result = trace(dataset, max_depth=7)
    layers = [e for e in result.detections if e.type == "layering"]
    assert len(layers) == 1
    assert layers[0].transaction_ids == ["merge", "a", "b", "c"]
    assert layers[0].amount == 850
    assert Decimal(layers[0].metrics["amount_decay"]) == 150
    assert len({e.event_id for e in result.detections}) == len(result.detections)
    assert_conserved(result)


def test_layering_before_later_split_is_not_lost(independent_dataset):
    result = trace(
        independent_dataset(
            [
                ("seed", 1, 2, 1000, 0),
                ("a", 2, 3, 1000, 1),
                ("b", 3, 4, 1000, 2),
                ("c", 4, 5, 1000, 3),
                ("left", 5, 6, 600, 4),
                ("right", 5, 7, 400, 5),
            ]
        )
    )
    layers = [e for e in result.detections if e.type == "layering"]
    assert len(layers) == 1
    assert layers[0].transaction_ids == ["seed", "a", "b", "c"]


def test_transaction_input_order_does_not_change_analysis(independent_dataset):
    transfers = [("seed", 1, 2, 1000, 0), ("a", 2, 3, 600, 1), ("b", 2, 4, 400, 1)]
    first = trace(independent_dataset(transfers))
    second = trace(independent_dataset(list(reversed(transfers))))
    assert first.model_dump(exclude={"dataset_version"}) == second.model_dump(
        exclude={"dataset_version"}
    )


def test_account_trace_roles_work_without_complaints(independent_dataset):
    service = AnalysisService(
        independent_dataset(
            [
                ("seed", 1, 2, 1000, 0),
                ("a", 2, 3, 600, 1),
                ("b", 2, 4, 400, 2),
            ],
            complaint=False,
        )
    )
    result = service.trace(TraceRequest(account_id=account_id(1)))
    assert result.roles[account_id(2)].role == "Splitter"
    graph = service.serialize_graph(trail=result)
    assert next(n.data.role for n in graph.nodes if n.data.id == account_id(2)) == "Splitter"
