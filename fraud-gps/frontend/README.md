# Fraud GPS frontend — Phase 2

React/TypeScript investigation workspace with a live Cytoscape transaction graph.
Vite serves development on port 3000; the FastAPI backend runs on port 8000.
Everything uses synthetic records from the backend. No cloud service is required.

## Start locally

Tested on Windows with Node **22.20.0**, npm **10.9.3**, and Python **3.13.7**.
Node 22.12 or newer is required. See the [backend guide](../backend/README.md) if
its virtual environment or datasets have not been prepared.

Start the backend in one PowerShell terminal:

```powershell
cd E:\cyberHack\fraud-gps\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Start the frontend in another:

```powershell
cd E:\cyberHack\fraud-gps\frontend
npm.cmd ci
npm.cmd start
```

Open **http://127.0.0.1:3000**. `npm.cmd` avoids PowerShell's restriction on `npm.ps1`;
ordinary `npm` works in Command Prompt and other supported shells. On macOS/Linux,
use `.venv/bin/python` for the backend. Those operating systems have not been tested.
Dependencies are pinned in `package.json` and `package-lock.json`.

## Investigation flow

1. Select a complaint. The victim, authoritative masked account label, reported loss,
   scam type, date, and source description populate the case card.
2. Choose depth (1–7; default 4) and minimum transfer (INR 0–1,00,000; default 100).
   Click **Trace Funds**. Changing either option clears the old result before retracing.
3. Inspect an account by clicking a node; inspect a transfer by clicking an edge.
   **Browse records** provides equivalent keyboard-accessible account/transfer buttons.
4. Right-click a node or use **Expand neighborhood** in the inspector to load its
   one-hop context. Cyan dashed edges are traced transfers; added context is dimmed.
   **Clear expansion** restores the original trail.
5. Use Graph for a force layout, Route for directed layers, or Cluster for grouping by
   bank. Bank groups do not imply criminal campaigns. Suspicious-only displays risk
   scores >=0.50 plus the victim and removes edges with hidden endpoints.

Search covers all loaded complaint IDs/victim names and account IDs/masked labels/holder
names. Multiple matches retain stable internal IDs to disambiguate masking collisions.
Zoom, pan, hover details, fit, and reset-layout controls are functional. Risk controls
node color/size; victims are blue diamonds and probable endpoints are dark squares with
risk-colored borders. Parallel transfers remain separate edges.

The inspector shows source account details, bounded risk components and formulas,
source evidence IDs, inflow/outflow, unique counterparties, linked complaints, and
amount-weighted observed FIFO forwarding time. No observed forwarding displays
**Not observed**. Account age includes its observation date and does not imply dormancy.

The status strip shows the trace's transfer time range. Timeline playback, linked-case
DNA, reports, and alert navigation remain future phases; their controls are disabled or
non-interactive with phase labels. The header risk count is derived from the full dataset.

## Configuration and data integrity

Copy `.env.example` to `.env.local` to override `VITE_API_BASE_URL`; default:
`http://127.0.0.1:8000/api`. Vite reads it at startup/build time. Restart after editing.
The backend permits explicit localhost/127.0.0.1 origins on port 3000. The optional Vite
`/api` proxy targets the same local backend; the default client uses its explicit origin.

Requests have timeouts and AbortSignals. Case/filter changes discard obsolete requests,
results, expanded graphs, selections, and animation timers. Node inspection is isolated
by selection; delayed evidence cannot overwrite a newer selection. Dataset-version
mismatches are rejected. **Reload workspace** refreshes cases and catalog after a backend
dataset change. Errors support retries for startup, tracing, inspection, and expansion.

Amounts stay decimal strings; `formatCurrency` uses BigInt to avoid rounding large INR
values. Dates/times use Asia/Kolkata. Numbers are used only for sliders and visual edge
scales. Seed funds are separate from repeated hop volume; no recovered money is claimed.

## Build and verification

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run format:check
npm.cmd run test:e2e
```

- Build checks strict TypeScript and emits `dist/`. The graph renderer loads separately.
- Vitest: 14 tests for exact formatting, timezone boundaries, masks, graph filtering,
  parallel-edge preservation, attribution preservation, and mixed dataset rejection.
- Playwright: 9 tests using installed **Google Chrome**, the actual local backend, and
  Vite. Stop other servers on ports 8000 and 3000 first; tests own and stop their servers.
  Tests include node clicks, right-click expansion, inspector, record selection, layouts,
  search, empty results, retry, delayed-response races, dataset mismatch, and mobile overflow.
- Prettier is the frontend formatter (`npm.cmd run format`). No separate frontend linter
  is configured. Backend Ruff remains unchanged.

Browser tests write failure diagnostics under ignored `test-results/` and representative
screenshots under [docs/screenshots](../../docs/screenshots). A restricted Windows runner
may need permission to stop its child servers; ordinary user-shell runs complete normally.
Injected abort tests can produce a Windows asyncio connection-reset diagnostic without
failing the browser flow. The successful normal flow is checked for browser console errors.

`npm.cmd run preview` serves the built frontend on port 3000, with the backend still needed.
Browser verification used the development server; the production bundle was build-checked.

See [Phase 2 review](../../docs/PHASE_2_REVIEW.md) and [implementation decisions](../../docs/PHASE_2_CONTRACT.md).
