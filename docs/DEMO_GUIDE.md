# Local demo and recording guide

## Start and stop

Prerequisites: Windows PowerShell 5.1+, Python 3.13, and Node.js 22.12+ with npm.
From the repository root, double-click `start_demo.bat` or run:

```powershell
.\start_demo.bat
```

The launcher creates the local Python environment when absent, installs missing
pinned backend/frontend dependencies, validates existing records, builds the
production frontend, and polls both services until ready. Dependency installation
needs internet access. Once dependencies are installed, normal startup is local.
Logs and process ownership records live in ignored `.demo/`.

```powershell
.\start_demo.bat -SkipInstall          # Offline: fail clearly if dependencies are missing
.\start_demo.bat -SkipInstall -NoBuild # Reuse an already verified production build
.\start_demo.bat -CheckOnly            # Prepare/check everything without starting services
.\start_demo.bat -Stop                 # Stop only launcher-owned processes
```

Open [the workspace](http://127.0.0.1:3000), which starts in the Cases library, and
[the API documentation](http://127.0.0.1:8000/docs). Existing services are reused
only when their backend identity/version/dataset and frontend HTML match. Conflicts
produce an error without terminating the conflicting process. Stop/restart after
changing code or datasets. If a service was started manually, stop it in its own
terminal; `-Stop` deliberately leaves it running. Ownership checks compare process
ID, executable path, and creation time before stopping the owned process tree,
including the Windows virtual-environment Python child. Executable paths come
from the launch command rather than a process property that may still be empty
immediately after creation.

Existing complete datasets are validated and preserved. Partial, invalid, or
nonempty interrupted datasets fail without regeneration. Only a completely absent
dataset is generated. `FRAUD_GPS_DATA_DIR` supports an alternate conforming dataset;
see [the source contract](../fraud-gps/backend/DATA_CONTRACT.md).

## Nine-minute recording script

Use 1920×1080, hide unrelated windows, and start both services before recording.
Select **BH-2026-0005** (INR 4,70,000), the largest Gamma complaint in the verified
synthetic dataset. Set **Trace depth to 5**; leave minimum INR 100 and window 24 h.
This selects a complete observation window with four probable endpoints. Depth 4
cuts the trail earlier and does not establish those endpoints.

| Time | Demonstration and explanation |
| --- | --- |
| 0:00–0:45 | Explain the problem: complaint records and transfers need a connected, inspectable trail. Introduce Fraud GPS and synthetic demo data. |
| 0:45–1:30 | Explain React/TypeScript → FastAPI → validated JSON → graph/tracing/risk/DNA engines. NetworkX preserves parallel transfers; routes remain thin. No external model or cloud dependency is needed. |
| 1:30–2:40 | Open the largest case from Cases. Open Case controls, set depth 5, and click Trace with these options. Money Trail opens with the victim diamond, 31 accounts, six split events, and four probable endpoints. Explain arrow direction, exact INR formatting, and Fit/Expand controls. |
| 2:40–3:40 | Inspect the highest-risk node. Show measured risk components, account details, and evidence IDs. Explain selected-trail roles versus dataset-wide risk and why the score is a heuristic. |
| 3:40–4:55 | Play the story, pause, change speed, step backward/forward, and scrub. Point out split/risk/link notifications. Explain conserved seed funds versus repeated hop volume. |
| 4:55–6:05 | Find Linked Cases opens the Fraud DNA page. Show shared phone/device identifiers, similar cases, and the weighted signature. Open one entity's supporting source references; View connections on graph shows distinct purple dashed nonfinancial edges. |
| 6:05–7:00 | Open Case Summary. Read the factual narrative and inspect a recommendation's evidence. Mark one item reviewed. Explain that the checklist records local review and sends no request. |
| 7:00–7:50 | Generate Report, open the PDF, and show complaint, trail, suspicious accounts, DNA, and recommendations. Explain that the six sections paginate to preserve all evidence. |
| 7:50–8:30 | Show ranked account alerts and recovery behavior. Mention exact currency, stale-response guards, reduced motion, and the verified independent replacement dataset. |
| 8:30–9:00 | Explain the measured performance and limitations. End on the clear full trail. State that endpoints do not prove withdrawals and methods remain unknown. |

Record real narration and the actual screen. Keep the final recording within the
official duration after checking the current portal requirements. The recording,
Drive permissions, and portal submission are team actions; this guide does not
upload or submit anything.

## Contribution worksheet

Each member should fill in genuine work, file/module ownership, decisions, tests,
and commit references. Do not assign historical contributions from this template.

| Member | Work actually performed | Files / commits | Decision they can explain | Verification they performed |
| --- | --- | --- | --- | --- |
| Member 1 | Fill in | Fill in | Fill in | Fill in |
| Member 2 | Fill in | Fill in | Fill in | Fill in |
| Member 3 | Fill in | Fill in | Fill in | Fill in |
| Member 4, if applicable | Fill in | Fill in | Fill in | Fill in |

Everyone should be able to explain FIFO attribution, splits/merges/cycles, risk
bounds, identifier links, dataset replacement, evidence provenance, and one
failure/retry flow. See [the hackathon alignment](HACKATHON.md) for the previously
reviewed submission requirements and unresolved schedule details.

## Repeat verification

```powershell
cd fraud-gps/backend
.\.venv\Scripts\python.exe -m pytest -q --basetemp=.pytest-tmp-final
.\.venv\Scripts\python.exe benchmark_demo.py --output ../../docs/performance/modular-api.json
cd ../frontend
npm.cmd test
npm.cmd run test:e2e
```

Stop demo servers before browser checks; Playwright owns ports 8000 and 3000.
The suite performs three complete largest-case rehearsals, a 50-node rendering
measurement, replacement-data UI/PDF verification, and error/mobile checks.
