# Phase 0 Verification and Handoff

## Outcome

Phase 0 is complete. Implemented the FastAPI scaffold, configuration, all six router shells, validated source models, reusable dataset loader, reproducible synthetic generator, fixture verifier, dependency pins, tests, and local setup/data documentation. The frontend is a documented placeholder. Phase 1 has not started.

`AGENTS.md`, `prompts.txt`, and `requirements.pdf` were preserved. No Git commit, remote repository, submission, or cloud resource was created.

## Dataset evidence

Default seed: `20261022`. Reference date: `2026-10-22`. Offset: `+05:30`.

| Item | Verified result |
| --- | --- |
| Accounts | 200 |
| Complaints | 50 |
| Transactions | 2,344, including 120 background transfers |
| Entities | 249 |
| Gamma Network | 42 accounts, 30 complaints, 50 funded batches; nighttime, multiple splits, two layering stages, four terminals |
| Delta Ring | 16 accounts, 16 complaints, 32 funded batches; afternoon hub and six-way fan-out |
| Lone Wolf | Five accounts, four complaints, four batches; no external entity links |
| Cross-campaign link | Shared Gamma/Delta device identifier |
| Dataset version | `d0d8a3c9bcbda6f0ec298414400312d6e9011559c357987e28d34ee945846504` |

The generator verifier checks integrity, file checksums, source references, amounts, chronology, per-batch funding, campaign timing, multiple Gamma splits, terminals, isolation, repeated account pairs, phone consistency, and complete transaction/complaint fixture allocation. This verifies expected synthetic scenarios, not a fraud detection algorithm.

## Execution evidence

Run from `fraud-gps/backend`, using the isolated `.venv` on Windows / Python 3.13.7:

| Command / check | Result |
| --- | --- |
| `python generate_data.py` | Four datasets and manifest generated and validated |
| `python verify_data.py` | Scenario checks passed; counts above |
| `python -m app.repository app/data` | Generic validation passed without reading manifest |
| `python -m pytest -q --basetemp=.pytest-tmp` | 24 passed, no warnings |
| `python -m ruff check .` | Passed |
| `python -m ruff format --check .` | Passed; 21 Python files |
| `python -m pip check` | No broken requirements |
| `python -m pip install --dry-run --no-index -r requirements-dev.txt` | Installed environment satisfies pinned manifests |
| Uvicorn on `127.0.0.1:8000` | Application startup completed; real HTTP `/health` and `/docs` both returned 200 |

The live server was stopped after verification. The tests additionally prove byte-identical regeneration; alternate seeds and reference years; independent two-account dataset loading; invalid/missing JSON rejection; duplicate and unknown references; invalid amounts, precision and timestamps; self-transfer rejection; initial complaint consistency; CORS behavior; and startup failure when datasets are absent.

## Next phase and limits

Read [DATA_CONTRACT.md](../fraud-gps/backend/DATA_CONTRACT.md) before writing consumers. Ages use an explicit observation date; amount fields are decimal INR strings; IDs and display labels are separate. Restart the API after regenerating its data. Fixture metadata must not become a shortcut for detection or scoring.

Remaining limits are intentional: no graphs, tracing, scores, DNA, reports, complaint endpoints, or UI. No arbitrary-format import, live bank feeds, or confirmed withdrawal-method evidence exists. Python 3.13 on Windows is verified; other platforms are not yet verified. Phase 1 must resolve transaction graph representation, tracing attribution/window rules, and risk-component differences before implementation. Await explicit direction to begin it.
