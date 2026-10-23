# Phase 4 review — Fraud DNA

Implemented and verified on 23-Oct-2026 following “do phase 4 correctly”. Owner:
Codex. Phase 5 has not been started. Existing Phase 3 work and synthetic datasets
were preserved; no dependency or prepared-score file was added.

## Delivered

- Source-derived entity, behavioral, network, and composite DNA. Every candidate
  uses the current case's depth/minimum/window settings. Self is excluded before
  ranking; components refer to the same best other case. The exact combination is
  **.40 entity + .35 behavioral + .25 network**.
- Masked identifier evidence with stable entity/account/case IDs, current accounts,
  external peers, and actual other-case links. Reused accounts remain single nodes.
  Explicit account queries disclose factual victim links while excluding victims
  from operation fingerprints and family scoring.
- Behavioral fingerprints with exact mean source amount, weighted observed forwarding
  lag, measured splits, circular IST activity windows, depth, channels, and observed
  dormancy when prior records support it. Missing fields remain null; withdrawal
  method is unknown. Account age is never substituted for dormancy.
- Network projections/topology with parallel transfer counts preserved, unique
  degrees, fan-in/out, density, and clustering. Empty evidence scores zero.
- Deterministic inferred campaign families from qualifying case-pair components,
  neutral measured-activity names, stable hashed member IDs, exact reported-loss
  totals counted once per case, and behavioral similar-campaign aggregates.
- Dataset-scoped caches for up to eight method/option contexts; equivalent decimal
  minima share a key. New dataset/service instances rebuild all fingerprints,
  comparisons, memberships, and families. Returned reports are copied defensively.
- Typed `/api/dna/campaigns`, `/api/dna/entity/{account_id}`, and
  `/api/dna/{complaint_id}` routes. Static routes precede dynamic case IDs. Missing
  records use structured 404; invalid options use 422; empty analysis remains 200.
- Right-side Account Inspector/Fraud DNA tabs; signature ring/component meters,
  family membership/loss, expandable masked identifiers, highlighted relationships,
  source account inspection, similar-case navigation into its real trace,
  fingerprint/topology details, loading/error/retry/empty states, and keyboard tabs.
- Purple dashed identifier relations with **no arrowheads, money, channel,
  timestamp, or attribution**; separate legend/counts/inspection and removable
  graph context. The floating DNA summary reports current findings. Route layout
  ignores identifier edges when deriving money layers; replay dims them as context
  and never animates them as transfers. Filters remove orphan relations.
- Cancellation and source checks on case/options/retrace/reload. Late DNA responses
  cannot replace the new case. A failed DNA request preserves the investigation.
  The client rejects mixed versions, inconsistent composite scores, self matches,
  mismatched options, and invalid relation provenance before drawing links.

## Methods and interpretation

See the finalized [Phase 4 contract](PHASE_4_CONTRACT.md) and
[API guide](../fraud-gps/backend/API.md) for all formulas, feature weights, thresholds,
missing-data rules, evidence fields, and limits. Components are matching heuristics,
not calibrated probabilities or proof of wrongdoing/common ownership.

Entity scoring is Jaccard overlap on source identifiers. Behavior uses available-
weight scalar ratios and histogram intersections; coverage is exposed. Network
uses measured projected topology features. A family requires pairwise entity >=.25
and signature >=.65, followed by connected components with at least two cases.
Transitivity does not invent direct entity evidence between every family pair.
Identifier-linked cases, pattern-only similarity, and inferred family membership
are distinct findings and are labeled separately in the UI.

The engine never reads `manifest.json`, campaign truth/names, or canned similarity
fixtures. Inferred families are named “Family 01 · Night activity” and similar
neutral labels, rather than asserting generator labels as detected identities.

## Demo results

At four hops, the first case (`BH-2026-0001`) has:

- Signature **0.9968323699785419**, nearest other case `BH-2026-0028`.
- Components: entity **1.0**, behavioral **0.9909496285101196**, network **1.0**.
- Inferred night family: **30 cases**, reported losses **₹90,84,000**.
- **54** shared-identifier records linking **45** other complaints.
- **7** drawable identifier relations; source transaction count remains **26**.

Campaign inference independently produces groups of **30**, **16**, and **4** cases,
corresponding to the synthetic Gamma, Delta, and Lone Wolf verification scenarios.
The afternoon group's total is **₹34,03,000**; the morning group's is **₹1,08,000**.
Gamma/Delta retain factual shared-identifier overlaps without collapsing into one
inferred family. Lone Wolf (`BH-2026-0047`) links only its other three scenario cases;
its reused accounts produce **no external graph relations** or fake self-edges.

Counts depend on trace settings: at depth five, the first case reaches more accounts
and includes 64 shared-identifier records. This does not change the source dataset.

## Verification

Windows; Python 3.13.7, Node 22.20.0, npm 10.9.3; installed Google Chrome. Pinned
dependencies remain unchanged. Run commands from the respective application folder.

| Check | Command | Result |
| --- | --- | --- |
| Backend suite | `.\.venv\Scripts\python.exe -m pytest -q --basetemp=.pytest-tmp-phase4-verified` | **107 passed** |
| Backend lint/format | `.\.venv\Scripts\python.exe -m ruff check app tests`; `-m ruff format --check app tests` | Passed; 31 files |
| Dataset | `.\.venv\Scripts\python.exe verify_data.py` | Original counts/hash unchanged |
| Frontend unit suite | `npm.cmd test` | **45 passed** |
| Strict TypeScript + build | `npm.cmd run build` | Passed; also built by browser test command |
| Frontend formatting | `npm.cmd run format:check` | Passed |
| Real backend + production frontend in Chrome | `npm.cmd run test:e2e` | **25 passed in 1.2m** |

Backend tests use independent source datasets for exact component scores, weight
agreement, symmetry, missing observations, midnight windows, paise rounding,
weighted forwarding, observed dormancy, parallel transfers, masked IDs, colliding
display masks, nonfinancial links, empty/singleton data, API routing/errors,
cache/replacement/copy isolation, victim exclusions/factual account inspection,
transitive grouping without invented pairwise links, and graph truncation without
dropping identifier evidence. Demo-only verification checks expected family sizes,
Gamma/Delta overlap, all-pair bounds/weights, exact loss sums, and Lone Wolf isolation.

Frontend tests verify response/option/score/provenance checks, nonfinite rejection,
nonfinancial graph merging/filtering, and circular-hour display. Eight new browser
tests exercise actual analysis/campaigns, identifier highlighting and source
inspection, relation semantics/color/arrowheads, case navigation, failure/retry,
stale responses, dataset/score mismatches, hide/show/filter/replay coexistence,
independent Lone Wolf, mobile overflow, and keyboard tabs. The previous 17 browser
flows also pass. Normal flows check console errors and invalid-selector warnings.

An initial browser collection caught a pure formatting helper importing browser
HTTP configuration into Node. Dataset validation now lives in a shared pure module;
the final production-browser run passed. Tests own/stop their local servers; stop
manual app servers before running them. No performance-target claim is made here.

## Screenshots

- [DNA signature, family and graph relations](screenshots/phase4-dna.png)
- [Expanded masked identifier evidence](screenshots/phase4-entity.png)
- [Mobile DNA and keyboard tabs](screenshots/phase4-mobile-dna.png)
- [Account inspector regression](screenshots/phase4-inspector.png)
- [Story playback regression](screenshots/phase4-story.png)

Desktop and mobile screenshots were inspected. Previous phase screenshots are
preserved; the regression tests now write Phase 4 screenshot paths.

## Remaining limits

Family thresholds are explicit heuristics and can change with the chosen trace
options. Missing source history is not inferred. A graph relation requires an
external peer; reused accounts without one are documented in the panel. Graph
relations are capped at 100 with total/truncation flags while all identifier
records remain accessible. Similar-case and component lists show the top ten;
behavioral similar-campaign lists show the top five. This implementation uses exact
source entity links, not fuzzy matching or narrative DNA.

All data remains synthetic: 50 complaints, 200 accounts, 2,344 transactions,
249 entities; dataset hash:
`d0d8a3c9bcbda6f0ec298414400312d6e9011559c357987e28d34ee945846504`.

Phase 4 is complete. Stop for review before reports/alerts/shortcuts in Phase 5.
