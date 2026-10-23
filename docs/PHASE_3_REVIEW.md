# Phase 3 review — timeline and story mode

Implemented and verified on 23-Oct-2026 following “continue to phase 3”; resumed
after the user's interruption. Owner: Codex. Phase 4 has not been started.

## Delivered behavior

- Live timeline request with identical depth/minimum/window options to the trace.
  Version, ordering, identity, completeness, and source-reference checks prevent
  replaying unrelated or stale evidence. Errors can be retried independently.
- Play/pause, previous/next, 0.5x/1x/2x/3x speeds, native range scrubber, event dots
  with hover descriptions, milestone buttons, IST timestamp, progress, sidebar
  Replay/Pause, and a return-to-overview control.
- Step 0 shows the victim; each step projects the complete event prefix. Backward
  steps and arbitrary scrubs rebuild the same classes, including repeated/cyclic
  transfer IDs. Context/unrevealed elements remain at opacity 0.15. Completion
  reveals every trail element and reports full-trail counts.
- Exact-edge flow/fade, simultaneous split outputs and node pulse, orange rapid
  forwarding, red endpoint receipt edges/dark endpoint nodes, and 150ms/account
  layering cascade. Reduced motion keeps the same evidence and controls without
  transient effects. Pause removes transient effects and leaves a stable prefix.
- Floating significant-event cards with measured amount, description, elapsed time
  where available, and IST timestamp. Rendered positions follow pan/zoom/layout,
  node movement, and resize; positions clamp inside the canvas. Cards retain three
  seconds of active-playback time, with a two-second accent; pause freezes that
  budget. A new significant event replaces the old card. Seeking resets its budget.
- Smaller colored role tags below revealed accounts. Roles remain backend primary
  classifications; an account can also have endpoint evidence. Cash-Out labels use
  “Probable endpoint”. Role tags and canvas overlays do not intercept graph clicks.
- Sidebar statistics: seed funds counted once, account count, split events, deepest
  attributed hop, distinct probable endpoint accounts, fastest observed forwarding,
  observed transfer duration, and other source-linked complaints. Definitions are
  available on hover; depth-cutoff guidance is explicit. Context/filtering does not
  change these full-trace statistics.
- Cancellation and cleanup on new case/options/trace/reload/unmount; hidden tabs
  pause replay. No obsolete timeline request can replace the current case's events.

## Contract changes and modules

`GET /api/timeline/{complaint_id}` retains its array response and adds the
CORS-exposed `X-Dataset-Version` header. Service-produced trace responses add typed
`statistics`; source schemas, datasets, graph contracts, filters, and risk scoring
are unchanged. See [API guide](../fraud-gps/backend/API.md).

`utils/playback.ts` contains the pure control transition, evidence validation, and
event-prefix projection. `useTimeline` owns requests; `usePlayback` owns playback
timing. `TimelineBar`, `Sidebar`, `GraphCanvas`, `graphAnimations`, `StoryOverlay`,
and `TrailStats` provide presentation. Backend statistics remain reusable in
`AnalysisService`, outside HTTP routes. No dependencies were added.

See [Phase 3 contract](PHASE_3_CONTRACT.md) and [architecture](ARCHITECTURE.md).

## Verification

Windows; Python 3.13.7, Node 22.20.0, npm 10.9.3, installed Google Chrome. Same
pinned dependencies as Phase 2. Commands are run from their respective directories.

| Check | Command | Result |
| --- | --- | --- |
| Backend suite | `.\.venv\Scripts\python.exe -m pytest -q --basetemp=.pytest-tmp-phase3` | **86 passed** |
| Backend lint/format | `.\.venv\Scripts\python.exe -m ruff check app tests`; `-m ruff format --check app tests` | Passed; 28 files formatted |
| Dataset verification | `.\.venv\Scripts\python.exe verify_data.py` | Counts/hash unchanged |
| Frontend unit suite | `npm.cmd test` | **30 passed** |
| Strict TS + production build | `npm.cmd run build` | Passed; also run automatically by the browser command |
| Frontend format | `npm.cmd run format:check` | Passed |
| Live Chrome suite | `npm.cmd run test:e2e` | **17 passed in 1.0m** against production frontend + real backend |

Backend additions verify distinct endpoints across multiple receipts, positive
forwarding lag, duration excluding endpoint windows, empty/single-transfer results,
unique other-case IDs excluding self, and CORS/version headers. Existing chronological
attribution and conservation checks remain green.

Unit checks cover malformed, missing, duplicated, reordered, and mismatched timeline
evidence; JSON property-order independence; control boundaries/speed; parallel/cyclic
transfers; prefix reconstruction after arbitrary history; card clamping; and a timed
independent layering chain with all timers cancelled after stop.

The 17 browser checks include the previous nine investigation flows plus all four
speed cadences, pause stability, forward/backward equivalence, actual scrubber drag,
keyboard boundaries, replay/end/overview, cards and exact split outputs, viewport
anchoring, role tags, all-final-element opacity, dimmed expansion, full-trail filtered
totals, complete autoplay, timeline failure/retry, version/source mismatch, stale
responses, case/options/tab cleanup, empty results, reduced motion, and mobile overflow.
Normal investigation/story flows are checked for browser errors; selector warnings
are checked in the story flow.

Early development-server runs encountered a Node allocation failure and intermittent
cold Vite-module load stalls while Windows had roughly 1.1 GB of free virtual memory.
The browser script now builds first and uses `npm run preview`, verifying the actual
production bundle with fewer module requests. The final complete run passed. Browser
tests own and clean up their servers; stop manual servers before running the suite.
Injected request-abort tests can emit a Windows asyncio connection-reset diagnostic.

## Screenshots

- [Ready workspace](screenshots/phase3-ready.png)
- [Account inspector and role tags](screenshots/phase3-inspector.png)
- [Split event during story mode](screenshots/phase3-story.png)
- [Completed five-hop trail](screenshots/phase3-complete.png)
- [Mobile story and statistics](screenshots/phase3-mobile-story.png)

Screenshots were inspected. Test-clock seeks explicitly allow a canvas frame before
capturing, so canvas drawings and DOM overlays represent the same event prefix.
Desktop remains within 1920×1080; mobile at 390×844 has no horizontal page overflow.

## Demonstration and limits

Open the local frontend, select the first complaint, set depth to **5**, trace, and
select **Replay Trail**. It yields **31 accounts, 36 transfers, 6 split events, 4
distinct probable endpoints, and 78 timeline events**, seeded from **₹2,21,000**.
The default four-hop trace has 27 accounts/26 transfers and stops before endpoints;
zero endpoints there is a depth limit, not evidence that no endpoints exist.

The unchanged demo dataset contains no qualifying layering-chain detection at depth
7 across all 50 cases. The renderer is implemented and verified with an independent
chain; no artificial layering events were inserted into demo responses. Money remains
an attribution hypothesis through pooled funds; endpoint methods/current recoverable
balances are unknown. Other complaint counts describe account links and do not claim
Fraud DNA similarity. Replay is event-paced rather than real-time-proportional.

Dataset: 50 complaints, 200 accounts, 2,344 transactions, 249 entities. Hash:
`d0d8a3c9bcbda6f0ec298414400312d6e9011559c357987e28d34ee945846504`.

Phase 3 is complete. Stop for review; DNA, reports, alerts/shortcuts, final performance
targets, demo rehearsals, and hosting remain their later authorized phases.
