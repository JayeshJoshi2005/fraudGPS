# Phase 3 contract: timeline and story mode

Authorized on 23-Oct-2026 by “continue to phase 3”. Owner: Codex. Scope: backend
timeline integrity and trail statistics; frontend playback state, graph presentation,
controls, cards, labels, and verification. Phase 4 remains outside this change.

## Evidence and statistics

The existing timeline array is preserved. `X-Dataset-Version` identifies its dataset
and is exposed through CORS. Trace, graph, and timeline use identical options. The
client checks versions, sequential steps, event identities, chronological ordering,
and referenced transaction IDs before enabling playback. Timeline errors have their
own retry; a failed replay request does not discard a valid investigation.

Trace `statistics` adds distinct probable endpoint account IDs, minimum positive
parent-to-child forwarding delay in minutes, first-to-last transfer duration in
seconds, and other complaint IDs linked through direct account involvement or
default-trail membership. The current complaint is excluded. These are account
links, not Fraud DNA similarity. Empty/single-transfer trails have no measured
forwarding delay. Deepest layer is the deepest attributed hop (seed is hop 1).
Total amount traced uses `metrics.seed_amount`, never repeated `hop_volume`.
Endpoint counts deduplicate receipt-level terminal events. A terminal remains a
**probable endpoint**, with unknown withdrawal method. Window-end event times are
distinct from observed transfer duration. No current recoverable balance is claimed.

## Playback state and reconstruction

Step 0 is the victim-only introduction. Step N means the first N API events have
been applied. Forward, backward, and scrub use the same pure prefix projection;
they never infer progress from previously mutated canvas state. All elements remain
in the layout: unrevealed/context elements are dimmed to 0.15. Repeated transfer
edges are addressed by transaction ID. At the final step all trail elements are
revealed and context remains dim. Display filtering does not alter event numbering.

Play from the overview starts at step 0; Play while paused resumes; Play at the end
restarts. Sidebar Replay always restarts and plays; during playback it pauses.
Previous/next/scrub pause, including repeated or boundary scrubs. Speeds are 0.5x,
1x, 2x, 3x; base cadence is 1 second/event. Step 0 holds for one second at 1x.
Layering receives enough time for 150ms per chain account, scaled by speed. Playback
is event-paced, not proportional to real-world gaps; timestamp displays retain IST.

Case/options/retrace/reload reset playback and abort timeline requests. Timers and
canvas effects clean up on pause, jump, replay, case change, and unmount. Speed
changes restart the current event's wait at the new cadence. Reduced motion keeps
the same state/control behavior while suppressing transient motion. Hiding the tab
pauses playback. Returning to overview shows the full investigation.

## Rendering

Transfers highlight their exact edge and destination; splits highlight all measured
outputs together; rapid forwarding uses orange edges; terminal events use dark
nodes/red receipt edges; layering cascades along the measured chain. Role labels
appear on a second line, with a role-color border; Cash-Out displays as Probable
endpoint. No animation moves account positions, preserving inspection context.

Floating cards use node rendered positions and update on pan, zoom, resize, node
movement, and layout changes. Cards clamp within the canvas. Significant-event
cards last three seconds of active playback (frozen on pause); the label accent
lasts two. Scrubbing shows the selected significant event without advancing time.
New significant events replace the previous card. Final summary uses distinct
accounts/splits/probable endpoints from the complete trace, even when filtered.

## Verification sources

Implementation uses the installed, pinned dependencies. Timer lifecycle follows
[React effect cleanup](https://react.dev/reference/react/useEffect); card positioning
and cancellable canvas effects use the official
[Cytoscape API](https://js.cytoscape.org/#eles.renderedPosition).
Unit tests cover prefix reconstruction and evidence checks; independent backend
fixtures cover statistical meanings; live Chrome tests cover controls, timing,
race handling, graph effects, viewport positioning, cleanup, and responsive layout.
