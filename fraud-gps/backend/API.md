# Analysis API (Phases 1–5)

Run the backend on `http://127.0.0.1:8000`; `/docs` and `/openapi.json` expose
the typed models. Source record schemas remain in `app/models/schemas.py`; analysis
responses are in `app/models/analysis.py`, `app/models/dna.py`, and `app/models/reports.py`. All financial amounts are decimal INR
strings. Display fields use Indian currency grouping and Asia/Kolkata dates.

## Endpoints

| Method / path | Behavior |
| --- | --- |
| `GET /health` | Phase, dataset hash, validated record counts |
| `POST /api/trace` | Complaint or account trace, allocations, detections, balances, roles, summary |
| `GET /api/risk/top?limit=20` | Descending scores; account ID breaks ties; limit 1–200 |
| `GET /api/risk/{account_id}` | Six components, weights, formulas, score/level, role/confidence, evidence, explanations |
| `GET /api/graph/full` | All account nodes and every transfer, including parallel transfers |
| `GET /api/graph/subgraph/{account_id}?depth=3` | Induced transaction graph within undirected N-hop neighborhood; depth 0–7 |
| `GET /api/graph/trail/{complaint_id}` | Only the selected trace's transfers and reached accounts |
| `GET /api/timeline/{complaint_id}` | Ordered transfer, split, merge, rapid-forward, layering, and terminal events |
| `GET /api/complaints?offset=0&limit=50` | `{total, items}` ordered by complaint ID; limit 1–200 |
| `GET /api/complaints/{complaint_id}` | `{complaint, trace}` including the same summary and evidence |
| `GET /api/accounts/{account_id}` | Phase 2 inspector prerequisite: source account, activity statistics, forwarding time, linked complaints, dataset version |
| `GET /api/dna/campaigns` | Dataset/version/options, inferred families with source complaint IDs and exact reported-loss totals |
| `GET /api/dna/entity/{account_id}` | Masked identifier matches and source account/case links for one account |
| `GET /api/dna/{complaint_id}` | Full source-derived entity/behavior/network/composite DNA, inferred family, ranked cases, and nonfinancial link graph |
| `GET /api/report/{complaint_id}/summary` | Exact filtered trace, narrative, DNA, flagged accounts, evidence-linked review actions, and limitations |
| `POST /api/report/{complaint_id}` | Downloadable PDF using the same shared analysis and requested trace options |

Account detail returns `{dataset_version, account, total_inflow, total_outflow,
transaction_count, distinct_senders, distinct_recipients, average_forward_minutes,
linked_complaint_ids}`. `account` is the existing validated source record, including
the authoritative `masked_account`. Average forwarding is the amount-weighted observed
FIFO lag over the complete dataset, excluding equal-time matches and unknown opening
balances. No matched forwarding returns null. Complaint IDs combine direct links with
default-trail membership. Unknown accounts return the usual structured HTTP 404.

## Requests

```json
{
  "complaint_id": "BH-2026-0001",
  "max_depth": 5,
  "min_amount": "100.00",
  "forwarding_window_hours": 24
}
```

Supply exactly one of `complaint_id` or `account_id`. Account mode accepts optional
`start_tx_id`, which must originate at that account. A complaint anchors its own
initial transaction. Without an anchor, account mode seeds each qualifying outgoing
transfer as gross observed volume. Unknown body fields are rejected.

`max_depth` is 1–7 including the initial transfer, `min_amount` is nonnegative with
at most two decimal places, and `forwarding_window_hours` is 1–168. The trail graph,
timeline, and complaint detail accept these same three options as query parameters.
Pass identical options when displaying these views together. The frontend may select
depth 4 explicitly; backend defaults remain 5.

PowerShell example, after starting the backend:

```powershell
$body = @{ complaint_id = 'BH-2026-0001'; max_depth = 5 } | ConvertTo-Json
$trail = Invoke-RestMethod http://127.0.0.1:8000/api/trace -Method Post -ContentType 'application/json' -Body $body
$trail.metrics
Invoke-RestMethod http://127.0.0.1:8000/api/risk/top?limit=5
Invoke-RestMethod http://127.0.0.1:8000/api/graph/trail/BH-2026-0001
Invoke-RestMethod http://127.0.0.1:8000/api/timeline/BH-2026-0001
```

## Analysis semantics

`steps` are sorted by timestamp and transaction ID. Each retains the source transaction
fields, `attributed_amount`, minimum `depth`, and `allocations`. Every allocation has
its own exact amount, transaction-ID path, parent receipt, and depth. Equal-time transfers
cannot spend one another's receipts. FIFO consumption is capped by both tracked balances
and actual transfer amounts. Filters never allow a consumed amount to be spent twice.

`detections` carry stable `event_id`, `type`, timestamp, account IDs, source transaction
IDs, amount, description, and measured `metrics`. Split `outputs` include each outgoing
transaction and its attributed amount. A terminal is a probable endpoint within the
receipt window; withdrawal method remains unknown. Timelines add one-based `step`;
transfers precede detections at equal timestamps, then event IDs break ties.

Timeline responses retain the array body and include `X-Dataset-Version`, exposed
through CORS for the browser. The player verifies this version against its trace
and rejects incomplete, reordered, or inconsistent source evidence.

Phase 3 adds `statistics` to service-produced trace responses:

| Field | Meaning |
| --- | --- |
| `probable_endpoint_account_ids` | Sorted distinct accounts from terminal events; receipt events are deduplicated |
| `fastest_forward_minutes` | Minimum positive parent-receipt to child-transfer lag from attributed allocations; null if none |
| `transfer_duration_seconds` | First to last observed transfer, excluding later window-end detections; zero for fewer than two transfers |
| `other_linked_complaint_ids` | Sorted distinct complaint IDs linked through trail accounts by direct involvement or default-trail membership; current complaint excluded |

These complaint links do not calculate Fraud DNA similarity. Account-mode traces
retain the existing gross-seed interpretation. UI funds traced uses `seed_amount`;
deepest layer uses `max_depth_reached` (initial transfer is hop 1).

`balances` record account, receipt, amount, and reason. A stopped portion also records
`stopping_tx_id`. Reasons include probable terminal, observation cutoff, retained balance,
maximum depth, and minimum amount. Window-end balances cannot fund later transfers and
are not claims of current available funds.

| Metric | Meaning |
| --- | --- |
| `seed_amount` | Sum of qualifying anchored/seed transfers |
| `retained_amount` | Tracked balances at their own observation windows/cutoffs |
| `stopped_amount` | Portions consumed at depth limits or filtered transfers |
| `probable_terminal_amount` | Subset of retained funds meeting the terminal rule |
| `hop_volume` | Sum of attributed transfers across all hops; can count the same money repeatedly |

`seed_amount = retained_amount + stopped_amount`. A valid empty trace returns HTTP 200
with empty steps/events and zero financial metrics. Its graph retains the start account.
Case summaries identify the complaint/victim and reference `summary_transaction_ids`.

Risk is dataset-scoped and independent of caller filters. It combines anomaly .20,
graph .20, complaint linkage .20, temporal bursts .15, observed dormancy .10, and shared
entities .15. Scores are bounded [0,1]; Low <.3, Medium <.5, High <.7, Critical otherwise.
Responses include `component_formulas`, measured evidence, and method version. Absence
of sufficient temporal history scores zero; account age is never used as dormancy.
Scores and role confidence are heuristics, not calibrated probabilities.

Trace roles reflect that trace's detections; full/subgraph and risk roles reflect default
complaint traces. Dataset-wide complaint membership/centrality still inform both. Graph
nodes use stable IDs plus masked display labels. Each edge ID is the original transaction
ID and `kind` is `transaction`; the separate internal entity graph never implies transfers.

See the [analysis contract](../../docs/PHASE_1_CONTRACT.md) for exact windows, role
precedence, pooling assumptions, and replacement-data limitations. Restart after replacing
input data to rebuild graph, trace, and risk state under the new dataset hash.

## Fraud DNA (Phase 4)

All three DNA endpoints accept the same three trace options as the trace/timeline
APIs. Every comparison uses those options for every complaint, so filtered current
trails are never compared against a different-depth candidate set. The signature
describes the **highest-scoring other case**, and all three displayed components
refer to that same case:

`signature = .40 * entity + .35 * behavioral + .25 * network`.

Self is removed before ranking. Scores are symmetric, bounded matching heuristics;
they are not calibrated probabilities, guilt scores, or proof of a shared operator.

- Entity: Jaccard overlap of identifiers on non-victim trail accounts. Two empty
  sets score zero. Victim-only accounts are excluded from operation fingerprints.
  Account-specific entity queries still return factual links to source identifiers.
- Behavior: scalar min/max similarity and histogram intersection, with weights
  amount .18, forwarding .18, split .14, IST hours .20, hops .14, channels .10,
  dormancy .06. Missing dimensions are excluded and available weights renormalized;
  `behavioral_coverage` reports the available fraction. Empty trails score zero.
- Network: topology equality .20; seven min/max terms (node count, transfer count,
  unique directed edges, max/average degree, fan-in/out counts) at .10 each; density
  and clustering absolute proximity at .05 each. No internal transfer edges means
  zero network evidence. Degrees use a directed simple projection excluding victims;
  clustering uses its undirected projection. Repeated transfers remain counted
  separately in `edge_count` and in the original trace.

Fingerprint means use source transfer amounts, rounded to paise with HALF_UP.
Forwarding is an attributed-amount-weighted positive parent/child lag. Split ratio
is mean detected destination count. Activity windows are the smallest circular
hour-bin envelope in IST, with a normalized 24-bin histogram. Dormancy uses only
accounts with a prior observed transaction: a gap >=30 days followed by >=3 observed
transactions in one hour contributes that gap; other observed baselines contribute
zero. No prior baseline returns null. Source account age is never substituted for
dormancy. Withdrawal method is always `unknown` with these source records.

Families are connected components of case pairs meeting **both** entity >=.25 and
signature >=.65, with at least two members. IDs hash sorted member IDs. Neutral
names such as “Family 01 · Night activity” are derived from order/activity; generator
campaign labels are not consulted. A transitive family does not imply that every
pair shares an identifier. Family loss counts each member complaint once.

Reports return masked `entity_matches` with current accounts, external accounts,
and other complaint IDs. `linked_complaint_ids` contains actual shared-identifier
links; `similar_cases` ranks combined matching strength and can include pattern-only
matches. These concepts and family membership are not interchangeable. Full reports
also include behavioral similar-campaign aggregates (self excluded), topology
matches, formulas, limitations, and comparison counts.

`link_graph` has source account nodes and separate edges with `kind: entity_link`,
`entity_ids`, `complaint_ids`, and a label. These edges have **no money, channel,
timestamp, attribution, or transfer direction**. They connect current accounts to
source-linked external peers belonging to other cases. A reused account is retained
as one account, never represented by a fake self-transfer. Graph output is capped at
100 deterministic relations, with `total_link_count` and `truncated`; all identifier
evidence remains available in the report. Transaction graph endpoints stay unchanged.

The service caches up to eight complete option contexts per dataset instance.
Equivalent decimal minima share a key. Restart after replacing source JSON to load
the new dataset hash and rebuild traces/fingerprints/pairs/families. No generator
manifest, prepared similarity JSON, or campaign name lookup is used.

See [Phase 4 contract](../../docs/PHASE_4_CONTRACT.md) and
[review](../../docs/PHASE_4_REVIEW.md) for evidence and sample results.

## Investigation summaries and PDF exports

`GET /api/report/{complaint_id}/summary` accepts the usual `max_depth`,
`min_amount`, and `forwarding_window_hours` query parameters. It returns
`{dataset_version, method_version, complaint, trace, dna, narrative,
narrative_transaction_ids, flagged_accounts, recommendations, limitations}`.
Flagged accounts are non-victims in the selected trace with dataset-wide risk
>=.50. Each row distinguishes dataset-wide risk from selected-trail role and
includes other complaint IDs and selected-trail transaction references.

Actions have stable `action_id`, `kind`, `priority`, `title`, `rationale`, and
account/entity/transaction/complaint reference arrays. Kinds are `freeze_review`,
`telecom_records`, `coordinate`, and `link_case`. These are review suggestions;
the API has no operational freeze, telecom-request, or messaging endpoints.
Location suggestions cite source account addresses and do not assert withdrawal
locations. Case comparisons require shared identifiers or similarity >=.65.

`POST /api/report/{complaint_id}` accepts an optional JSON body:

```json
{
  "max_depth": 4,
  "min_amount": "100",
  "forwarding_window_hours": 24,
  "expected_dataset_version": "<the active trace's dataset_version>"
}
```

Omitted options use API defaults (depth 5, INR 100, 24 hours). A mismatched
expected version returns **409** before PDF generation. The response has
`Content-Type: application/pdf`, attachment `Content-Disposition`,
`X-Dataset-Version`, and `Cache-Control: no-store`. CORS exposes the disposition
and dataset headers. No PDF is persisted by the server.

Reports contain six sections starting on separate pages. Long sections continue
with repeated table headers; embedded DejaVu fonts support rupee amounts. Source
and FIFO-attributed amounts remain separate. Local checklist review marks are
not sent to the backend or exported as action-completion claims.

```powershell
$version = (Invoke-RestMethod http://127.0.0.1:8000/health).dataset_version
$body = @{max_depth=4; min_amount='100'; forwarding_window_hours=24; expected_dataset_version=$version} | ConvertTo-Json
Invoke-WebRequest http://127.0.0.1:8000/api/report/BH-2026-0001 -Method Post -ContentType application/json -Body $body -OutFile investigation.pdf
```

See the [Phase 5 contract](../../docs/PHASE_5_CONTRACT.md) and
[PDF/browser review](../../docs/PHASE_5_REVIEW.md).

## Errors

Invalid requests return HTTP 422; missing records return HTTP 404:

```json
{"error":{"code":"not_found","message":"Unknown account: ACC-999999"}}
```

Validation errors use `invalid_input` with a message and, for request validation,
`details` containing field locations and messages. A mismatched starting transaction is
invalid input. An existing account with no matching transactions is an empty success.

## Verification

```powershell
.\.venv\Scripts\python.exe -m pytest -q --basetemp=.pytest-tmp
.\.venv\Scripts\python.exe smoke_api.py
```

The live smoke check uses a temporary loopback port and shuts its server down afterward.
