# Graph visibility and minimal workspace

Requested by the user after Phase 4 on 23-Oct-2026: improve graph visibility and
use a minimal design. This refinement changes the frontend; report features and
backend analysis remain outside this change.

## Result

- Replaced the oversized heading and four statistic cards with a compact title
  and inline totals. Removed gradients, the dotted canvas, repeated role badges,
  and continuous overview pulses. Replay retains its event effects.
- Default Route arranges transfers from left to right, with stable ordering and
  spacing. Short screens wrap crowded hops into staggered columns. Parallel
  transfers, cycles, and disconnected components remain in the graph.
- Increased node sizes, label contrast, and transfer-arrow visibility. Risk uses
  outlines and size. Account labels stay at 13 rendered pixels while zooming.
- Inspector opens on selection or DNA analysis. Cases and Inspector controls
  toggle panels; Expand graph releases both panels' space. Compact screens show
  one side panel at a time. Resizing or toggling panels recalculates the layout.
- Moved complaint descriptions and full statistics into disclosures. Retained
  source records, search, filters, graph layouts, expansion, and replay controls.
- Reduced the DNA overlay to a small summary. Purple dashed identifier links
  retain no arrows or financial fields; their labels appear only when focused,
  selected, or hovered. Identifiers never determine transaction hops.
- Mobile closes case controls after tracing and opens a readable portion of the
  graph. Dragging explores the trail; Fit graph shows the complete network.

## Verification

- `npm.cmd test`: 49 passing frontend unit tests, including branch layout,
  stable ordering, parallel/cyclic/disconnected graphs, and identifier separation.
- `npm.cmd run test:e2e`: production build and 28 Chrome browser checks against
  the real FastAPI service. Covers existing investigation, DNA and replay flows,
  panel toggles, full-canvas mode, resizing, laptop labels, and mobile fitting.
- `npm.cmd run format:check`: Prettier validation.
- A follow-up request increased graph height: totals now share the title row,
  surrounding bars use less vertical space, and mobile uses a full viewport-height
  investigation section. At 1366×768 the canvas grew from 395 to 520 pixels tall;
  at 1920×1080 it grew from 707 to 832 pixels tall.
- At 1920×1080, the default graph canvas is 1598×832 pixels. The checked first
  complaint has 27 accounts with all labels visible at 13 rendered pixels.
- At 1366×768, the checked first complaint fills about 89% of the canvas width,
  with no overlapping account bounding boxes. Dense alternate trails can still
  benefit from zooming, filtering, or expanding the graph.

No dependency or backend change was required. Phase 4's backend checks are
recorded in its review; they were not rerun for this frontend-only refinement.

## Screenshots

- [Desktop trail](screenshots/ui-refresh-trail.png)
- [Laptop trail](screenshots/ui-refresh-laptop.png)
- [Account inspection](screenshots/ui-refresh-inspector.png)
- [Fraud DNA](screenshots/ui-refresh-dna.png)
- [Replay](screenshots/ui-refresh-story.png)
- [Mobile trail](screenshots/ui-refresh-mobile.png)
- [Mobile DNA](screenshots/ui-refresh-mobile-dna.png)

Earlier phase screenshots are preserved separately.
