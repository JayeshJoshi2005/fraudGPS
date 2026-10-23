# Decisions and Source Discrepancies

## How to use this record

User instructions take priority. Entries marked **working proposal** guide planning but are not finalized architecture. Resolve each entry before its affected phase; record rationale and verification impact here rather than silently changing source documents.

| ID | Status | Decision or discrepancy | Impact |
| --- | --- | --- | --- |
| D01 | Confirmed user direction | User explicitly authorized Phases 0, 1, and 2 after planning. Work locally, one prompt phase at a time, advancing only on explicit direction. Hosting/cloud deferred. | All phases |
| D02 | Accepted | Use prompt numbering 0–6 rather than the PDF's different hourly phase plan. | Tracking |
| D03 | Implemented foundation | JSON input through `app/repository.py`; no database or graph dependency in the loader. In-memory analysis follows in Phase 1. PDF p. 19 permits JSON instead of PostgreSQL. | Phase 0 |
| D04 | Implemented | Complaint list/detail APIs are included in Phase 1 as the Phase 2 prerequisite; DNA remains Phase 4. | Phases 1–2 |
| D05 | Implemented | NetworkX MultiDiGraph keyed by transaction ID preserves every repeated transfer; entity linkage is a separate bipartite graph. | Phase 1 correctness |
| D06 | Implemented | Use prompt weights: anomaly .20, graph .20, complaints .20, temporal .15, dormancy .10, entity overlap .15. DNA remains separate, avoiding circular risk. Every score exposes formulas and evidence. | Phases 1, 4 |
| D07 | Implemented | Merge requires one transfer to consume receipts from distinct senders within 30 minutes. Layering reports elapsed time, retained amount, and decay for maximal pass-through chains. See Phase 1 contract and independent tests. | Phase 1 |
| D08 | Implemented | Vite + React + TypeScript with Tailwind's Vite plugin; `npm start` serves port 3000. Versions are pinned with a lockfile. Native semantic controls and CSS/Cytoscape animations avoid unused UI dependencies. | Phase 2 |
| D09 | Implemented | Follow Prompt 2: node size/color encode risk; victim blue diamond overrides fill, and probable terminals use a dark square with risk border. Edge width encodes amount. Visible legend documents these encodings. | Phase 2 |
| D10 | Scope boundary | PDF includes narrative DNA, dormant-mule roles, and extra entity matching. Prompts implement three DNA types and fewer roles. Keep omitted features explicit in the backlog until requested. | Phases 1, 4 |
| D11 | Working proposal | Templates and reproducible precomputation are acceptable; invented analysis is not. Document synthetic data, fixtures, algorithms, and limitations. Prompt language about hiding mocks does not establish real evidence. | All phases |
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

## Deferred work

Hosting, cloud infrastructure, production databases, live financial feeds, operational account freezing, authentication/authorization, production audit and retention policies, geographic/Sankey visualizations, GNNs, and LLM-generated text require later scope and design work.

Verification: [Phase 0](PHASE_0_REVIEW.md), [Phase 1](PHASE_1_REVIEW.md), and [Phase 2](PHASE_2_REVIEW.md). Later-phase decisions remain open as indicated. Revisit technical choices during their phase, using current official documentation when selecting dependencies.
