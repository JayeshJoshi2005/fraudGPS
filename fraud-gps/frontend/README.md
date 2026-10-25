# Fraud GPS frontend — Phases 2–6

React/TypeScript investigation workspace with a live Cytoscape transaction graph.
Vite serves development on port 3000; the FastAPI backend runs on port 8000.
Everything uses synthetic records from the backend. No cloud service is required.

## Start locally

For the ready demo, run `start_demo.bat` from the repository root. It builds this
frontend and starts both services after validation. See the
[demo guide](../../docs/DEMO_GUIDE.md) for prerequisites, offline/reuse/stop options,
and the nine-minute recording outline. Manual development commands follow.

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

The application opens in **Cases**, with a searchable case library, scam-type
filter, source totals, and a selected complaint. Navigation separates **Cases**,
**Money Trail**, **Fraud DNA**, and **Case Summary**. Desktop has a side rail;
mobile keeps those sections in a bottom navigation bar. Section URLs use hashes
and support browser back/forward. The case, analysis, graph camera, and review
marks survive section changes; leaving the trail pauses playback.

1. Open a case file or use **ACTIVE CASE** in the header. Its source details are
   available in the case settings drawer; account labels remain authoritative masks.
2. Open **Case controls** (the sliders icon). Choose depth (1–7; default 4), minimum
   transfer (INR 0–1,00,000; default 100), and forwarding window (1–168 hours;
   default 24). **Trace with these options** closes the drawer and opens Money Trail.
   Changing analysis options clears old results before retracing.
3. Inspect an account by clicking a node; inspect a transfer by clicking an edge.
   **Browse records** provides equivalent keyboard-accessible account/transfer buttons.
4. Right-click a node or use **Expand neighborhood** in the inspector to load its
   one-hop context. Solid cyan arrows are traced transfers; added context is dimmed.
   **Clear expansion** restores the original trail.
5. Route is the default, with transfers arranged from left to right. Crowded hops wrap
   into staggered columns on short laptop screens. Use Graph for a force layout or Cluster for grouping by
   bank. Bank groups do not imply criminal campaigns. Suspicious-only displays risk
   scores >=0.50 plus the victim and removes edges with hidden endpoints.

Search covers all loaded complaint IDs/victim names and account IDs/masked labels/holder
names. Multiple matches retain stable internal IDs to disambiguate masking collisions.
Zoom, pan, hover details, fit, and reset-layout controls are functional. Risk controls
node border color/size; victims are blue diamonds and probable endpoints are dark squares with
risk-colored borders. Parallel transfers remain separate edges. Labels stay at 13 rendered
pixels while zooming. Account evidence opens beside the graph, or as a dismissible
overlay on mobile. The expand icon temporarily hides navigation for a focused graph.
DNA and summaries have their own pages. Mobile starts with a readable part of the
trail; drag to explore or use **Fit graph** for the full network. Settings trap
keyboard focus, close with Escape, and restore focus to the opening control.

The inspector shows source account details, bounded risk components and formulas,
source evidence IDs, inflow/outflow, unique counterparties, linked complaints, and
amount-weighted observed FIFO forwarding time. No observed forwarding displays
**Not observed**. Account age includes its observation date and does not imply dormancy.

6. Click **Replay Trail** in the graph toolbar or Play in the bottom strip. Replay starts
   with the victim and follows the ordered API events. Pause, previous/next, the
   scrubber, event markers, and milestone pills all use the same event sequence.
   Choose 0.5x, 1x, 2x, or 3x. Replay restarts; bottom Play resumes a paused trail
   and restarts at completion. The eye button restores the full investigation.
7. Significant events show cards anchored to their rendered account positions.
   Cards follow zoom/pan and remain inside the canvas. Role tags appear below
   accounts involved in the current event; overview shows a role tag only on the selected account.
   Completion shows full-trail counts, even with display filters.
   **Full trail statistics** in case settings counts seeded funds once and deduplicates
   endpoint accounts. Hover each statistic for its definition.

Replay is event-paced (one second per event at 1x), with IST timestamps showing the
actual evidence time. Transfers light exact edges; splits highlight measured outputs;
rapid forwards are orange; probable endpoints are dark with red receipt edges; layering
chains cascade at 150ms/account. Context and unrevealed elements are dimmed. Reduced
motion suppresses pulses, fades, and dash movement while retaining all controls.
Cards expire after three seconds of active playback; pause freezes their remaining
time. Seeking reconstructs the graph directly. Changing a case/options, retracing,
reloading, or unmounting clears old playback; hiding the tab pauses it.

The first demo case at the default four hops reaches a depth cutoff. Increase to
five hops and trace again to include four distinct probable endpoints. These are
inferred endpoints, with unknown withdrawal methods. The existing demo dataset has
no qualifying layering detection; that renderer is verified with an independent
chain fixture. The generator and datasets are unchanged.

8. Click **Find Linked Cases** after a nonempty trace, or open the **Fraud DNA**
   section and click **Analyze Fraud DNA**. The full page groups the signature,
   component weights, inferred family, identifiers, similar cases, behavior, and
   topology. **View connections on graph** returns to the trail with its distinct links.
9. Expand an identifier to see current accounts, external peers, and other case IDs.
   Its relations highlight in purple when viewed on the graph. Select an account
   to return to its inspector, or a similar case to load its real trace. Sections retain
   successful analysis. Case/options/retrace/reload discard it and cancel requests.
10. Purple dashed graph lines are **shared identifiers**, with no arrowheads or
    financial fields. Inspect one through **Browse records** for source IDs.
    **Hide DNA links** or the summary-card close button removes DNA graph context;
    **Show DNA links** restores it. Replay dims these links and never animates them
    as money. Route layout ignores identifier edges when deriving transaction layers.

DNA uses source-derived comparisons at the current trace options, with
**40% entity / 35% behavioral / 25% network** weighting. The displayed components
all belong to the same closest other case. Inferred families use neutral names
such as “Family 01 · Night activity”; prepared campaign labels are not used.
An inferred family, a shared-identifier link, and a pattern-only similarity are
different findings. Empty identifier/network evidence is not a perfect match.
Missing forwarding/dormancy stays **Not observed**; withdrawal method is **Unknown**.

The demo derives families of 30, 16, and 4 cases. The first case at four hops has
54 shared-identifier records linking 45 other complaints, and seven drawable
relations. Lone Wolf has three other same-family cases sharing reused accounts,
with no external relation to other families. No fake self-edge is drawn.

11. Open the **Case Summary** section or its shortcut below the graph. The narrative
    and recommended review actions come from the backend at the active trace options.
    Checkmarks persist across tab switches for this trace, reset on a new trace,
    and record review only. Supporting evidence opens accounts and related cases.
12. Click the header's **High-risk alerts** badge for ranked dataset-wide accounts,
    measured reasons, and **Investigate** navigation. This expands/selects/centers an
    account even when outside the current trail. Alerts can retry failed requests.
13. **Generate Report** in the header or **Download investigation PDF** in the summary
    exports the active trace. The button shows generation progress, downloads a named
    PDF, and reports success or failure. Failed exports can retry. Case/filter changes
    cancel stale downloads; invalid content and dataset versions are rejected.

Newly played events produce up to four notifications, each lasting four seconds.
They use observed split amounts, dataset-wide risks, account complaint links, and
probable endpoints. Seeking does not backfill historical notifications. Endpoint
messages retain unknown withdrawal method. Timers clear on case changes/unmount.

The header keyboard icon reveals shortcuts on hover or click: **Space** plays/pauses,
**Left/Right** steps, **F** fits, **R** replays, and **Escape** deselects. Typing,
native controls, modifier combinations, handled events, and repeated keys are respected.

The header risk count is dataset-wide. Sidebar other-complaint counts use account
links; DNA's linked-case count uses shared identifiers. Reports have six sections
and may span additional pages for long evidence tables. No action freezes accounts,
requests records, or contacts agencies. All records remain synthetic.

## Configuration and data integrity

`App.tsx` assembles independent workspace modules. `useInvestigationWorkspace`
owns shared state and delegates analysis to the existing typed hooks.
`useWorkspaceNavigation` owns hash/history navigation. Views live in
`src/components/workspace/`; the obsolete all-purpose sidebar has been removed.

Copy `.env.example` to `.env.local` to override `VITE_API_BASE_URL`; default:
`http://127.0.0.1:8000/api`. Vite reads it at startup/build time. Restart after editing.
The backend permits explicit localhost/127.0.0.1 origins on port 3000. The optional Vite
`/api` proxy targets the same local backend; the default client uses its explicit origin.

Requests have timeouts and AbortSignals. Case/filter changes discard obsolete requests,
results, expanded graphs, selections, and animation timers. Node inspection is isolated
by selection; delayed evidence cannot overwrite a newer selection. Dataset-version
mismatches are rejected. **Reload workspace** refreshes cases and catalog after a backend
dataset change. Errors support retries for startup, tracing, inspection, expansion, and
the timeline and DNA independently. A failed DNA/timeline request keeps the valid
trace available. DNA response validation checks dataset/options, the weighted score,
self exclusion, and identifier relation provenance before drawing any links.

Amounts stay decimal strings; `formatCurrency` uses BigInt to avoid rounding large INR
values. Dates/times use Asia/Kolkata. Financial amounts never use Number for arithmetic;
counts, measured time intervals, sliders, and visual scales use numbers. Seed funds are
separate from repeated hop volume; no recovered money is claimed.

## Build and verification

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run format:check
npm.cmd run test:e2e
```

- Build checks strict TypeScript and emits `dist/`. The graph renderer loads separately.
- Vitest: 99 tests for exact formatting, timezone boundaries, masks, graph filtering,
  parallel-edge preservation, attribution preservation, timeline integrity, pure prefix
  reconstruction, controls/cadence, layering cascade cleanup, card positioning,
  DNA validation, midnight windows, nonfinancial relation preservation/filtering,
  and action-specific account/entity/transfer/case evidence validation.
- Playwright: 50 tests using installed **Google Chrome**, the actual local backend, and
  the production frontend. The script builds first, then serves `npm run preview`.
  Stop other servers on ports 8000 and 3000 first; tests own and stop their servers.
  Tests include node clicks, right-click expansion, inspector, record selection, layouts,
  search, empty results, retry, delayed-response races, dataset mismatch, and mobile overflow.
  Playback tests check all speeds, step/drag/seek equivalence, pause, replay, complete
  autoplay, event cards, zoom/pan anchoring, role tags, dimmed expansion, filtered totals,
  timeline errors/version mismatch, delayed requests, tab visibility, and timer cleanup.
  DNA tests cover real analysis/campaigns, masked evidence, highlighted relations,
  nonfinancial inspection, similar-case navigation, retry, stale responses, dataset
  and score mismatches, graph filtering/hiding/replay, independent Lone Wolf, mobile
  layout, and keyboard tab navigation. Phase 5 adds actual PDF download/failure/retry,
  content/version checks, stale download/summary cancellation, local checklist state,
  alert navigation, guarded shortcuts, toast lifecycle, and mobile/empty-trail reports.
  Normal flows check browser errors/warnings.
  Phase 6 adds three largest-Gamma rehearsals, skeleton/large-currency/reduced-motion
  checks, a measured dense 50-node render, and an isolated replacement-data server
  through the real UI/PDF pipeline. Prior phase artifacts are preserved.
  Modular-workspace checks cover case filtering, native history, graph-camera and
  checklist preservation, drawer focus/Escape, mobile navigation, deep-link recovery,
  and paused playback across sections. Existing flows use the settings drawer.
- Prettier is the frontend formatter (`npm.cmd run format`). No separate frontend linter
  is configured. Backend Ruff remains unchanged.

Browser tests write failure diagnostics under ignored `test-results/` and representative
screenshots under [docs/screenshots](../../docs/screenshots). A restricted Windows runner
may need permission to stop its child servers; ordinary user-shell runs complete normally.
Injected abort tests can produce a Windows asyncio connection-reset diagnostic without
failing the browser flow. The successful normal flow is checked for browser console errors.

`npm.cmd run preview` serves the built frontend on port 3000, with the backend still needed.
Phase 3 browser verification uses the production bundle. Early development-server runs
had intermittent cold module-loading stalls under low available Windows memory; serving
the built bundle avoids that test-runner dependency.

See [Phase 3 contract](../../docs/PHASE_3_CONTRACT.md),
[Phase 4 contract](../../docs/PHASE_4_CONTRACT.md),
[Phase 4 review](../../docs/PHASE_4_REVIEW.md), and the historical
[Phase 2 review](../../docs/PHASE_2_REVIEW.md).
