import json
from datetime import date
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.models.schemas import Transaction
from app.repository import DatasetError, load_dataset
from generate_data import DEFAULT_REFERENCE_DATE, DEFAULT_SEED, build_dataset, write_dataset
from verify_data import verify_generated


def test_generated_scenarios_and_integrity(generated_dir):
    summary = verify_generated(generated_dir)
    assert summary["counts"]["transactions"] == 2344
    assert summary["campaigns"]["Gamma Network"]["complaints"] == 30
    assert summary["campaigns"]["Delta Ring"]["complaints"] == 16
    assert summary["campaigns"]["Lone Wolf"]["complaints"] == 4


def test_repeatable_bytes_and_seed_variation(generated_dir, tmp_path):
    write_dataset(tmp_path, DEFAULT_SEED, DEFAULT_REFERENCE_DATE)
    for path in generated_dir.glob("*.json"):
        assert path.read_bytes() == (tmp_path / path.name).read_bytes()
    changed, _ = build_dataset(DEFAULT_SEED + 1, DEFAULT_REFERENCE_DATE)
    assert changed["transactions"] != json.loads((generated_dir / "transactions.json").read_bytes())


@pytest.mark.parametrize("seed,reference", [(0, date(2025, 7, 1)), (42, date(2027, 1, 1))])
def test_other_seeds_and_year_boundaries(tmp_path, seed, reference):
    write_dataset(tmp_path, seed, reference)
    verify_generated(tmp_path)
    data = load_dataset(tmp_path)
    assert all(c.complaint_id.startswith(f"BH-{reference.year}") for c in data.complaints)
    assert all(tx.timestamp.date() <= reference for tx in data.transactions)


def small_payload(generated_dir):
    """Independent dataset shape: one unrelated transfer, no complaint or entities."""
    original = load_dataset(generated_dir)
    accounts = [a.model_dump(mode="json") for a in original.accounts[-2:]]
    accounts[0]["account_id"] = "ACC-900001"
    accounts[1]["account_id"] = "ACC-900002"
    tx = original.transactions[0].model_dump(mode="json")
    tx.update(
        tx_id="external-transfer",
        from_account="ACC-900001",
        to_account="ACC-900002",
        amount="1234.56",
    )
    return {"accounts": accounts, "transactions": [tx], "complaints": [], "entities": []}


def save_payload(directory: Path, payload: dict):
    for name, records in payload.items():
        (directory / f"{name}.json").write_text(json.dumps(records), encoding="utf-8")


def test_replacement_dataset_without_manifest_or_campaign_names(generated_dir, tmp_path):
    payload = small_payload(generated_dir)
    save_payload(tmp_path, payload)
    data = load_dataset(tmp_path)
    assert data.counts == {"accounts": 2, "transactions": 1, "complaints": 0, "entities": 0}
    assert str(data.transactions[0].amount) == "1234.56"
    version = data.version
    payload["transactions"][0]["amount"] = "1234.57"
    save_payload(tmp_path, payload)
    assert load_dataset(tmp_path).version != version


@pytest.mark.parametrize(
    "case",
    [
        "duplicate",
        "unknown_account",
        "self_transfer",
        "naive_time",
        "negative_amount",
        "precision",
        "extra",
        "entity",
        "nonfinite",
    ],
)
def test_invalid_input_rejected(generated_dir, tmp_path, case):
    payload = small_payload(generated_dir)
    tx = payload["transactions"][0]
    if case == "duplicate":
        payload["transactions"].append(tx.copy())
    elif case == "unknown_account":
        tx["to_account"] = "ACC-999999"
    elif case == "self_transfer":
        tx["to_account"] = tx["from_account"]
    elif case == "naive_time":
        tx["timestamp"] = "2026-10-01T12:00:00"
    elif case == "negative_amount":
        tx["amount"] = "-1.00"
    elif case == "precision":
        tx["amount"] = "1.001"
    elif case == "nonfinite":
        tx["amount"] = "NaN"
    elif case == "extra":
        tx["risk_score"] = 1
    else:
        payload["entities"] = [
            {
                "entity_id": "external-entity",
                "entity_type": "device_id",
                "entity_value": "unknown",
                "linked_accounts": ["ACC-999999"],
            }
        ]
    save_payload(tmp_path, payload)
    with pytest.raises(DatasetError):
        load_dataset(tmp_path)


def test_complaint_transfer_must_match(generated_dir, tmp_path):
    for path in generated_dir.glob("*.json"):
        (tmp_path / path.name).write_bytes(path.read_bytes())
    path = tmp_path / "complaints.json"
    complaints = json.loads(path.read_bytes())
    complaints[0]["amount_lost"] = "1.00"
    path.write_text(json.dumps(complaints), encoding="utf-8")
    with pytest.raises(DatasetError, match="inconsistent initial transfer"):
        load_dataset(tmp_path)


def test_invalid_json_and_missing_file(tmp_path):
    with pytest.raises(DatasetError, match="accounts.json"):
        load_dataset(tmp_path)
    (tmp_path / "accounts.json").write_text("not json", encoding="utf-8")
    with pytest.raises(DatasetError, match="accounts.json"):
        load_dataset(tmp_path)


def test_manifest_detects_interrupted_or_edited_dataset(generated_dir, tmp_path):
    for path in generated_dir.glob("*.json"):
        (tmp_path / path.name).write_bytes(path.read_bytes())
    with (tmp_path / "accounts.json").open("a", encoding="utf-8") as stream:
        stream.write("\n")
    with pytest.raises(ValueError, match="Checksum mismatch"):
        verify_generated(tmp_path)


def test_duplicate_entity_links_rejected(generated_dir):
    from app.models.schemas import Entity

    with pytest.raises(ValidationError, match="must not repeat"):
        Entity(
            entity_id="E1",
            entity_type="device_id",
            entity_value="device",
            linked_accounts=["ACC-000001", "ACC-000001"],
        )


def test_exact_money_round_trip(generated_dir):
    tx = load_dataset(generated_dir).transactions[0].model_dump(mode="json")
    tx["amount"] = "999999999999.99"
    assert json.loads(Transaction(**tx).model_dump_json())["amount"] == "999999999999.99"
