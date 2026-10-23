"""Generate reproducible synthetic records; campaign truth stays outside runtime data."""

import argparse
import hashlib
import json
import random
import tempfile
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path

from app.config import BACKEND_ROOT
from app.models.schemas import Account, Complaint, Entity, Transaction
from app.repository import load_dataset

IST = timezone(timedelta(hours=5, minutes=30))
DEFAULT_SEED = 20261022
DEFAULT_REFERENCE_DATE = date(2026, 10, 22)
BANKS = [("SBI", "SBIN"), ("PNB", "PUNB"), ("BOB", "BARB"), ("HDFC", "HDFC"), ("ICICI", "ICIC")]
CITIES = ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur", "Darbhanga", "Purnia", "Arrah"]
FIRST_NAMES = [
    "Rajesh",
    "Priya",
    "Anjali",
    "Amit",
    "Neha",
    "Sunil",
    "Pooja",
    "Vikash",
    "Ravi",
    "Suman",
    "Meena",
    "Arjun",
    "Kavita",
    "Deepak",
    "Nisha",
]
LAST_NAMES = ["Kumar", "Singh", "Devi", "Yadav", "Sinha", "Jha", "Verma", "Prasad"]
SCAMS = {
    "KYC Fraud": "A caller posing as bank staff requested an urgent KYC update and payment.",
    "Digital Arrest": "An impersonator threatened arrest and demanded a security deposit.",
    "Loan App Scam": "A fake loan agent requested processing charges before releasing a loan.",
    "Investment Scam": "A social media investment group promised guaranteed trading returns.",
    "Job Fraud": "A fake recruiter requested a registration fee for a promised job.",
    "OTP Fraud": "A caller obtained an OTP by impersonating bank support staff.",
    "Courier Scam": "A caller impersonating a courier official demanded parcel clearance charges.",
}


def split_amount(amount: int, count: int) -> list[int]:
    """Allocate whole rupees without creating money or dropping a rounding remainder."""
    quotient, remainder = divmod(amount, count)
    return [quotient + (i < remainder) for i in range(count)]


def build_dataset(seed: int, reference_date: date) -> tuple[dict, dict]:
    rng = random.Random(seed)
    accounts: list[Account] = []
    transactions: list[Transaction] = []
    complaints: list[Complaint] = []
    entities: list[Entity] = []
    campaigns: dict[str, dict] = {}

    def new_account(role: str) -> str:
        number = len(accounts) + 1
        bank, prefix = BANKS[(number - 1) % len(BANKS)]
        mule = role not in ("victims", "normal")
        accounts.append(
            Account(
                account_id=f"ACC-{number:06d}",
                masked_account=f"XXXX{1000 + number:04d}",
                holder_name=f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}",
                bank_name=bank,
                ifsc_code=f"{prefix}0{number:06d}",
                account_type="Current" if role == "cashouts" else "Savings",
                account_age_days=rng.randint(30, 90) if mule else rng.randint(365, 2500),
                age_as_of=reference_date,
                kyc_status="Minimal KYC" if mule else rng.choice(["Full KYC", "e-KYC"]),
                # Synthetic fixtures, never dial or contact these generated values.
                phone=f"+91-90000{number:05d}",
                location=rng.choice(CITIES),
            )
        )
        return accounts[-1].account_id

    layouts = {
        "Gamma Network": {
            "victims": 10,
            "collectors": 3,
            "splitters": 5,
            "layer1": 10,
            "layer2": 10,
            "cashouts": 4,
        },
        "Delta Ring": {"victims": 6, "hubs": 1, "mules": 6, "cashouts": 3},
        "Lone Wolf": {"victims": 3, "mules": 1, "cashouts": 1},
    }
    for name, roles in layouts.items():
        campaigns[name] = {
            "roles": {
                role: [new_account(role) for _ in range(count)] for role, count in roles.items()
            },
            "complaint_ids": [],
            "batches": [],
        }
    normal = [new_account("normal") for _ in range(200 - len(accounts))]
    by_id = {account.account_id: account for account in accounts}

    def transfer(source: str, target: str, amount: int, at: datetime, remarks: str) -> Transaction:
        tx = Transaction(
            tx_id=f"TX-{len(transactions) + 1:06d}",
            from_account=source,
            to_account=target,
            amount=Decimal(amount),
            timestamp=at,
            channel=rng.choice(["UPI", "IMPS", "NEFT"]),
            remarks=remarks,
            status="Success",
        )
        transactions.append(tx)
        return tx

    def complaint_for(tx: Transaction, campaign: dict) -> None:
        victim = by_id[tx.from_account]
        scam = list(SCAMS)[len(complaints) % len(SCAMS)]
        complaint = Complaint(
            complaint_id=f"BH-{reference_date.year}-{len(complaints) + 1:04d}",
            victim_name=victim.holder_name,
            victim_account=victim.account_id,
            victim_bank=victim.bank_name,
            suspect_account=tx.to_account,
            amount_lost=tx.amount,
            scam_type=scam,
            complaint_date=tx.timestamp.date(),
            description=f"{SCAMS[scam]} The victim transferred INR {tx.amount} and received no "
            "promised service. The incident was reported for investigation.",
            status=rng.choices(["Under Investigation", "Resolved", "Pending"], [7, 1, 2])[0],
            initial_tx_id=tx.tx_id,
        )
        complaints.append(complaint)
        campaign["complaint_ids"].append(complaint.complaint_id)

    gamma = campaigns["Gamma Network"]
    roles = gamma["roles"]
    for batch in range(50):
        at = datetime.combine(reference_date - timedelta(days=175 - batch * 3), time(22, 30), IST)
        amount = rng.randint(100, 500) * 1000
        collector = roles["collectors"][batch % 3]
        start_index = len(transactions)
        initial = transfer(roles["victims"][batch % 10], collector, amount, at, "Service payment")
        if batch < 30:
            complaint_for(initial, gamma)
        for i, allocation in enumerate(split_amount(amount - 100, 5)):
            splitter = roles["splitters"][i]
            transfer(collector, splitter, allocation, at + timedelta(minutes=7), "Settlement")
            for j, part in enumerate(split_amount(allocation - 20, 2)):
                index = i * 2 + j
                layer1, layer2 = roles["layer1"][index], roles["layer2"][index]
                transfer(splitter, layer1, part, at + timedelta(minutes=13), "Transfer")
                transfer(layer1, layer2, part - 10, at + timedelta(minutes=18), "Transfer")
                transfer(
                    layer2,
                    roles["cashouts"][index % 4],
                    part - 20,
                    at + timedelta(minutes=23),
                    "Account settlement",
                )
        gamma["batches"].append(
            {
                "initial_tx_id": initial.tx_id,
                "tx_ids": [tx.tx_id for tx in transactions[start_index:]],
            }
        )

    delta = campaigns["Delta Ring"]
    roles = delta["roles"]
    for batch in range(32):
        at = datetime.combine(reference_date - timedelta(days=170 - batch * 5), time(14, 15), IST)
        amount = rng.randint(60, 350) * 1000
        hub = roles["hubs"][0]
        start_index = len(transactions)
        initial = transfer(roles["victims"][batch % 6], hub, amount, at, "Payment")
        if batch < 16:
            complaint_for(initial, delta)
        for i, allocation in enumerate(split_amount(amount - 120, 6)):
            transfer(hub, roles["mules"][i], allocation, at + timedelta(minutes=8), "Settlement")
            transfer(
                roles["mules"][i],
                roles["cashouts"][i % 3],
                allocation - 20,
                at + timedelta(minutes=16),
                "Transfer",
            )
        delta["batches"].append(
            {
                "initial_tx_id": initial.tx_id,
                "tx_ids": [tx.tx_id for tx in transactions[start_index:]],
            }
        )

    lone = campaigns["Lone Wolf"]
    roles = lone["roles"]
    for batch in range(4):
        at = datetime.combine(reference_date - timedelta(days=100 - batch * 20), time(11), IST)
        amount = rng.randint(5, 50) * 1000
        initial = transfer(roles["victims"][batch % 3], roles["mules"][0], amount, at, "Payment")
        last = transfer(
            roles["mules"][0],
            roles["cashouts"][0],
            amount - 50,
            at + timedelta(minutes=12),
            "Transfer",
        )
        complaint_for(initial, lone)
        lone["batches"].append(
            {"initial_tx_id": initial.tx_id, "tx_ids": [initial.tx_id, last.tx_id]}
        )

    background = []
    for _ in range(120):
        source, target = rng.sample(normal, 2)
        at = datetime.combine(
            reference_date - timedelta(days=rng.randint(1, 179)),
            time(rng.randint(8, 20), rng.randint(0, 59)),
            IST,
        )
        background.append(
            transfer(
                source,
                target,
                rng.randint(100, 15000),
                at,
                rng.choice(["Groceries", "School fees", "Rent", "Lunch"]),
            ).tx_id
        )

    def entity(kind: str, value: str, linked: list[str]) -> None:
        entities.append(
            Entity(
                entity_id=f"ENT-{len(entities) + 1:05d}",
                entity_type=kind,
                entity_value=value,
                linked_accounts=tuple(linked),
            )
        )

    # Every account's phone field agrees with its entity membership.
    for account in accounts:
        entity("phone", account.phone, [account.account_id])
    for index, campaign in enumerate(campaigns.values(), 1):
        roles = campaign["roles"]
        suspects = [
            account for role, values in roles.items() if role != "victims" for account in values
        ]
        for account in suspects:
            entity("upi_id", f"demo.{account.lower()}@example", [account])
        entity("device_id", f"SYNTH-DEVICE-{index}", suspects[:4])
        entity("ip_address", f"192.0.2.{index}", suspects[-4:])
        entity("email", f"synthetic-group-{index}@example.invalid", suspects[-3:])
        shared = suspects[:3]
        phone = by_id[shared[0]].phone
        for account_id in shared[1:]:
            account_index = next(
                i for i, account in enumerate(accounts) if account.account_id == account_id
            )
            accounts[account_index] = accounts[account_index].model_copy(update={"phone": phone})
        entities = [
            item
            for item in entities
            if not (item.entity_type == "phone" and set(item.linked_accounts) & set(shared))
        ]
        entity("phone", phone, shared)
    entity(
        "device_id",
        "SYNTH-CROSS-CAMPAIGN-DEVICE",
        [
            campaigns["Gamma Network"]["roles"]["splitters"][0],
            campaigns["Delta Ring"]["roles"]["mules"][0],
        ],
    )
    # Renumber after merging phone records; IDs have no analytic meaning.
    entities = [
        item.model_copy(update={"entity_id": f"ENT-{i:05d}"}) for i, item in enumerate(entities, 1)
    ]
    transactions.sort(key=lambda tx: (tx.timestamp, tx.tx_id))
    # Age is measured at first observed activity, not implicitly at today's date.
    # This keeps historical campaigns consistent with short-lived mule accounts.
    first_seen: dict[str, date] = {}
    for tx in transactions:
        for account_id in (tx.from_account, tx.to_account):
            first_seen.setdefault(account_id, tx.timestamp.date())
    accounts = [
        account.model_copy(update={"age_as_of": first_seen.get(account.account_id, reference_date)})
        for account in accounts
    ]
    payload = {
        name: [item.model_dump(mode="json") for item in values]
        for name, values in (
            ("accounts", accounts),
            ("complaints", complaints),
            ("transactions", transactions),
            ("entities", entities),
        )
    }
    manifest = {
        "schema_version": 1,
        "synthetic": True,
        "seed": seed,
        "reference_date": reference_date.isoformat(),
        "timezone": "Asia/Kolkata",
        "money_unit": "INR decimal string",
        "campaigns": campaigns,
        "normal_account_ids": normal,
        "background_tx_ids": background,
        "counts": {name: len(values) for name, values in payload.items()},
        "cashout_evidence": "Terminal accounts only; withdrawal method is not observed.",
    }
    return payload, manifest


def write_dataset(output: Path, seed: int, reference_date: date) -> dict:
    """Stage and validate before publishing; per-file replacement is atomic.

    Stop the backend before regenerating. The five-file dataset is not a transaction;
    its manifest hashes detect interrupted writes during verification.
    """
    payload, manifest = build_dataset(seed, reference_date)
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".generate-", dir=output.parent) as temporary:
        staged = Path(temporary)
        manifest["sha256"] = {}
        for name, records in payload.items():
            content = (json.dumps(records, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
            (staged / f"{name}.json").write_bytes(content)
            manifest["sha256"][f"{name}.json"] = hashlib.sha256(content).hexdigest()
        load_dataset(staged)
        (staged / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        for path in staged.iterdir():
            if path.name != "manifest.json":
                path.replace(output / path.name)
        (staged / "manifest.json").replace(output / "manifest.json")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--reference-date", type=date.fromisoformat, default=DEFAULT_REFERENCE_DATE)
    parser.add_argument("--output-dir", type=Path, default=BACKEND_ROOT / "app/data")
    args = parser.parse_args()
    manifest = write_dataset(args.output_dir.resolve(), args.seed, args.reference_date)
    print(
        json.dumps(
            {
                "output_dir": str(args.output_dir.resolve()),
                "counts": manifest["counts"],
                "seed": args.seed,
                "reference_date": args.reference_date.isoformat(),
                "patterns": {
                    name: len(info["complaint_ids"]) for name, info in manifest["campaigns"].items()
                },
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
