from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture(scope="module")
def client(generated_dir):
    with TestClient(create_app(Settings(generated_dir, ("http://localhost:3000",)))) as client:
        yield client


def case(client):
    return client.get("/api/complaints").json()["items"][0]


def test_all_endpoints_and_evidence_agree(client):
    complaint = case(client)
    cid, aid = complaint["complaint_id"], complaint["suspect_account"]
    response = client.post("/api/trace", json={"complaint_id": cid})
    assert response.status_code == 200
    trace = response.json()
    txids = {s["tx_id"] for s in trace["steps"]}
    assert trace["steps"][0]["tx_id"] == complaint["initial_tx_id"]
    metrics = trace["metrics"]
    assert Decimal(metrics["seed_amount"]) == Decimal(complaint["amount_lost"])
    assert Decimal(metrics["seed_amount"]) == Decimal(metrics["retained_amount"]) + Decimal(
        metrics["stopped_amount"]
    )
    assert set(trace["summary_transaction_ids"]) == txids
    assert trace["summary"]
    graph = client.get(f"/api/graph/trail/{cid}").json()
    assert {e["data"]["id"] for e in graph["edges"]} == txids
    timeline_response = client.get(f"/api/timeline/{cid}")
    assert timeline_response.status_code == 200
    timeline = timeline_response.json()
    assert timeline_response.headers["x-dataset-version"] == trace["dataset_version"]
    cors = client.get(f"/api/timeline/{cid}", headers={"Origin": "http://localhost:3000"})
    assert "X-Dataset-Version" in cors.headers["access-control-expose-headers"]
    assert {e["transaction_ids"][0] for e in timeline if e["type"] == "transfer"} == txids
    assert all(set(e["transaction_ids"]) <= txids for e in timeline)
    assert [e["step"] for e in timeline] == list(range(1, len(timeline) + 1))
    assert len({e["event_id"] for e in timeline}) == len(timeline)
    assert [e["timestamp"] for e in timeline] == sorted(e["timestamp"] for e in timeline)
    stats = trace["statistics"]
    assert stats["other_linked_complaint_ids"] == sorted(set(stats["other_linked_complaint_ids"]))
    assert cid not in stats["other_linked_complaint_ids"]
    assert set(stats["probable_endpoint_account_ids"]) == {
        account
        for event in timeline
        if event["type"] == "terminal"
        for account in event["account_ids"]
    }
    assert client.get(f"/api/timeline/{cid}").json() == timeline
    assert client.get(f"/api/complaints/{cid}").json()["trace"] == trace
    risk = client.get(f"/api/risk/{aid}")
    assert risk.status_code == 200
    assert 0 <= risk.json()["total_score"] <= 1
    assert client.get(f"/api/graph/subgraph/{aid}?depth=0").json()["edges"] == []
    assert len(client.get("/api/graph/full").json()["edges"]) == 2344
    top = client.get("/api/risk/top?limit=7").json()
    assert len(top) == 7
    assert [r["total_score"] for r in top] == sorted([r["total_score"] for r in top], reverse=True)
    assert client.get("/api/complaints?offset=49&limit=2").json()["total"] == 50
    assert len(client.get("/api/complaints?offset=49&limit=2").json()["items"]) == 1


def test_filters_are_shared_by_trace_graph_timeline_and_detail(client):
    cid = case(client)["complaint_id"]
    options = {"max_depth": 2, "min_amount": "0", "forwarding_window_hours": 1}
    response = client.post("/api/trace", json={"complaint_id": cid, **options})
    assert response.status_code == 200
    txids = {s["tx_id"] for s in response.json()["steps"]}
    graph = client.get(f"/api/graph/trail/{cid}", params=options)
    assert graph.status_code == 200, graph.text
    assert {e["data"]["id"] for e in graph.json()["edges"]} == txids
    timeline = client.get(f"/api/timeline/{cid}", params=options)
    assert timeline.status_code == 200, timeline.text
    assert {e["transaction_ids"][0] for e in timeline.json() if e["type"] == "transfer"} == txids
    detail = client.get(f"/api/complaints/{cid}", params=options)
    assert detail.status_code == 200
    assert detail.json()["trace"] == response.json()


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"account_id": "wrong"},
        {"account_id": "ACC-000001", "complaint_id": "BH-2026-0001"},
        {"account_id": "ACC-000001", "max_depth": 0},
        {"account_id": "ACC-000001", "max_depth": 8},
        {"account_id": "ACC-000001", "max_depth": True},
        {"account_id": "ACC-000001", "min_amount": "-1"},
        {"account_id": "ACC-000001", "min_amount": "NaN"},
        {"account_id": "ACC-000001", "min_amount": "0.001"},
        {"account_id": "ACC-000001", "forwarding_window_hours": 169},
        {"account_id": "ACC-000001", "unknown": 1},
        {"complaint_id": "BH-2026-0001", "start_tx_id": "anything"},
    ],
)
def test_invalid_trace_inputs(client, body):
    response = client.post("/api/trace", json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_input"


@pytest.mark.parametrize(
    "url",
    [
        "/api/risk/top?limit=0",
        "/api/risk/top?limit=201",
        "/api/complaints?offset=-1",
        "/api/graph/subgraph/ACC-000001?depth=8",
        "/api/graph/trail/BH-2026-0001?min_amount=-1",
        "/api/timeline/BH-2026-0001?max_depth=8",
    ],
)
def test_invalid_queries(client, url):
    assert client.get(url).status_code == 422


@pytest.mark.parametrize(
    "url",
    [
        "/api/risk/ACC-999999",
        "/api/graph/subgraph/ACC-999999",
        "/api/graph/trail/BH-2026-9999",
        "/api/timeline/BH-2026-9999",
        "/api/complaints/BH-2026-9999",
    ],
)
def test_missing_records(client, url):
    response = client.get(url)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_valid_empty_trail(client):
    cid = case(client)["complaint_id"]
    response = client.post("/api/trace", json={"complaint_id": cid, "min_amount": "999999999"})
    assert response.status_code == 200
    assert response.json()["steps"] == []
    assert response.json()["metrics"]["seed_amount"] == "0.00"
    assert client.get(f"/api/timeline/{cid}?min_amount=999999999").json() == []


def test_account_inspector_endpoint(client):
    complaint = case(client)
    response = client.get(f"/api/accounts/{complaint['suspect_account']}")
    assert response.status_code == 200
    detail = response.json()
    assert detail["account"]["account_id"] == complaint["suspect_account"]
    assert detail["average_forward_minutes"] >= 0
    assert complaint["complaint_id"] in detail["linked_complaint_ids"]
    assert client.get("/api/accounts/ACC-999999").status_code == 404


def test_all_demo_trails_conserve_funds_and_have_valid_provenance(client):
    for complaint in client.get("/api/complaints").json()["items"]:
        response = client.post("/api/trace", json={"complaint_id": complaint["complaint_id"]})
        assert response.status_code == 200
        trail = response.json()
        metrics = trail["metrics"]
        assert Decimal(metrics["seed_amount"]) == sum(
            Decimal(b["amount"]) for b in trail["balances"]
        )
        assert all(Decimal(s["attributed_amount"]) <= Decimal(s["amount"]) for s in trail["steps"])
        assert len({s["tx_id"] for s in trail["steps"]}) == len(trail["steps"])
