# Phase 5 contract

Authorized on 25-Oct-2026 by "implement next phase". Preserve the minimal layout,
taller graph, synthetic datasets, and existing analysis contracts.

- `GET /api/report/{complaint_id}/summary` accepts the existing trace options.
  It returns the dataset version, complaint, exact trace, case-specific flagged
  accounts, DNA, narrative evidence references, and prioritized recommended actions.
- `POST /api/report/{complaint_id}` accepts the same options and an optional
  expected dataset version. It renders that same analysis to a downloadable PDF.
  A version mismatch returns 409 before generating a file. No report is saved on
  the server. Checklist completion stays local and is not evidence of an action.
- Six report sections start on separate pages: cover, complaint, money trail,
  suspicious accounts, DNA, recommendations. Sections may span additional pages;
  tables repeat headers and long text wraps. Unicode fonts are bundled and embedded.
- Summary and PDF use the trace's filters and attribution. Seeded funds count once;
  original and attributed transfer amounts are both explicit. Depth cutoffs are
  not probable endpoints. Account risk is dataset-wide and labeled accordingly;
  the report lists only accounts in the selected trail, excluding the victim.
- Actions are deterministic review suggestions with source IDs. Accounts with
  risk >=.50 receive a bank freeze-review suggestion, shared phone identifiers
  receive a telecom-records review suggestion, source-listed endpoint locations
  receive a coordination suggestion, and other cases require direct shared
  identifiers or DNA similarity >=.65. No agency identity or withdrawal method is
  inferred. Nothing freezes accounts or contacts anyone.
- Global alerts use the risk ranking API, display provenance, and navigate to the
  selected account even when outside the current graph. Playback toasts are based
  on newly played events; seeking does not emit historical alerts. Four-second
  timers, bounded stacks, deduplication per replay, case resets, and unmount cleanup
  prevent stale notifications. Probable endpoints retain unknown withdrawal method.
- Keyboard shortcuts: Space toggles playback; arrows step; F fits; R replays;
  Escape deselects. Typing, native form controls, editable content, modifier keys,
  and auto-repeated keys are excluded. Shortcuts are discoverable in the header.
- Async summary/report/alert results reject mismatched datasets. Case/filter
  changes abort or discard stale work. Report downloads validate content before
  saving, clean up object URLs, and provide visible failure/retry feedback.
- Checklist validation binds flagged roles and transfer references to the selected
  trace. Freeze reviews reference flagged accounts; telecom reviews reference a
  shared source phone and its linked accounts; coordination references probable
  endpoints; case comparisons reference eligible DNA matches. Unrelated references,
  missing evidence, duplicate IDs, and unsupported kinds or priorities are rejected.

Phase 6 remains outside this authorization.
