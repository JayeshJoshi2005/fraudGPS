# Phase 1 API

Run the backend on `http://127.0.0.1:8000`; `/docs` and `/openapi.json` expose
the typed models. Source record schemas remain in `app/models/schemas.py`; analysis
responses are in `app/models/analysis.py`. All financial amounts are decimal INR
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

DNA and report routes are reserved for later phases and expose no endpoints yet.

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
