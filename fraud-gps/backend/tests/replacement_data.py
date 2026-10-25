"""Independent synthetic inputs for a full replacement-data rehearsal; no manifest."""

import argparse
import json
from pathlib import Path


def write_fixture(directory: Path):
    directory.mkdir(parents=True, exist_ok=True)
    accounts = [
        {
            "account_id": f"ACC-{900000 + i:06}",
            "masked_account": f"XXXX{7000 + i}",
            "holder_name": f"Synthetic Replacement {i}",
            "bank_name": "Synthetic Demo Bank",
            "ifsc_code": "TEST0000001",
            "account_type": "Savings",
            "account_age_days": 180,
            "age_as_of": "2026-01-01",
            "kyc_status": "Full KYC",
            "phone": f"+91-90000100{i:02}",
            "location": "Patna",
        }
        for i in range(1, 7)
    ]
    transactions = [
        {
            "tx_id": name,
            "from_account": f"ACC-{900000 + source:06}",
            "to_account": f"ACC-{900000 + target:06}",
            "amount": amount,
            "timestamp": f"2026-01-01T10:{minute:02}:00+05:30",
            "channel": "UPI",
            "remarks": "Independent synthetic replacement fixture",
            "status": "Success",
        }
        for name, source, target, amount, minute in [
            ("replacement-a-seed", 1, 2, "100001.35", 0),
            ("replacement-a-forward", 2, 3, "75001.10", 5),
            ("replacement-b-seed", 4, 5, "20000.50", 20),
            ("replacement-b-forward", 5, 6, "20000.50", 25),
        ]
    ]
    complaints = [
        {
            "complaint_id": f"BH-2026-{9900 + index:04}",
            "victim_name": accounts[source - 1]["holder_name"],
            "victim_account": accounts[source - 1]["account_id"],
            "victim_bank": "Synthetic Demo Bank",
            "suspect_account": accounts[source]["account_id"],
            "amount_lost": amount,
            "scam_type": "OTP Fraud",
            "complaint_date": "2026-01-01",
            "description": "Independent synthetic source records for dataset replacement.",
            "status": "Under Investigation",
            "initial_tx_id": seed,
        }
        for index, source, seed, amount in [
            (1, 1, "replacement-a-seed", "100001.35"),
            (2, 4, "replacement-b-seed", "20000.50"),
        ]
    ]
    entities = [
        {
            "entity_id": "replacement-shared-phone",
            "entity_type": "phone",
            "entity_value": "+91-9000010002",
            "linked_accounts": ["ACC-900002", "ACC-900005"],
        }
    ]
    for name, rows in {
        "accounts": accounts,
        "transactions": transactions,
        "complaints": complaints,
        "entities": entities,
    }.items():
        path = directory / f"{name}.json"
        if path.exists():
            raise FileExistsError(f"Refusing to replace {path}")
        path.write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
    return directory


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    write_fixture(parser.parse_args().output)
