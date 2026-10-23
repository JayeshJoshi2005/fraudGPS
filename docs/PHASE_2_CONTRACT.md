# Phase 2 implementation contract

Authorized: user request to implement Phase 2 correctly and completely. Owner: Codex.
Scope: frontend, typed API client, graph investigation, inspector, and verification.

- D08: Vite + React + TypeScript, with Tailwind's Vite plugin. Node 22.20.0 meets
  [Vite requirements](https://vite.dev/guide/). `npm start` serves port 3000.
  [Tailwind integration](https://tailwindcss.com/docs/installation/using-vite)
  and [Cytoscape APIs](https://js.cytoscape.org/) inform setup and graph behavior.
- D09: follow Prompt 2: size and color encode risk. Victims are blue diamonds;
  probable terminals are dark squares with their risk-colored border. A legend
  explains precedence. Amount controls edge width; parallel transfers stay distinct.
- D14: Graph uses force layout, Route uses directed breadth-first layers, Cluster
  groups by bank (not inferred criminal campaigns). All show the same filtered
  evidence. Search covers complaint IDs/victims and all loaded account IDs, masked
  labels, and holder names. Results identify accounts with stable internal IDs.
- Depth defaults to 4, minimum INR 100, forwarding window 24 hours. Changing trace
  options clears outdated results and requires Trace Funds. Suspicious-only is a
  local display filter (score >= .5 plus the victim); counts reflect hidden nodes.
- Case changes abort pending requests and clear trace, selected records, expansion,
  errors, and animations. Account inspection also aborts superseded requests.
  Graph, trace, risk, and account responses must share the loaded dataset version.
- Expansion adds a one-hop neighborhood; original trail roles/edges are preserved,
  and context edges are dimmed. Expansion is available by right-click and a keyboard
  accessible inspector button. Clearing expansion restores the original trail.
- Inspector requires source account type/KYC/location/age and observed statistics.
  Add `GET /api/accounts/{account_id}` as the minimal backend prerequisite, with
  the full validated account, inflow/outflow, distinct counterparties, complaint IDs,
  and amount-weighted FIFO forwarding time. Missing matches return null, never zero.
- Monetary text uses exact decimal strings/BigInt grouping. Numeric conversion is
  only for visual scale calculations. Source masked labels are authoritative; never
  derive display account numbers from internal IDs.
- Timeline strip reports trace status and evidence time range. Playback, DNA,
  report generation, and alert navigation are visibly unavailable until their phases.
- Verify build, frontend unit tests, real-backend browser tests, error/retry and stale
  request behavior, inspector/edge interactions, expansion, and desktop screenshots.
  Stop after Phase 2 review. No hosting or publication.
