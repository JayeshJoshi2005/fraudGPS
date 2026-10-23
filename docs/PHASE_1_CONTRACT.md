# Phase 1 analysis contract

Owner: Codex. Authorized by the user's "continue with phase 1" request on 22-Oct-2026.
This resolves D04-D07 and D13 for this phase; DNA and frontend work remain deferred.

- Preserve transfers in a NetworkX MultiDiGraph keyed by transaction ID. Entity
  linkage uses a separate bipartite graph; entity edges never move money.
- Complaint traces start at the exact initial transaction. Account-only traces
  seed each qualifying outgoing transaction independently; their totals are observed
  outgoing volume, not a claim about unique funds. An optional transaction must
  originate at the requested account.
- Process transactions by timestamp then ID. Only strictly later transfers can
  consume receipts: equal-time transfers cannot prove ordering. Attribute funds
  FIFO across tracked receipts, capped by both available tracked funds and the
  actual transfer amount. Untracked balances are unknown. This is a reproducible
  attribution hypothesis, not proof of ownership in pooled funds.
- Depth defaults to 5, allowed 1-7, counting the initial transfer as hop 1.
  Minimum amount defaults to INR 100, allowed 0 upwards, applied to the source
  transfer amount. Below-threshold transfers still consume attributed funds but
  stop that portion of the trace, preventing reuse by a later transfer.
- Forwarding window defaults to 24 hours per receipt, configurable 1-168 hours.
  Expired balances remain accounted for at the end of their receipt window and
  cannot fund later transfers. Depth-limited and filtered portions are stopped.
  Cycles can revisit accounts but each transaction is processed once; no funds
  are created by a cycle. Provenance retains each allocated path and amount.
- Splits: one receipt funds at least two distinct destinations within 30 minutes.
  Merges: one transfer consumes receipts from at least two distinct senders within
  30 minutes. Rapid forwarding: strictly more than 80% of one attributed receipt
  is forwarded within 30 minutes. Layering: paths with at least three intermediate
  pass-through accounts; report elapsed seconds and retained amount/decay.
- Terminal: a reached account with no subsequent source transfer at or above the
  threshold in its receipt window, and enough dataset observation to cover that
  window. Otherwise label unresolved (observation cutoff or traversal limit).
  "Cash-Out" is a probable endpoint role; withdrawal method is unknown.
- Roles use precedence: Victim, Splitter, Collector (3+ distinct inbound senders),
  Bridge (2+ complaint trails), Layering Node, Hub (betweenness >= 0.1), Cash-Out,
  Normal. Confidence is heuristic, not a calibrated probability. Trace and trail-graph
  roles use the selected trace's detections; risk and full/subgraph roles use default
  complaint traces. Complaint membership and graph centrality remain dataset-wide.
- Risk weights: anomaly .20, graph .20, complaints .20, temporal .15, dormancy .10,
  entity .15. Levels: Low < .3, Medium < .5, High < .7, Critical otherwise.
  Use observed inactivity only; account age is not dormancy. Entity risk uses
  complaint-linked peers, avoiding circular scores. Formulas and evidence are
  exposed with every score. No campaign truth, IDs, or manifest shortcuts.
- Case totals partition seed funds into balances at their windows/cutoffs and stopped
  portions. Hop volume is separately named and may exceed seed funds. Timelines
  have stable IDs and deterministic ordering; all explanations reference measured
  values and source transaction IDs. Monetary values are decimal INR strings;
  display strings use Indian grouping and dates use Asia/Kolkata.
- Complaint list/detail APIs are included as the Phase 2 prerequisite. Trace
  responses expose summaries directly. Dataset-scoped analysis is constructed
  on startup and discarded on restart; restart after replacing input data.

Observation uses the latest dataset transaction as its horizon, assuming input records
cover the intervening interval. Neither absence of a transfer nor a retained attributed
balance establishes a current bank balance, a withdrawal, or recoverability. No
cross-complaint allocation ledger is maintained; do not sum separate case traces as
unique funds. Within account-only mode, seed volume is gross outgoing activity.

Layering requires each consecutive transfer to retain 80–100% of the preceding
attributed transfer, with one traced destination and at most 30 minutes between hops.
Shared segments after merges are collapsed; maximal contiguous segments retain their
transaction IDs, elapsed time, and measured amount decay. Splits require distinct
destinations; repeated transfers to one destination remain separate edges but do not
alone imply a split. These interpretations resolve ambiguities in the prompt examples.

Role classification is owned by `RiskScorer.classify_node_role` and case summary text
by `explainer.generate_case_summary` over structured trace/complaint records. The
service coordinates these functions so routes contain no analysis algorithms.
