# Phase Delivery Plan

## Execution rules

Phases 0–6 are **verified locally** following the user's explicit implementation requests. Phase 6 was authorized by "now phase 6" on 25-Oct-2026. See [its review](PHASE_6_REVIEW.md) and [contract](PHASE_6_CONTRACT.md). Hosting requires a separate request.

Within an active phase, team members may divide modules against agreed contracts. Record ownership before editing shared files. Do not pull later features into the phase except a documented prerequisite needed for the current integration.

## Phase 0 — Foundation and synthetic data

Deliver the planned backend structure, dependency manifest, Pydantic schemas, minimal FastAPI startup, router shells, and deterministic synthetic generator. Reserve the frontend directory without building its interface.

- [x] Generate 50 complaints, 200 accounts, 2,000+ transactions, and linked entities in four JSON files.
- [x] Validate unique IDs, references, amounts, timestamps, and model compatibility.
- [x] Verify Gamma, Delta, Lone Wolf, legitimate background activity, and Gamma/Delta entity overlaps; avoid accidental links to Lone Wolf.
- [x] Record seed, reference date, dataset summary, environment setup, and successful API startup.
- [x] Document the dataset input contract and validation so another conforming dataset can replace demo data.
- [x] Stop for Phase 0 review. Evidence: [PHASE_0_REVIEW.md](PHASE_0_REVIEW.md).

## Phase 1 — Graphs, tracing, risk, and APIs

Deliver transaction-preserving graph construction, chronological tracing, pattern detection, roles, weighted risk, factual explanations, case summaries, graph serialization, and timeline events.

- [x] Agree tracing rules and resolve Phase 1 decisions before implementing algorithms.
- [x] Test repeated account-pair transfers, cycles, time ordering, split/merge behavior, forwarding windows, amount bounds, and risk components.
- [x] Verify trace, risk/top risks, full/subgraph/trail graph, timeline, and complaint list/detail APIs.
- [x] Match explanations and summaries to source transaction IDs and measured values.
- [x] Verify behavior on independent datasets without hardcoded campaign or account-ID shortcuts.
- [x] Verify invalid inputs, missing records, and empty trails; record API examples and test results.
- [x] Stop for Phase 1 review. Evidence: [PHASE_1_REVIEW.md](PHASE_1_REVIEW.md).

## Phase 2 — Frontend and graph investigation

Deliver React/TypeScript layout, typed API client, complaint selection, functional search/filters, animated graph, transaction details, neighborhood expansion, inspector, and formatters.

- [x] Resolve the scaffold/toolchain mismatch and define view/filter behavior.
- [x] Trace a complaint through the real local API and inspect an account and transaction.
- [x] Verify masked labels, currency/date formats, graph interaction, loading/error states, and case-switch request handling.
- [x] Keep later DNA/report/replay actions disabled or clearly unavailable until their phases.
- [x] Record screenshots and local validation; stop for Phase 2 review. Evidence: [PHASE_2_REVIEW.md](PHASE_2_REVIEW.md).

## Phase 3 — Timeline and story mode

Deliver playback controls, speeds, scrubber, replay, graph event animation, floating cards, role labels, and complete statistics.

- [x] Verify play/pause, both step directions, speed changes, and scrubbing against the same ordered events.
- [x] Reconstruct the same visible graph for a given step regardless of playback history.
- [x] Clean up animation timers on replay, case changes, and unmount; verify zoomed event-card positioning.
- [x] Define amount statistics without counting the same funds again at each hop.
- [x] Stop for Phase 3 review. Evidence: [PHASE_3_REVIEW.md](PHASE_3_REVIEW.md).

## Phase 4 — Fraud DNA

Deliver entity, behavioral, network, and composite DNA; campaign APIs; typed panel; similar cases; and cross-case graph links.

- [x] Compute or reproducibly precompute scores from source data; document any fixtures.
- [x] Verify the 0.40 entity / 0.35 behavioral / 0.25 network combination and bounded outputs.
- [x] Exclude self-matches; verify expected overlaps and independent Lone Wolf results.
- [x] Keep entity links visually and semantically separate from transfers.
- [x] Verify dataset replacement invalidates cached fingerprints and precomputed similarities.
- [x] Stop for Phase 4 review. Evidence: [PHASE_4_REVIEW.md](PHASE_4_REVIEW.md).

## Phase 5 — Reports, alerts, and summaries

Deliver ReportLab export, six report sections, prioritized recommendations, alert panel, toasts, case-summary checklist, and keyboard shortcuts.

- [x] Open the downloaded PDF and check content, pagination, rupee glyphs, evidence references, and long tables.
- [x] Verify UI and PDF share the same analysis results and do not invent cash-out methods.
- [x] Verify alert navigation, toast cleanup, download failure handling, and shortcuts while typing in form controls.
- [x] Run the full investigation flow; stop for Phase 5 review. Evidence: [PHASE_5_REVIEW.md](PHASE_5_REVIEW.md).

## Phase 6 — Local demo reliability and polish

Deliver visual refinements, robust edge states, local startup script, measured performance, and final demo evidence. Add no new product features.

- [x] Demonstrate Gamma with 31 accounts, six split events, and four probable terminals at depth 5.
- [x] Verify trace → inspect → DNA → replay → summary → report at 1920×1080.
- [x] Check backend unavailable, empty trail, failed risk/DNA request, retry, and no console errors.
- [x] Measure graph/API targets with environment, dataset, and cold/warm conditions recorded.
- [x] Start from documented prerequisites using readiness checks rather than a fixed startup delay.
- [x] Complete three demo rehearsals and record remaining limitations.
- [x] Test an independent replacement dataset; prepare a nine-minute recording script and contribution worksheet in [the demo guide](DEMO_GUIDE.md).
- [x] Stop application scope here; hosting/cloud work needs a separate request.

Team submission tasks remain: record/upload the narrated video, fill in actual
individual contributions, and verify current [hackathon requirements](HACKATHON.md).
These are separate from the completed local application implementation.
