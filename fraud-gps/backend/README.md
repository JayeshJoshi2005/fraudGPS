# Fraud GPS Backend — Analysis, DNA, summaries, and PDF reports

## Prerequisites and setup

Tested on Windows with Python **3.13.7**. Use Python 3.13 for the pinned dependency set. No database, Node.js, cloud credentials, or external API is needed. Downloading dependencies requires internet access.

From the repository root in PowerShell:

```powershell
cd fraud-gps/backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe generate_data.py
.\.venv\Scripts\python.exe verify_data.py
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Use `requirements.txt` instead for runtime dependencies only. Direct dependencies and transitive constraints are pinned; update them intentionally and rerun validation. On macOS/Linux use `.venv/bin/python` in place of `.\.venv\Scripts\python.exe`; those platforms have not been verified yet. Activation is optional.

Open [health](http://127.0.0.1:8000/health) or [API documentation](http://127.0.0.1:8000/docs). Health reports Phase 1, loaded counts, and the dataset hash. Startup validates input files, builds graph projections, traces complaints, and computes dataset-scoped risk scores. See [API.md](API.md) for requests, response semantics, and error handling.

## Repeatable data generation

The committed JSON fixtures are synthetic and reproducible. Defaults: seed `20261022`, reference date `2026-10-22`. Generation does not use the wall clock or global random state.

```powershell
.\.venv\Scripts\python.exe generate_data.py --seed 42 --reference-date 2026-10-22 --output-dir ./alternate-data
.\.venv\Scripts\python.exe verify_data.py --data-dir ./alternate-data
```

The generator writes the four input datasets and a separate manifest containing scenario truth, checksums, seed, and reference date. Stop the backend before replacing its dataset; restart to load the new version. Generation validates staged files and replaces each file atomically, but the complete set is not a single filesystem transaction. Run the verifier after generation to detect interrupted or edited output.

See [DATA_CONTRACT.md](DATA_CONTRACT.md) for fields and import rules. `verify_data.py` checks the particular generated scenarios; it is not a general requirement that alternate datasets contain these campaigns or counts.

## Configuration

Configuration is read from environment variables; `.env.example` is a reference, not automatically loaded.

```powershell
$env:FRAUD_GPS_DATA_DIR = 'alternate-data'
$env:FRAUD_GPS_CORS_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Relative data paths resolve against the backend directory regardless of shell working directory. Explicit CORS origins are required; wildcard origins are rejected. Default origins allow the future frontend on port 3000. The generator's output path is set by its CLI, independently of API configuration.

## Verification

From this directory:

```powershell
.\.venv\Scripts\python.exe -m pytest -q --basetemp=.pytest-tmp
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe smoke_api.py
```

The `.pytest-tmp*` directories are disposable test output. The **122 tests** cover source integrity, tracing, risk, timeline/DNA, summaries, review-action policies, actual PDF text/font/pagination, launcher data preservation, owned Windows process-tree shutdown, and a complete independent replacement-data pipeline. The Windows cleanup regression needs permission to stop its own child processes and is skipped on other operating systems. The development-only PyMuPDF 1.28.2 dependency parses and renders reports; runtime generation uses ReportLab 5.1.0. Licensed DejaVu fonts are bundled under `app/assets/fonts`. Format with `python -m ruff format .`. The smoke script checks Phase 1 endpoints on a temporary loopback server.

For the full local demo use the root `start_demo.bat`; see the [demo guide](../../docs/DEMO_GUIDE.md).
Measure fresh-process ordered first-use and warm HTTP latency with
`python benchmark_demo.py --output ../../docs/performance/modular-api.json`.
This starts/stops its own isolated loopback server and changes no source data.
Both smoke and benchmark commands stop their owned server tree on Windows so
virtual-environment Python children cannot retain a listening port.

Phases 1–6 are verified; see the [Phase 6 review](../../docs/PHASE_6_REVIEW.md), [frontend guide](../frontend/README.md), and [report contract](../../docs/PHASE_5_CONTRACT.md). Tracing remains a FIFO hypothesis, and risk/DNA are measured heuristics. Reports and UI summaries share selected options and evidence. Actions are review suggestions only; source addresses do not establish withdrawal locations, and methods remain unknown. Replacing datasets requires restarting; expected-version report requests reject stale data.
