# Requirements and Scope

## Sources and interpretation

Reviewed on 22-Oct-2026: all 26 pages of `requirements.pdf` and all of `prompts.txt`. The PDF is image-based and was read visually. Several diagram blocks in the PDF are blank, including the full architecture diagram; the architecture here is a documented proposal derived from its surrounding text and tables.

Use prompt Phases 0–6 for delivery. The PDF's hour-by-hour plan on page 25 uses a different phase numbering scheme; it is reference material, not a second execution schedule. Resolve source differences through [DECISIONS.md](DECISIONS.md).

## Product workflow

Select a complaint → trace transactions → inspect splits, layers, and probable cash-outs → inspect account risk and supporting evidence → replay chronological events → find related cases and campaign signatures → export an investigation report.

The primary local demonstration uses synthetic Indian financial records, masked account labels, Indian currency grouping, and Bihar-focused locations. Gamma Network is the main scenario, Delta Ring provides cross-campaign overlaps, and Lone Wolf provides an independent comparison.

## Requirement map

| ID | Requirement and source | Delivery |
| --- | --- | --- |
| DATA-01 | 50 complaints, 200 accounts, 2,000+ transactions, entity links; three campaigns plus legitimate background activity. Prompt 0; PDF pp. 9–12, 22. | Phase 0 |
| GPS-01 | Chronological multi-hop tracing; splits, merges, rapid forwarding, layering, amount decay, and probable terminals. PDF pp. 4–5, 22; prompt 1. | Phase 1; merge/decay gaps recorded in decisions |
| RISK-01 | Bounded composite account risk, role classification, data-derived reasons and summaries. PDF pp. 12–15; prompt 1. | Phase 1; scoring discrepancy recorded |
| API-01 | Trace, risk, graphs, timeline, and complaint lookup APIs. Prompts 1, 2, 4. | Phase 1 prerequisite for Phase 2 |
| UI-01 | Dark command-center layout, searchable cases, filters, interactive graph, transaction inspection, risk inspector, loading states, Indian formatting. PDF pp. 16–19; prompt 2. | Phase 2 |
| PLAY-01 | Play/pause, stepping, speed, scrubbing, replay, role labels, event cards, and trail statistics. PDF pp. 17–18, 21; prompt 3. | Phase 3 |
| DNA-01 | Entity, behavioral, and topology comparison; composite signature; campaign and similar-case panel; distinct cross-case edges. PDF pp. 5–8, 23; prompt 4. | Phase 4 |
| REPORT-01 | Downloadable PDF containing cover, complaint, trail, suspicious accounts, DNA, recommendations, and supporting evidence references. PDF pp. 14–15, 21, 23; prompt 5. | Phase 5 |
| ALERT-01 | Sorted account alerts, event toasts, case summary, action checklist, keyboard shortcuts. Prompt 5. | Phase 5 |
| QUALITY-01 | Empty/error/retry states, consistent presentation, reliable startup, full local demo rehearsal. Prompt 6. | Throughout; final gate in Phase 6 |
| PERF-01 | Graph renders in under 2 seconds for 50 nodes; API responses under 500 ms. Prompt 6. | Phase 6 measured targets, not current results |

## Scope boundaries

Include the prompt's three DNA types in Phase 4 even though the PDF lists topology comparison as an optional enhancement. Narrative DNA (PDF p. 7), fuzzy beneficiary/branch matching, dormant-mule labels, cluster hulls, geographic overlays, Sankey views, GNNs, and LLM summaries require an explicit scope decision; they are not silently added to the current phases. Graph/route/cluster controls described in prompt 2 need defined behavior before UI implementation.

Use local JSON and in-memory analysis initially. PostgreSQL, live banking feeds, cloud deployment, authentication, production hardening, and operational integrations belong to later planning. Recommendations are informational: the application does not freeze accounts or contact agencies.

Demo figures in the PDF are illustrative, not mandatory outputs or measured performance claims. Similarity scores express matching strength, not proven guilt or calibrated probability. A terminal transfer alone does not prove an ATM withdrawal or other cash-out method.
