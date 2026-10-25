# Fraud GPS: Powered by Fraud DNA

An interactive cyber-financial investigation platform for tracing money trails, explaining suspicious accounts, and connecting fraud cases.

## Current state

**Phases 0–6 and the modular redesign are implemented and verified locally (v0.7.0).** The application traces synthetic financial records, explains risk, compares Fraud DNA, replays evidence, and exports investigation PDFs. The workspace now separates **Cases, Money Trail, Fraud DNA, and Case Summary**, with a large graph, optional settings, desktop navigation, and mobile navigation. Validation: **122 backend tests, 99 frontend tests, and 50 production-browser tests**, plus build, formatting, startup, replacement-data, and PDF checks. Hosting and team recording/submission remain separate tasks.

Run [start_demo.bat](start_demo.bat) from Windows, then open http://127.0.0.1:3000. See the [modular workspace review and screenshots](docs/MODULAR_UI_REVIEW.md), [demo and recording guide](docs/DEMO_GUIDE.md), [frontend guide](fraud-gps/frontend/README.md), [backend guide](fraud-gps/backend/README.md), and [API guide](fraud-gps/backend/API.md).

The [UI refinement](docs/UI_REFRESH_REVIEW.md) gives the graph more room,
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

The PDF describes the product vision. The prompts define the intended delivery sequence. The user's latest instruction authorizes finishing the local project and simplifying its interface; hosting and actual team submission remain separate.

## Team handoff

Use `docs/PROGRESS.md` as the current status record. Before starting a task, record its owner and scope. After completing it, record changed files, verification evidence, limitations, and the next handoff. Planned work is not implemented work; mark completion only after verification.

The preserved `AGENTS.md` predates implementation and refers to the PDF's former filename, `hjgj.pdf`; the source is now `requirements.pdf`. Use the demo and backend guides for current commands.
