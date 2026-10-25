# Phase 5 implementation and verification

Implemented on 25-Oct-2026 following "implement next phase". Scope is ReportLab
exports, alerts, investigation summaries, review checklists, notifications, and
keyboard shortcuts. The minimal layout and taller graph are preserved. Phase 6
has not started.

## Delivered behavior

- A shared, versioned case-summary response contains the exact filtered trace,
  source complaint, DNA, flagged accounts, and evidence-linked review actions.
  The narrative includes complaint date/type, victim, initial recipient/channel,
  conserved funds, and measured patterns. UI and PDF use the same engine results.
- The PDF export has six sections: cover, complaint, money trail, suspicious
  accounts, Fraud DNA, and recommendations. Tables repeat headers and wrap long
  source text and references. Embedded DejaVu fonts render rupee amounts. Every
  page has a case header, classification, dataset identifier, and page number.
- Generate Report works after a completed trace, including an empty result.
  It sends the active options and expected dataset version, validates the PDF
  response, saves a named file, and reports success or failure with retry.
  Case/options changes cancel obsolete downloads; object URLs are released.
- The header alert control lists dataset-wide accounts with risk >=.50, ordered
  by score and account ID. Each item has a measured reason and an Investigate
  action that expands, selects, and centers the account. Failure, empty, and
  changed-dataset states are explicit.
- Case Summary is the third inspector tab. Its review checklist persists across
  tab changes within the same trace, resets on a new trace, links to evidence,
  and can open accounts or related cases. Checkmarks record local review only.
  Each action's accounts, entities, transfers, cases, and priority are validated
  against its supporting trace/DNA evidence before a checklist is displayed.
  Flagged-account roles, transfer ownership, and complaint links are checked too.
- Playback emits source-based split, risk, account-link, rapid-forward, merge,
  layering, and probable-endpoint notifications. The stack is capped at four,
  expires after four seconds, deduplicates repeated account findings, skips
  historical alerts while seeking, and cleans up on case changes/unmount.
- Space toggles playback, arrows step, F fits, R replays, and Escape deselects.
  Native controls, typing, modifiers, handled events, and repeated keys are
  respected. The header icon supports hover and keyboard/click discovery.

## Validation

| Check | Result |
| --- | --- |
| Backend pytest | **117 passed**; includes 10 independent report/summary tests |
| Frontend Vitest | **91 passed** across 8 files |
| Production Chrome suite | **40 passed** against the real backend |
| TypeScript/Vite build | Passed; release metadata 0.5.0 |
| Backend Ruff | Passed; 36 files formatted |
| Frontend Prettier | Passed |
| Dependency consistency | `pip check` passed |
| Synthetic dataset verification | Unchanged: 50 complaints, 200 accounts, 2,344 transactions, 249 entities |

Commands:

```powershell
# fraud-gps/backend
.\.venv\Scripts\python.exe -m pytest -q --basetemp=.pytest-tmp-phase5-final
.\.venv\Scripts\ruff.exe check app tests
.\.venv\Scripts\ruff.exe format --check app tests
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe verify_data.py

# fraud-gps/frontend
npm.cmd test
npm.cmd run test:e2e
npm.cmd run format:check
```

PDF checks parse real output with the development-only PyMuPDF 1.28.2 tool:
section order, Indian currency text, embedded fonts, numbered pages, all transfer
and action references, repeated headers, 120 parallel transfers, long source
descriptions, text within page bounds, and concurrent documents. The browser's
downloaded demo PDF was also parsed and rendered for visual inspection.

Completion audit: regression checks first reproduced acceptance of unrelated
action references. Validation now rejects those payloads while preserving valid
external shared-phone links, endpoint verification, and supported case matches.
Alert reasons fit one line with full hover text. The report's OpenAPI response
declares a binary PDF download without an incorrect JSON success type.

Browser checks cover the existing investigation/DNA/replay flows plus report
failure/retry, invalid content, changed dataset headers, stale summary/download
requests, corrupted action evidence, checklist lifecycle, single-line alert reasons,
alert ranking/navigation/errors, shortcut guards,
toast expiration/seeking/case cleanup, and mobile/empty-trail reporting.

Dataset version:
`d0d8a3c9bcbda6f0ec298414400312d6e9011559c357987e28d34ee945846504`.
`AGENTS.md`, source datasets, generator, and earlier screenshots are preserved.

## Review artifacts

- [Downloaded first-case report](reports/FraudGPS-BH-2026-0001-Investigation.pdf),
  generated through the browser with depth 5, minimum INR 100, and a 24-hour window.
  This 19-page example includes all 36 transfers and 17 recommended actions, with
  100 extracted rupee glyphs and complete transfer/action references.
- [Case summary and checklist](screenshots/phase5-summary.png)
- [Account alerts](screenshots/phase5-alerts.png)
- [Playback notifications](screenshots/phase5-toasts.png)
- [Mobile summary and download](screenshots/phase5-mobile-summary.png)
- [PDF cover](screenshots/phase5-report-cover.png)
- [PDF money trail](screenshots/phase5-report-trail.png)
- [PDF account assessments](screenshots/phase5-report-accounts.png)
- [PDF DNA](screenshots/phase5-report-dna.png)
- [PDF recommendations](screenshots/phase5-report-recommendations.png)

## Boundaries

Reports have six sections; dense evidence continues onto additional pages.
The local checklist is not an operational audit
log and is not exported as completed action status. Recommendations do not freeze
accounts, request records, or contact anyone. Account addresses do not establish
withdrawal locations; withdrawal methods remain unknown. Risk is dataset-wide,
while flagged-account scope and roles use the selected trace. Performance targets,
startup automation, final rehearsals, and hosting remain deferred to their own scope.

See the [contract](PHASE_5_CONTRACT.md), [API guide](../fraud-gps/backend/API.md), and
[frontend guide](../fraud-gps/frontend/README.md) for request and usage details.
