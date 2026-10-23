# Dataset Input Contract — Version 1

## Files and loader

Every input directory contains four UTF-8 JSON arrays: `accounts.json`, `complaints.json`, `transactions.json`, and `entities.json`. Models in `app/models/schemas.py` are authoritative. Unknown fields, missing required fields, invalid values, duplicate IDs, and broken references are rejected.

`app.repository.load_dataset(path)` is the storage boundary. It returns frozen model tuples, read-only account/transaction indices, record counts, and a SHA-256 dataset version. It does not read campaign names or the generator manifest. Changing file bytes changes the version; this is a content hash, not a semantic equivalence check.

Validate an alternate dataset independently of fixture expectations:

```powershell
.\.venv\Scripts\python.exe -m app.repository ./alternate-data
```

All four files are required. Accounts must be nonempty; the other arrays may be empty. External datasets must be normalized to these field names and formats; automatic arbitrary bank-statement/CSV import is outside Phase 0. Preserve original-to-internal ID mappings in your importer when introduced.

## Records

| File | Required fields and constraints |
| --- | --- |
| Accounts | `account_id` (`ACC-000001` format), `masked_account` (`XXXX1001`), `holder_name`, `bank_name`, `ifsc_code` (11-character IFSC shape), `account_type` (`Savings`/`Current`), nonnegative integer `account_age_days`, ISO date `age_as_of`, `kyc_status` (`Full KYC`/`Minimal KYC`/`e-KYC`), `phone` (`+91-` and 10 digits), `location`. |
| Complaints | Unique `complaint_id` (`BH-YYYY-NNNN`), `victim_name`, `victim_account`, `victim_bank`, `suspect_account`, `amount_lost`, `scam_type`, ISO `complaint_date`, `description`, `status`, and `initial_tx_id`. |
| Transactions | Unique nonempty `tx_id`, `from_account`, `to_account`, positive `amount`, timezone-aware ISO `timestamp`, `channel` (`UPI`/`IMPS`/`NEFT`), `remarks`, and `status` (`Success`). Self-transfers are rejected. Repeated account pairs are valid and retained. |
| Entities | Unique nonempty `entity_id`, `entity_type` (`phone`/`device_id`/`upi_id`/`ip_address`/`email`), nonempty `entity_value`, and nonempty `linked_accounts` with no duplicate links. One record per type/value pair. |

Scam types: KYC Fraud, Digital Arrest, Loan App Scam, Investment Scam, Job Fraud, OTP Fraud, Courier Scam. Complaint statuses: Under Investigation, Resolved, Pending. Names/locations are nonempty text; formatting rules do not prove that a bank branch, person, or identifier exists.

## Identity, money, and time

Use stable internal account IDs in every relationship; masked labels are presentation only and must not be used as join keys. Generated labels happen to be unique, but the loader permits repeated display labels. Complaint years follow the selected reference year rather than hardcoding 2024.

Amounts are INR decimal strings, for example `"50000.25"`, parsed as `Decimal`. At most 14 total digits and two fractional digits are accepted; zero, negative, nonfinite, and excessive-precision amounts are rejected. Do not sum binary floats or insert currency formatting into source amounts. Whole-rupee fixture values are exact too.

Timestamps include an explicit offset, for example `2026-10-01T22:30:00+05:30`. Generated data uses IST; sort by instant and transaction ID for deterministic ties. Complaint dates cannot precede the initial transfer's calendar date in its recorded offset.

`account_age_days` is the age **on `age_as_of`**, not necessarily today. Generated records measure age at their first observed activity, allowing short-lived mule accounts in historical campaigns. For another observation date, derive age using that date difference. An account's age is not its dormancy duration; sparse transactions cannot establish unobserved bank activity.

Every complaint references an existing victim, suspect, and initial transaction. Its source, destination, amount, victim name, and bank must agree with those records. Entity links and transaction endpoints must reference known accounts.

## Synthetic scenario metadata

`manifest.json` is verification metadata, not an engine input. It records generation settings, file hashes, scenario memberships, expected roles, complaint IDs, transaction batches, and background transactions. These are fixture expectations, not computed risk or DNA results. Only `verify_data.py` and tests consume this truth.

Gamma has 42 accounts and nighttime split/layer flows; Delta has 16 accounts and afternoon hub/fan-out flows; Lone Wolf has five accounts and no external entity links. The remaining 137 accounts form the separate background pool. Some may have no observed transfers. Cash-out accounts are probable terminals only: ATM/merchant/crypto evidence is not present. Synthetic phones are not to be contacted; example IP/email identifiers use documentation/reserved namespaces.
