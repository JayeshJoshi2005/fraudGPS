# Modular workspace redesign — v0.7.0

Implemented and verified locally on 25-Oct-2026. Owner: Codex. Authorized by the
user's request to finish remaining project work and make the complicated page
more modular.

## Completion audit

The Phase 0–6 product audit found no remaining implementation stubs in the runtime
routes or interface. Real tracing, source-derived risk and DNA, replay, inspection,
alerts, checklists, summaries, and PDF downloads remain implemented. Actual team
recording, contributions, upload/submission, and separately scoped hosting remain
outside the local application work. See [the phase plan](PHASES.md) and
[demo guide](DEMO_GUIDE.md).

## Resulting interface

| Section | Purpose |
| --- | --- |
| Cases | Searchable complaint directory, scam-type filter, source totals, selected-case details, and a single primary tracing action. |
| Money Trail | Tall, readable graph with account/transfer inspection on demand, accessible record browsing, replay, graph controls, and expansion. |
| Fraud DNA | Full-width signature, component scores, inferred family, shared identifiers, and similar cases. View connections on graph returns to the trail. |
| Case Summary | Narrative, statistics, evidence-linked recommendations, persistent local review checklist, and PDF download. |

Desktop uses a quiet charcoal/mint palette, a navigation rail, clear card spacing,
and restrained emphasis. Smaller desktops use an icon rail; mobile keeps section
navigation at the bottom of the viewport. Settings open in a modal drawer rather
than occupying graph space. The account inspector appears when evidence is
selected. Graph focus mode gives the canvas additional width.

Hash URLs support direct section links and browser back/forward. Switching sections
preserves the selected case, completed analysis, review marks, and graph camera.
Leaving Money Trail pauses playback and clears story notifications. Hidden graphs
defer layout and ignore zero-size observations. Case/option changes still cancel
obsolete requests and clear evidence; the case picker stays available during an
active trace. Settings support focus trapping, Escape, and focus restoration.

## Implementation boundaries

`App.tsx` composes separate `components/workspace` modules. Shared
`useInvestigationWorkspace` coordinates the existing analysis hooks and selection;
`useWorkspaceNavigation` owns hash/history behavior. `workspace.css` handles the
responsive shell. The former permanent `Sidebar` has been replaced by `CaseSetup`.
API contracts and financial analysis algorithms are unchanged by this redesign.
The frontend and backend release versions are both 0.7.0.

The completion audit also repaired a concrete Windows startup/shutdown defect:
immediately reading a newly started process's executable property could save a
null ownership path, and stopping a virtualenv launcher alone could leave its
actual Python server running. The launcher now records the known executable and
stops a verified owned tree. Smoke/benchmark helpers also stop their owned tree.
A regression launches a descendant TCP listener and checks that shutdown closes it.

## Verification

- **122 backend tests**, including source evidence, independent replacement data,
  long PDF tables/fonts/text, and Windows child-process cleanup.
- **99 frontend unit tests**, including eight navigation cases.
- **50 production-browser tests** against real FastAPI and the built frontend:
  case filtering, active-trace switching, stale requests, source provenance,
  replay, graph inspection, DNA, report downloads, mobile layout, history/camera,
  keyboard navigation, settings focus, and three complete demo rehearsals.
- TypeScript/Vite production build, Prettier, and Ruff passed. The backend run
  emitted a cache-write warning from an existing local `.pytest_cache` permission;
  all 122 tests passed.
- Real launcher fresh start, matching-service reuse, repeated stop, and final
  startup checked. Ownership paths are populated; shutdown removes the owned
  backend child and frontend listeners. Smoke checks cover ten live API endpoints.
- Source dataset unchanged: 50 complaints, 200 accounts, 2,344 transactions,
  249 entities; hash
  `d0d8a3c9bcbda6f0ec298414400312d6e9011559c357987e28d34ee945846504`.

Run `npm.cmd test`, `npm.cmd run build`, `npm.cmd run format:check`, and
`npm.cmd run test:e2e` from `fraud-gps/frontend`. From the backend run
`python -m pytest -q`, `python -m ruff check app tests benchmark_demo.py smoke_api.py demo_process.py`,
and `python -m ruff format --check app tests benchmark_demo.py smoke_api.py demo_process.py`.
Windows process-tree tests need permission to stop their own child processes;
the browser suite needs Chrome and free local ports 8000/3000.

[HTTP measurements](performance/modular-api.json) record fresh-server ordered
first-use and seven warm samples for graph, risk, trace, trail, timeline, DNA,
summary, and PDF. Every measured request met 500 ms (largest first-use: DNA
469.54 ms; largest warm maximum: PDF 409.30 ms). Startup was 3,335.32 ms and is
excluded from endpoint timing. These are local measurements, not deployment guarantees.
[Graph measurements](performance/modular-graph.json) record three production-browser
samples below 2 s with 50 source accounts and all 1,864 transfers between them.
The fixture includes every edge; rendering does not hide data to meet the target.

## Visual evidence

- [Cases](screenshots/modular-cases.png)
- [Money Trail](screenshots/modular-trail.png)
- [Fraud DNA](screenshots/modular-dna.png)
- [Case Summary](screenshots/modular-summary.png)
- [Mobile trail](screenshots/modular-mobile-trace.png)
- [Mobile summary](screenshots/modular-mobile-summary.png)

Earlier phase reviews and their evidence are preserved. Source data remains
synthetic. Risk and DNA are explainable heuristics; probable endpoints do not
establish a withdrawal method. Review marks are local browser state and reset on
case/options changes or reload. Hosting and actual submission are still separate.
