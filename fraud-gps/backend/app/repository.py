"""Load interchangeable datasets and validate cross-record integrity.

Campaign names and generated truth metadata intentionally do not enter this boundary.
"""

import argparse
import hashlib
import json
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType

from pydantic import TypeAdapter, ValidationError

from app.models.schemas import Account, Complaint, Entity, Transaction


class DatasetError(ValueError):
    """A dataset is missing, malformed, or internally inconsistent."""


@dataclass(frozen=True)
class Dataset:
    accounts: tuple[Account, ...]
    complaints: tuple[Complaint, ...]
    transactions: tuple[Transaction, ...]
    entities: tuple[Entity, ...]
    accounts_by_id: Mapping[str, Account]
    transactions_by_id: Mapping[str, Transaction]
    version: str

    @property
    def counts(self) -> dict[str, int]:
        return {
            name: len(getattr(self, name))
            for name in ("accounts", "complaints", "transactions", "entities")
        }


def _unique(records: tuple, field: str) -> dict:
    index = {}
    for record in records:
        value = getattr(record, field)
        if value in index:
            raise DatasetError(f"Duplicate {field}: {value}")
        index[value] = record
    return index


def load_dataset(directory: Path) -> Dataset:
    """Fail closed on invalid input; impose no demo counts or campaign assumptions."""
    records = {}
    digest = hashlib.sha256()
    for name, model in (
        ("accounts", Account),
        ("complaints", Complaint),
        ("transactions", Transaction),
        ("entities", Entity),
    ):
        path = directory / f"{name}.json"
        try:
            raw = path.read_bytes()
            records[name] = TypeAdapter(tuple[model, ...]).validate_json(raw)
        except (OSError, ValidationError, json.JSONDecodeError) as exc:
            raise DatasetError(f"Invalid dataset file {path}: {exc}") from exc
        digest.update(name.encode())
        digest.update(raw)
    accounts = _unique(records["accounts"], "account_id")
    complaints = _unique(records["complaints"], "complaint_id")
    transactions = _unique(records["transactions"], "tx_id")
    _unique(records["entities"], "entity_id")
    if not accounts:
        raise DatasetError("Dataset must contain at least one account")
    entity_values = set()
    for tx in transactions.values():
        if tx.from_account not in accounts or tx.to_account not in accounts:
            raise DatasetError(f"Transaction {tx.tx_id} references an unknown account")
    for complaint in complaints.values():
        victim = accounts.get(complaint.victim_account)
        if victim is None or complaint.suspect_account not in accounts:
            raise DatasetError(f"Complaint {complaint.complaint_id} references an unknown account")
        tx = transactions.get(complaint.initial_tx_id)
        if tx is None or (tx.from_account, tx.to_account, tx.amount) != (
            complaint.victim_account,
            complaint.suspect_account,
            complaint.amount_lost,
        ):
            raise DatasetError(
                f"Complaint {complaint.complaint_id} has an inconsistent initial transfer"
            )
        if complaint.complaint_date < tx.timestamp.date():
            raise DatasetError(f"Complaint {complaint.complaint_id} predates its initial transfer")
        if (complaint.victim_name, complaint.victim_bank) != (victim.holder_name, victim.bank_name):
            raise DatasetError(
                f"Complaint {complaint.complaint_id} has inconsistent victim details"
            )
    for entity in records["entities"]:
        key = (entity.entity_type, entity.entity_value)
        if key in entity_values:
            raise DatasetError(f"Duplicate entity type/value: {key}")
        entity_values.add(key)
        if not set(entity.linked_accounts) <= accounts.keys():
            raise DatasetError(f"Entity {entity.entity_id} references an unknown account")
    return Dataset(
        **records,
        accounts_by_id=MappingProxyType(accounts),
        transactions_by_id=MappingProxyType(transactions),
        version=digest.hexdigest(),
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate a conforming dataset without demo metadata"
    )
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    dataset = load_dataset(args.directory)
    print(json.dumps({"counts": dataset.counts, "dataset_version": dataset.version}, indent=2))


if __name__ == "__main__":
    main()
