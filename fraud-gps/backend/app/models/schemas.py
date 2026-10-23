"""Source record contracts. Monetary JSON values are decimal INR strings."""

from datetime import date
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

AccountId = Annotated[str, Field(pattern=r"^ACC-\d{6}$")]
Money = Annotated[Decimal, Field(gt=0, max_digits=14, decimal_places=2, allow_inf_nan=False)]
ScamType = Literal[
    "KYC Fraud",
    "Digital Arrest",
    "Loan App Scam",
    "Investment Scam",
    "Job Fraud",
    "OTP Fraud",
    "Courier Scam",
]


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, frozen=True)


class Account(Record):
    account_id: AccountId
    masked_account: Annotated[str, Field(pattern=r"^XXXX\d{4}$")]
    holder_name: Annotated[str, Field(min_length=1)]
    bank_name: Annotated[str, Field(min_length=1)]
    ifsc_code: Annotated[str, Field(pattern=r"^[A-Z]{4}0[A-Z0-9]{6}$")]
    account_type: Literal["Savings", "Current"]
    account_age_days: Annotated[int, Field(ge=0, strict=True)]
    age_as_of: date
    kyc_status: Literal["Full KYC", "Minimal KYC", "e-KYC"]
    phone: Annotated[str, Field(pattern=r"^\+91-[6-9]\d{9}$")]
    location: Annotated[str, Field(min_length=1)]


class Complaint(Record):
    complaint_id: Annotated[str, Field(pattern=r"^BH-\d{4}-\d{4}$")]
    victim_name: Annotated[str, Field(min_length=1)]
    victim_account: AccountId
    victim_bank: Annotated[str, Field(min_length=1)]
    suspect_account: AccountId
    amount_lost: Money
    scam_type: ScamType
    complaint_date: date
    description: Annotated[str, Field(min_length=20)]
    status: Literal["Under Investigation", "Resolved", "Pending"]
    initial_tx_id: Annotated[str, Field(min_length=1)]


class Transaction(Record):
    tx_id: Annotated[str, Field(min_length=1)]
    from_account: AccountId
    to_account: AccountId
    amount: Money
    timestamp: AwareDatetime
    channel: Literal["UPI", "IMPS", "NEFT"]
    remarks: Annotated[str, Field(min_length=1)]
    status: Literal["Success"]

    @model_validator(mode="after")
    def reject_self_transfer(self) -> Self:
        if self.from_account == self.to_account:
            raise ValueError("A transfer must have distinct source and destination accounts")
        return self


class Entity(Record):
    entity_id: Annotated[str, Field(min_length=1)]
    entity_type: Literal["phone", "device_id", "upi_id", "ip_address", "email"]
    entity_value: Annotated[str, Field(min_length=1)]
    linked_accounts: Annotated[tuple[AccountId, ...], Field(min_length=1)]

    @model_validator(mode="after")
    def unique_links(self) -> Self:
        if len(set(self.linked_accounts)) != len(self.linked_accounts):
            raise ValueError("Entity links must not repeat accounts")
        return self
