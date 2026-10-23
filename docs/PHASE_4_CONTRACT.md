# Phase 4 contract — source-derived Fraud DNA

Authorized by “do phase 4 correctly” on 23-Oct-2026. Owner: Codex. Scope: DNA
engine/models/routes, typed inspector tab, entity/case evidence, distinct graph
relations, and verification. Existing Phase 3 work is preserved. Phase 5 is excluded.

## Evidence and comparisons

All complaint fingerprints use the same requested trace options, including the
currently displayed case. Victim-only accounts are excluded from operation/entity
fingerprints; account queries still disclose factual source entity links. No
manifest, campaign names, preassigned roles, or stored similarity fixtures enter
the engine. Caches belong to one dataset-scoped service and are keyed by method
version/options; replacing input data and rebuilding the service invalidates them.

Entity similarity is Jaccard overlap of source entity IDs attached to non-victim
trail accounts; two empty sets score zero. Entity matches retain current accounts,
external peer accounts, and other complaint IDs (excluding the selected complaint).
Sharing an already-reused trail account can link cases even with no external peer.
Entity display values are masked server-side; IDs and linked account IDs retain
source provenance. Masked display strings are never identity keys.

Behavior uses mean source transfer amount (exact decimal INR), attributed
amount-weighted parent/child forwarding delay, average observed split destination
count, an IST 24-hour activity histogram, deepest attributed hop, channel histogram,
and observed prior dormancy gaps when a baseline and activation burst exist.
Unobserved forwarding/dormancy is null. Withdrawal method is unknown and excluded
from comparisons. Nonnegative scalar features use min/max similarity; histograms
use intersection. Available feature weights are renormalized; coverage is exposed.
Behavior weights: amount .18, forwarding .18, split .14, hours .20, hops .14,
channels .10, dormancy .06. Empty traces have zero similarity.

Network features use a directed simple projection for degrees/topology and its
undirected projection for clustering, while also exposing distinct transfer count
and unique directed edge count. Topology, node/edge/degree counts, fan-in/out counts,
density, and clustering contribute bounded comparison terms. Empty networks score
zero. Parallel transfers remain source transaction records, not extra neighbors.

Each pair's composite is exactly `.40*entity + .35*behavioral + .25*network`.
The displayed signature and components all refer to the same highest-scoring
other complaint; self is excluded before ranking. Scores express observed matching
strength, not guilt or calibrated probability. Similar cases and actual shared-
identifier case links remain separate concepts. Pair scores are symmetric.

## Campaign families

Connect complaint pairs only when entity similarity >= .25 and composite >= .65.
Connected components with at least two cases are inferred families. Singletons
remain unclustered. Family IDs hash sorted member complaint IDs; names are neutral,
deterministic labels with measured activity period. No Gamma/Delta/Lone Wolf truth
label is read. Family loss sums each member complaint's reported loss once. Similar
campaign comparisons exclude the current complaint from their score aggregation.
These thresholds are transparent heuristics; connected-component transitivity does
not imply that every pair shares every identifier.

## API and UI

Implement `/api/dna/campaigns`, `/api/dna/entity/{account_id}`, and
`/api/dna/{complaint_id}` (static route before the dynamic case route). Complaint
reports/campaigns accept existing trace options; account entity requests use those
options to find complaint memberships. Responses include dataset version, method,
options, formulas/evidence, coverage, fingerprint, network features, similar cases,
families, and entity matches. Missing IDs use the standard structured 404; invalid
options use 422; existing but empty analysis returns 200 with explicit nulls/zeros.

The right inspector gets Account Inspector/Fraud DNA tabs. Analyze is enabled after
a nonempty trace, opens the DNA tab, pauses story playback into the overview, and
preserves the trace. The panel has loading/retry/empty states, signature ring,
component bars, family totals, expandable identifier evidence, ranked cases,
behavioral measurements, and topology. Similar-case navigation selects that case
and loads its trace with current options. Tab changes preserve successful analysis;
case/options/retrace/reload clear it and abort obsolete requests.

Graph relations use a distinct `kind: entity_link` contract with entity/case IDs;
they have no amount, timestamp, channel, or attribution. Purple dashed lines have
no arrowheads and say “Shared identifier”/“Also in case …”. They connect current
non-victim accounts to source-linked external peers in other complaints. Reused
accounts without external peers are documented in the panel, not represented by
fake self-edges or fake transfers. Bound graph relations to 100 deterministically,
expose total/truncation, and retain all entity evidence in the panel. Identifier
selection highlights its drawn relations. A removable floating DNA summary sits
in the graph's upper-right; replay dims these context relations and never animates
them as money. Display filters remove orphan links and report counts separately.

## Verification

Independent datasets test all three comparisons, bounded outputs/exact weights,
unknown data, self exclusion, symmetry, midnight handling, parallel transfers,
campaign thresholds/transitivity, exact loss totals, missing/empty requests, and
dataset replacement/cache isolation. Demo checks verify within-scenario matches,
Gamma/Delta shared identifiers, and no external Lone Wolf entity links, without
feeding manifest truth into calculations. Browser tests cover real analysis,
masked evidence, entity/case navigation, relation semantics, inspector/playback
coexistence, failure/retry, delayed responses, dataset mismatch, and mobile layout.

Graph projection calculations use the installed NetworkX version and its official
[clustering](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.cluster.average_clustering.html)
and [connected-component](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.components.connected_components.html)
APIs. These documentation sources establish API behavior, not the validity of our
matching thresholds; those remain explicitly heuristic implementation choices.
