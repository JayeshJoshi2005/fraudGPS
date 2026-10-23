# Repository Guidelines

## Project Structure & Module Organization

This repository currently contains `prompts.txt`, the phased implementation brief for **Fraud GPS: Powered by Fraud DNA**, and `hjgj.pdf`, a reference document. Application code, dependency manifests, and tests have not been created yet.

The brief proposes a `fraud-gps/` application directory:

- `backend/app/routes/`: FastAPI endpoints for tracing, risk, DNA, graphs, reports, and timelines.
- `backend/app/engines/`: graph construction, money tracing, risk scoring, and explanations.
- `backend/app/models/schemas.py`: Pydantic data models.
- `backend/app/data/`: generated synthetic JSON datasets.
- `backend/generate_data.py`: synthetic data generator.
- `frontend/`: planned React and TypeScript interface, including graph visualization and UI assets.

Keep HTTP handling in routes and reusable analysis logic in engines.

## Build, Test, and Development Commands

No runnable application or build scripts exist yet. Once the planned scaffold is implemented, use:

- From `fraud-gps/backend`, `python -m pip install -r requirements.txt` to install backend dependencies.
- From the same directory, `python generate_data.py` to generate demo datasets.
- From the same directory, `python -m uvicorn app.main:app --reload --port 8000` to run the API.
- From `fraud-gps/frontend`, `npm install` and `npm start` to install dependencies and launch the planned frontend on port 3000.

Confirm frontend scripts against its eventual `package.json`.

## Coding Style & Naming Conventions

Until tooling is configured, use four-space Python indentation, `snake_case` functions and modules, and `PascalCase` models. Use two-space TypeScript indentation, `PascalCase` React components, and `camelCase` functions and variables. No formatter or linter is currently configured; document any tooling introduced.

## Testing Guidelines

No test framework or coverage threshold exists. For backend tests, prefer pytest with `test_*.py` files under `backend/tests/`. Verify chronological tracing, splits, risk bounds, and entity links. Manually check complaint selection, graph inspection, timeline playback, and PDF downloads using synthetic data. Document test commands when tests are added.

## Commit & Pull Request Guidelines

There is no commit history to establish conventions. Use concise imperative messages, such as `Add synthetic fraud data generator`. Keep changes scoped to the requested phase. PRs should describe behavior, link relevant issues or brief sections, record validation, and include screenshots for UI changes.

## Security & Configuration

Use synthetic financial records only. Keep credentials, local environments, and real personal data out of commits. Restrict permissive demo CORS settings before deployment.
