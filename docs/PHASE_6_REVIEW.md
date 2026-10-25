# Phase 6 implementation and verification

Authorized by "now phase 6" on 25-Oct-2026. This completes local application
polish and demo preparation. Existing evidence contracts, source data, prior
phase artifacts, minimal design, and the taller graph are preserved.

## Delivered behavior

- Clean standby instructions and watermark, a light canvas vignette, short
  staggered node entrances, and animated nonfinancial identifier edges. Reduced
  motion disables these effects. Entrance timers/animations cancel on graph or
  story changes and unmount. Dense graphs keep every transfer while bounding
  animation work; initial layout no longer fits twice.
- Inspector and DNA skeletons reserve panel space while evidence loads. Risk
  scores and key money totals count up with integer-paise interpolation, exact
  Indian currency formatting, stable final widths, and final accessible labels.
  Values beyond JavaScript's safe integer range retain their cents. No new
  runtime dependencies were added.
- Backend connection and failed risk states have clear recovery instructions
  and retry. Empty trails explicitly say no money trail was found, retain the
  source explanation, and still support truthful summaries and reports.
- Notifications stay below header popovers and pass pointer events through their
  informational content. Dismiss buttons remain interactive; report-success
  notifications no longer obstruct alert controls.
- [Root Windows launcher](../start_demo.bat) prepares missing dependencies,
  validates/preserves datasets, builds the production frontend, starts hidden
  services, polls readiness, and writes logs to ignored `.demo/`. Verified
  services can be reused; conflicts fail safely. `-Stop` checks process ID,
  executable path, and creation time before stopping launcher-owned services.
  Windows PowerShell 5.1 UTF-8 and JSON-array behavior are handled explicitly.
- [Demo guide](DEMO_GUIDE.md) includes startup/recovery commands, a nine-minute
  narration outline, exact demo settings, and a genuine contribution worksheet.

The user's minimal design takes precedence over decorative dot grids and
continuous pulses. The optional minimap is skipped. This phase adds reliability
and presentation refinements rather than new investigation features.

## Verification

| Check | Result |
| --- | --- |
| Backend pytest | 121 passed |
| Frontend Vitest | 91 passed across 8 files |
| Production Chrome | 46 passed; final number typography also checked across projector/laptop/mobile |
| TypeScript/Vite | Passed, release 0.6.0 |
| Ruff / Prettier / dependencies | Passed; 41 Python files formatted; `pip check` clean |
| Synthetic dataset | Unchanged: 50 complaints, 200 accounts, 2,344 transfers, 249 entities |
| Launcher | Fresh start, verified reuse, owned shutdown, wrong-frontend rejection and failure cleanup passed |

Three 1920×1080 rehearsals select **BH-2026-0005**, INR **4,70,000**, depth **5**,
minimum INR **100**, window **24 hours**. This case has **31 traced accounts,
36 transfers, six split events, and four probable endpoints**. Each rehearsal
traces, inspects measured risk/source evidence, opens DNA/identifier links,
plays/pauses/scrubs the story with notifications, reads the summary, reviews an
action, downloads a real PDF, and checks alerts without browser errors/warnings.
The generator manifest is consulted only by verification to confirm the Gamma
scenario; runtime analysis never reads it.

The independent replacement fixture has six new accounts, two complaints, four
transfers, and one shared phone, with no manifest. Both backend tests and a real
browser using an isolated replacement server verify trace → risk → DNA → summary
→ PDF, with exact INR 1,00,001.35 and entirely different source IDs.

Existing error, retry, stale-response, PDF/version failure, keyboard, notification,
mobile, reduced-motion, projector, graph selection, and readable-label checks
remain in the browser suite. New checks cover skeletons, very large currency,
notification/popover overlap, the three rehearsals, and graph performance.

## Measured performance

Environment: Windows 11 build 26200, Python 3.13.7, Node 22.20.0, Chrome 155,
AMD64 Family 25 Model 80 CPU. Dataset version:
`d0d8a3c9bcbda6f0ec298414400312d6e9011559c357987e28d34ee945846504`.

- [HTTP measurements](performance/phase6-api.json): a fresh isolated backend,
  ordered first-use plus seven warm requests per endpoint, including HTTP
  serialization and loopback transfer. All 64 measured responses across eight
  endpoints were under 500 ms. The slowest first use was DNA, 414.16 ms;
  first PDF was 285.54 ms; startup readiness was 3.39 s and is measured separately.
  Later endpoints benefit from earlier requests' shared analysis caches.
- [50-node graph measurements](performance/phase6-graph.json): three browser
  loads at 1920×1080 with all **1,864** source transfers between those accounts.
  Measurement runs inside the browser from click through real trace HTTP,
  lazy renderer loading, layout, entrance completion, and two stable animation
  frames. All measured renders meet the 2 s target. HTTP cache is warm after the
  first load. This verifies a dense source-derived renderer fixture, not a claim
  that a single complaint contains all those transfers.
- [Before optimization](performance/phase6-graph-before.json): the same fixture
  reached 2.09 s. Bounding financial-edge entrance work and removing duplicate
  initial fitting reduced rendering time while preserving every edge. Readability
  and API semantics remain unchanged.

These are local demo measurements, not production/concurrent-load guarantees or
performance claims for arbitrarily larger datasets. No API algorithm change was
needed to meet the measured target.

## Artifacts and remaining team actions

- [Rehearsal 1](screenshots/phase6-rehearsal-1.png),
  [2](screenshots/phase6-rehearsal-2.png), [3](screenshots/phase6-rehearsal-3.png)
- [Largest-case PDF](reports/phase6-1-FraudGPS-BH-2026-0005-Investigation.pdf)
  and [rendered cover](screenshots/phase6-report-cover.png)
- [Replacement-data workspace](screenshots/phase6-replacement.png) and
  [PDF](reports/phase6-replacement-FraudGPS-BH-2026-9901-Investigation.pdf)
- [Mobile](screenshots/phase6-mobile.png), [laptop](screenshots/phase6-laptop.png),
  [account alerts](screenshots/phase6-alerts.png)

The team must record its own narrated video, fill in actual contributions,
confirm current portal requirements, and perform its submission. Those external
team actions are not completed by a local code implementation. Hosting, real
financial data, and operational bank/telecom actions remain outside this scope.

See [the contract](PHASE_6_CONTRACT.md) and [demo guide](DEMO_GUIDE.md) for commands.
