# Phase 1 verification and review

Date: 22-Oct-2026. Owner: Codex. Authorization: "continue with phase 1".
Status: implemented and verified; stopped for user review before Phase 2.

## Delivered

- Transaction-preserving NetworkX MultiDiGraph and separate entity bipartite graph;
  account statistics, direct complaint links, neighbors, and N-hop neighborhoods.
- Chronological FIFO attribution with exact INR, source paths, repeated transfers,
  split/merge detection, rapid forwarding, layering/decay, cycles, windows, limits,
  probable endpoints, and conserved seed funds.
- Six weighted risk components, bounded levels, role/confidence, observed dormancy,
  entity evidence, explicit formulas, factual explanations, and case summaries.
- Trace, risk/ranking, full/subgraph/trail graphs, timeline, and complaint list/detail
  APIs with typed responses, shared filters, structured errors, and empty results.
- Dataset-scoped startup analysis and cache isolation; independent fixtures require no
  generated scenario labels, expected roles, manifest, or hardcoded account IDs.

Contracts: [analysis rules](PHASE_1_CONTRACT.md), [API guide](../fraud-gps/backend/API.md).
No dependency changes were required. The frontend, DNA, reports, and UI playback remain
later phases. Role classification lives in the risk engine; routes only validate and
serialize through the analysis service.

## Verification evidence

Windows, Python 3.13.7, existing pinned virtual environment. Commands from
`fraud-gps/backend`:

| Command | Result |
| --- | --- |
| `.\.venv\Scripts\python.exe -m pytest -q --basetemp=.pytest-tmp` | 80 passed in 6.52 seconds |
| `.\.venv\Scripts\python.exe -m ruff check .` | All checks passed |
| `.\.venv\Scripts\python.exe -m ruff format --check .` | 32 files already formatted |
| `.\.venv\Scripts\python.exe -m pip check` | No broken requirements found |
| `.\.venv\Scripts\python.exe smoke_api.py` | 10 live HTTP endpoints passed on loopback port 57646; server shut down afterward |

The suite includes the existing 24 foundation tests. New checks cover repeated edges,
independent entity links, time order including equal timestamps, cycles, capped monetary
allocation, split/merge provenance, filtered-fund reuse, inclusive forwarding windows,
depth censoring, observation cutoffs, rapid-forward thresholds, layering before splits,
deduplication after merges, input-order invariance, Indian formatting, risk formulas,
actual inactivity, dataset replacement, account-only traces, every API, invalid requests,
missing records, shared filters, and valid empty trails. All 50 demo complaint traces
were checked for conservation and unique transaction steps.

Tests found and resolved strict integer parsing for GET query filters. Review also found
and fixed duplicate layering events on merged paths and an endpoint disappearing when
an unrelated transfer occurred after the selected window. These cases have regression tests.

## Live example

Dataset hash:
`d0d8a3c9bcbda6f0ec298414400312d6e9011559c357987e28d34ee945846504`.
Counts: 200 accounts, 50 complaints, 2,344 transactions, 249 entities.

`POST /api/trace` with `{"complaint_id":"BH-2026-0001"}` returned:

| Measurement | Result |
| --- | --- |
| Seed amount | ₹2,21,000 |
| Accounts / transfer steps | 31 / 36 |
| Maximum reached depth | 5 |
| Retained at windows/cutoffs / stopped | ₹2,21,000 / ₹0 |
| Probable endpoint amount | ₹2,20,600 |
| Hop volume | ₹11,04,000, including repeated funds across hops |
| Detected events | 6 splits, 26 rapid forwards, 10 terminal receipt events |
| Timeline | 78 events |
| Initial suspect score | 0.7581254966685006, Critical |

Terminal events refer to receipts, not necessarily distinct accounts. This case did not
produce a merge or layering event under the selected rules; those detections are verified
on independent qualifying datasets rather than fabricated for a demonstration. Full graph
serialization preserved all 2,344 transfers. Complaint detail, trail graph, and timeline
agreed with the trace response.

## Limitations and handoff

FIFO is an attribution hypothesis through pooled funds, with unknown opening balances.
Balances are measured at receipt windows/cutoffs and do not prove funds are currently
available or recoverable. The latest dataset transaction defines the observation horizon;
data completeness within it is assumed. No withdrawal channel is inferred. Separate case
traces have no shared allocation ledger and must not be summed as unique money.

Risk formulas and thresholds are transparent heuristics, not trained or calibrated fraud
probabilities. Global risk uses default complaint traces, while trace roles use selected
filters. Analysis loads at startup; restart after replacing data. Performance targets and
larger datasets have not been benchmarked. Production controls remain deferred.

No Phase 1 acceptance work remains. Review this phase, then explicitly authorize Phase 2
to choose its frontend toolchain and build the investigation UI.
