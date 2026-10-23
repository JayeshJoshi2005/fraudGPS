# Decisions and Source Discrepancies

## How to use this record

User instructions take priority. Entries marked **working proposal** guide planning but are not finalized architecture. Resolve each entry before its affected phase; record rationale and verification impact here rather than silently changing source documents.

| ID | Status | Decision or discrepancy | Impact |
| --- | --- | --- | --- |
| D01 | Confirmed user direction | User explicitly authorized Phases 0–4 after planning. Work locally, one prompt phase at a time, advancing only on explicit direction. Hosting/cloud deferred. | All phases |
| D02 | Accepted | Use prompt numbering 0–6 rather than the PDF's different hourly phase plan. | Tracking |
| D03 | Implemented foundation | JSON input through `app/repository.py`; no database or graph dependency in the loader. In-memory analysis follows in Phase 1. PDF p. 19 permits JSON instead of PostgreSQL. | Phase 0 |
| D04 | Implemented | Complaint list/detail APIs are included in Phase 1 as the Phase 2 prerequisite; DNA remains Phase 4. | Phases 1–2 |
| D05 | Implemented | NetworkX MultiDiGraph keyed by transaction ID preserves every repeated transfer; entity linkage is a separate bipartite graph. | Phase 1 correctness |
| D06 | Implemented | Use prompt weights: anomaly .20, graph .20, complaints .20, temporal .15, dormancy .10, entity overlap .15. DNA remains separate, avoiding circular risk. Every score exposes formulas and evidence. | Phases 1, 4 |
| D07 | Implemented | Merge requires one transfer to consume receipts from distinct senders within 30 minutes. Layering reports elapsed time, retained amount, and decay for maximal pass-through chains. See Phase 1 contract and independent tests. | Phase 1 |
| D08 | Implemented | Vite + React + TypeScript with Tailwind's Vite plugin; `npm start` serves port 3000. Versions are pinned with a lockfile. Native semantic controls and CSS/Cytoscape animations avoid unused UI dependencies. | Phase 2 |
| D09 | Implemented | Follow Prompt 2: node size/color encode risk; victim blue diamond overrides fill, and probable terminals use a dark square with risk border. Edge width encodes amount. Visible legend documents these encodings. | Phase 2 |
| D10 | Scope boundary | PDF includes narrative DNA, dormant-mule roles, and extra entity matching. Prompts implement three DNA types and fewer roles. Keep omitted features explicit in the backlog until requested. | Phases 1, 4 |
| D11 | Implemented through Phase 4 | Templates and reproducible calculation are acceptable; invented analysis is not. DNA uses source-derived comparisons with documented thresholds and no prepared campaign truth/scores. Synthetic data, fixtures, algorithms, and limitations are documented. | All phases |
| D12 | Accepted | Source records contain transfers only. Generated terminal accounts are probable cash-out endpoints; withdrawal method remains unknown. Later UI/reports must not assert ATM/merchant/crypto activity without additional evidence. | Phases 0–5 |
| D13 | Implemented | Strict chronological FIFO; capped exact amounts; initial hop counts as depth 1; default depth 5, minimum INR 100, forwarding window 24 hours. GET filters share these rules. UI can explicitly request depth 4. Roles, thresholds, ties, and conserved totals are specified in [PHASE_1_CONTRACT.md](PHASE_1_CONTRACT.md). | Phase 1 contracts |
| D14 | Implemented for Phase 2 | Graph = force layout; Route = directed layers; Cluster = bank grouping, not inferred campaigns. Local search spans paginated complaints and full graph accounts; risk display filtering preserves the victim and removes orphan edges. Summaries are in trace responses; recommendation/report UI remains Phase 5. | Phases 2, 5 |
| D15 | Partially implemented | Local CORS defaults to explicit localhost/127.0.0.1 origins on port 3000; wildcard config is rejected. Readiness-based demo scripts remain Phase 6. | Phases 0, 6 |
| D16 | Official evaluation constraint | Judges may supply alternate datasets. Prepared synthetic campaigns are demonstration fixtures; analysis must remain data-driven. See [hackathon alignment](HACKATHON.md). | Phases 0, 1, 4, 6 |
| D17 | Must verify | Official FAQ/guidelines dates conflict with homepage placeholders. Plan conservatively and verify the portal's current cutoff before submission. | Submission |
| D18 | Implemented | Stable internal `ACC-NNNNNN` IDs are separate from `XXXXNNNN` display labels. Complaints include `initial_tx_id` to anchor their source transfer; generated complaint IDs use the reference year. Monetary JSON values are exact decimal INR strings. | Phase 0 contract |
| D19 | Implemented | Account ages include `age_as_of` and are measured at first observed activity, preserving 30–90 day mule ages in historical scenarios. This is not a dormancy measurement. | Phase 0 contract |
| D20 | Implemented | Retain generator scenario truth and expected roles in `manifest.json`, outside the four runtime datasets. The generic loader validates conforming alternate data without demo counts or campaign names. | Phases 0–4 |
| D21 | Implemented prerequisite | Add `GET /api/accounts/{account_id}` for source account details, counterparty counts, complaint links, and observed amount-weighted FIFO forwarding delay. Null means no observed match. This fills the inspector's source-data gap without inventing display values. | Phase 2 |
| D22 | Implemented | Step 0 is victim-only; step N is the first N validated API events. Pure prefix reconstruction drives playback, stepping, and scrubbing. Timeline version is supplied through a CORS-exposed header, retaining the original array contract. | Phase 3 |
| D23 | Implemented | Funds traced uses seed amount; endpoints count distinct accounts; fastest forward uses positive attributed parent/child lag; duration excludes endpoint window waits; other complaint count excludes self and is an account link, not DNA similarity. | Phase 3 |
| D24 | Implemented | Browser tests build first and serve the production bundle with Vite preview, avoiding intermittent development-module stalls under low Windows memory. No new dependencies. Demo layering remains absent unless source data qualifies; independent fixture tests verify its renderer. | Phase 3 verification |
| D25 | Implemented | Pairwise entity Jaccard, available-weight behavior and measured topology comparisons feed .40/.35/.25 composite scores. All components refer to the same highest-scoring other case; self is excluded. Missing evidence is explicit. | Phase 4 |
| D26 | Implemented | Inferred families are components of pairs with entity >=.25 and signature >=.65. Stable member-hash IDs and neutral activity-based names replace generator label lookup. Loss sums each complaint once; transitivity does not imply direct pairwise evidence. | Phase 4 |
| D27 | Implemented | Identifier graph edges have a separate kind/provenance, no arrows or financial fields, bounded output, and dedicated inspection. Route layers ignore them; replay dims them as context. Case/options changes abort DNA and clear its graph/report state. | Phase 4 |
| D28 | Implemented UI refinement | Route is the default with deterministic left-to-right transfer flow and wrapped columns on short screens. Graph remains force-directed and Cluster groups by bank. Panels are optional; labels stay at 13 rendered pixels. Identifier relations do not determine transaction depth. See [UI refresh review](UI_REFRESH_REVIEW.md). | User-directed graph visibility |

## Deferred work

Hosting, cloud infrastructure, production databases, live financial feeds, operational account freezing, authentication/authorization, production audit and retention policies, geographic/Sankey visualizations, GNNs, and LLM-generated text require later scope and design work.

Verification: [Phase 0](PHASE_0_REVIEW.md), [Phase 1](PHASE_1_REVIEW.md), [Phase 2](PHASE_2_REVIEW.md), [Phase 3](PHASE_3_REVIEW.md), and [Phase 4](PHASE_4_REVIEW.md). Later-phase decisions remain open as indicated. Revisit technical choices during their phase, using current official documentation when selecting dependencies.
