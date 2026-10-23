# Fraud GPS: Powered by Fraud DNA

An interactive cyber-financial investigation platform for tracing money trails, explaining suspicious accounts, and connecting fraud cases.

## Current state

**Phases 0–4 are implemented and verified.** The backend provides synthetic data, chronological tracing, risk, graphs, timelines, source-derived Fraud DNA, inferred campaign families, and complaint/account APIs. The React frontend supports investigation, inspection, story replay, and a Fraud DNA tab with masked identifier evidence, similar-case navigation, and distinct nonfinancial graph relations. Validation: 107 backend tests, 45 frontend tests, 25 live-browser tests against the production bundle, and a successful build. Phase 5 requires a new request; hosting/cloud work remains deferred.

See the [frontend setup guide](fraud-gps/frontend/README.md), [backend setup guide](fraud-gps/backend/README.md), [API guide](fraud-gps/backend/API.md), and [Phase 4 review with screenshots](docs/PHASE_4_REVIEW.md).

The subsequent [UI refinement](docs/UI_REFRESH_REVIEW.md) gives the graph more room,
clearer labels and arrows, optional side panels, and responsive transaction routes.
Its verification includes 49 frontend tests and 28 production-browser tests.

## Start here

1. Read [Repository Guidelines](AGENTS.md).
2. Read [requirements and scope](docs/REQUIREMENTS.md) for source references and feature coverage.
3. Read [architecture](docs/ARCHITECTURE.md) for module boundaries and proposed contracts.
4. Check [phase plan](docs/PHASES.md) and [progress](docs/PROGRESS.md) before starting work.
5. Review [decisions and discrepancies](docs/DECISIONS.md) before making architectural changes.
6. Review [hackathon alignment](docs/HACKATHON.md) for official submission constraints and the unresolved schedule discrepancy.

## Source documents

- [requirements.pdf](requirements.pdf): product requirements, experience, scoring, architecture, feature tiers, and demo storyline; 26 pages.
- [prompts.txt](prompts.txt): detailed implementation sequence, Phases 0–6.

The PDF describes the product vision. The prompts define the intended delivery sequence. The user's latest instructions govern scope: work locally and complete only the explicitly requested phase before stopping for review.

## Team handoff

Use `docs/PROGRESS.md` as the current status record. Before starting a task, record its owner and scope. After completing it, record changed files, verification evidence, limitations, and the next handoff. Planned work is not implemented work; mark completion only after verification.

Later-phase directories and behavior remain planned. The preserved `AGENTS.md` predates implementation and refers to the PDF's former filename, `hjgj.pdf`; the source is now `requirements.pdf`. Use the backend setup guide for current commands.
