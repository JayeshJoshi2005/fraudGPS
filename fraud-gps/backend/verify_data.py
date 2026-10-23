"""Verify generated fixture structure and expected scenarios, separate from runtime loading."""

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from app.config import BACKEND_ROOT
from app.repository import load_dataset


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def verify_generated(directory: Path) -> dict:
    dataset = load_dataset(directory)
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    for filename, expected in manifest["sha256"].items():
        # Manifest is local generated metadata; accept only the four fixed input files.
        require(filename in {f"{name}.json" for name in dataset.counts}, "Unexpected manifest file")
        require(
            hashlib.sha256((directory / filename).read_bytes()).hexdigest() == expected,
            f"Checksum mismatch: {filename}",
        )
    require(
        set(manifest["sha256"]) == {f"{name}.json" for name in dataset.counts},
        "Manifest must cover all dataset files",
    )
    require(dataset.counts == manifest["counts"], "Manifest counts do not match data")
    require(
        len(dataset.accounts) == 200 and len(dataset.complaints) == 50,
        "Expected 200 accounts and 50 complaints",
    )
    require(len(dataset.transactions) >= 2000, "Expected at least 2,000 transactions")
    reference = date.fromisoformat(manifest["reference_date"])
    require(
        all(
            reference - timedelta(days=183) <= c.complaint_date <= reference
            and Decimal(5000) <= c.amount_lost <= Decimal(500000)
            for c in dataset.complaints
        ),
        "Complaint dates or amounts outside demo bounds",
    )
    pairs = Counter((tx.from_account, tx.to_account) for tx in dataset.transactions)
    require(max(pairs.values()) > 1, "Fixture must preserve repeated account-pair transfers")
    require(
        list(dataset.transactions)
        == sorted(dataset.transactions, key=lambda tx: (tx.timestamp, tx.tx_id)),
        "Transactions must be chronologically sorted",
    )
    all_members: dict[str, set[str]] = {}
    all_complaints: list[str] = []
    allocated_transactions: list[str] = []
    summaries = {}
    for name, campaign in manifest["campaigns"].items():
        roles = campaign["roles"]
        members = {item for values in roles.values() for item in values}
        require(members <= dataset.accounts_by_id.keys(), f"Unknown member in {name}")
        require(
            not any(members & previous for previous in all_members.values()),
            "Campaign account memberships must be disjoint",
        )
        all_members[name] = members
        all_complaints.extend(campaign["complaint_ids"])
        for role, values in roles.items():
            if role != "victims":
                require(
                    all(
                        30 <= dataset.accounts_by_id[item].account_age_days <= 90
                        and dataset.accounts_by_id[item].kyc_status == "Minimal KYC"
                        for item in values
                    ),
                    f"Expected young minimal-KYC mules in {name}",
                )
        for batch in campaign["batches"]:
            txs = [dataset.transactions_by_id[tx_id] for tx_id in batch["tx_ids"]]
            allocated_transactions.extend(batch["tx_ids"])
            initial = dataset.transactions_by_id[batch["initial_tx_id"]]
            require(
                initial in txs and initial.from_account in roles["victims"],
                f"Invalid initial transfer in {name}",
            )
            require(
                all(tx.from_account in members and tx.to_account in members for tx in txs),
                f"Unexpected external transfer in {name}",
            )
            ordered = sorted(txs, key=lambda tx: (tx.timestamp, tx.tx_id))
            balance: dict[str, Decimal] = defaultdict(Decimal)
            out_degree: dict[str, set[str]] = defaultdict(set)
            for tx in ordered:
                if tx.from_account not in roles["victims"]:
                    require(
                        balance[tx.from_account] >= tx.amount,
                        f"Unfunded onward transfer {tx.tx_id}",
                    )
                    balance[tx.from_account] -= tx.amount
                balance[tx.to_account] += tx.amount
                out_degree[tx.from_account].add(tx.to_account)
            require(
                all(not out_degree[terminal] for terminal in roles["cashouts"]),
                "Probable terminals must not forward funds",
            )
            require(
                all(balance[terminal] > 0 for terminal in roles["cashouts"]),
                "All planned terminals must receive funds",
            )
            if name == "Gamma Network":
                require(
                    all(22 <= tx.timestamp.hour or tx.timestamp.hour < 2 for tx in txs),
                    "Gamma must operate at night",
                )
                require(
                    len([targets for targets in out_degree.values() if len(targets) > 1]) >= 3,
                    "Gamma needs multiple split points",
                )
                require(
                    len(ordered) == 36 and len(members) >= 15,
                    "Gamma must include splitting and two explicit layering stages",
                )
                first_split = min(
                    tx.timestamp for tx in txs if tx.from_account == initial.to_account
                )
                require(
                    timedelta(minutes=5)
                    <= first_split - initial.timestamp
                    <= timedelta(minutes=15),
                    "Gamma collector timing outside bounds",
                )
            if name == "Delta Ring":
                require(
                    all(14 <= tx.timestamp.hour < 17 for tx in txs),
                    "Delta must operate in the afternoon",
                )
                require(len(out_degree[roles["hubs"][0]]) == 6, "Delta needs six-way fan-out")
            require(
                max(tx.timestamp for tx in txs) - initial.timestamp <= timedelta(minutes=30),
                "Demo batch must forward rapidly",
            )
        summaries[name] = {
            "accounts": len(members),
            "complaints": len(campaign["complaint_ids"]),
            "batches": len(campaign["batches"]),
        }
    require(
        len(all_complaints) == len(set(all_complaints)) == 50
        and set(all_complaints) == {c.complaint_id for c in dataset.complaints},
        "Each complaint must belong to exactly one scenario",
    )
    normal = set(manifest["normal_account_ids"])
    require(not normal & set.union(*all_members.values()), "Background accounts overlap campaigns")
    require(len(manifest["background_tx_ids"]) >= 100, "Expected legitimate background activity")
    for tx_id in manifest["background_tx_ids"]:
        tx = dataset.transactions_by_id[tx_id]
        require(
            tx.from_account in normal and tx.to_account in normal,
            "Background transfer touches a campaign",
        )
    allocated_transactions.extend(manifest["background_tx_ids"])
    require(
        len(allocated_transactions)
        == len(set(allocated_transactions))
        == len(dataset.transactions),
        "Each transaction must belong to exactly one fixture batch",
    )
    gamma, delta, lone = (
        all_members[name] for name in ("Gamma Network", "Delta Ring", "Lone Wolf")
    )
    require(
        any(
            set(e.linked_accounts) & gamma and set(e.linked_accounts) & delta
            for e in dataset.entities
        ),
        "Expected Gamma/Delta entity overlap",
    )
    require(
        not any(
            set(e.linked_accounts) & lone and set(e.linked_accounts) - lone
            for e in dataset.entities
        ),
        "Lone Wolf must have no external entity links",
    )
    for account in dataset.accounts:
        require(
            any(
                e.entity_type == "phone"
                and e.entity_value == account.phone
                and account.account_id in e.linked_accounts
                for e in dataset.entities
            ),
            f"Phone mismatch for {account.account_id}",
        )
    return {
        "counts": dataset.counts,
        "dataset_version": dataset.version,
        "campaigns": summaries,
        "background_transactions": len(manifest["background_tx_ids"]),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=BACKEND_ROOT / "app/data")
    args = parser.parse_args()
    print(json.dumps(verify_generated(args.data_dir), indent=2))


if __name__ == "__main__":
    main()
