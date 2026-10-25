"""Application startup and a truthful local readiness endpoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException

from app.config import Settings
from app.engines.service import AnalysisService
from app.repository import load_dataset
from app.routes import accounts, complaints, dna, graph, report, risk, timeline, trace


class HealthResponse(BaseModel):
    status: str
    phase: int
    dataset_version: str
    counts: dict[str, int]


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.dataset = load_dataset(settings.data_dir)
        app.state.analysis = AnalysisService(app.state.dataset)
        yield

    application = FastAPI(
        title="Fraud GPS: Powered by Fraud DNA",
        version="0.7.0",
        description=(
            "Local synthetic-data tracing, risk, DNA, timeline, summary, and PDF report APIs."
        ),
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        expose_headers=["X-Dataset-Version", "Content-Disposition"],
    )
    for module in (trace, risk, dna, graph, report, timeline, complaints, accounts):
        application.include_router(module.router)

    @application.exception_handler(KeyError)
    async def missing_record(request: Request, exc: KeyError):
        return JSONResponse(
            status_code=404, content={"error": {"code": "not_found", "message": str(exc.args[0])}}
        )

    @application.exception_handler(ValueError)
    async def invalid_value(request: Request, exc: ValueError):
        return JSONResponse(
            status_code=422, content={"error": {"code": "invalid_input", "message": str(exc)}}
        )

    @application.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "invalid_input",
                    "message": "Request validation failed",
                    "details": [
                        {"location": list(e["loc"]), "message": e["msg"]} for e in exc.errors()
                    ],
                }
            },
        )

    @application.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": "http_error", "message": str(exc.detail)}},
            headers=exc.headers,
        )

    @application.get("/health", response_model=HealthResponse, tags=["system"])
    def health(request: Request) -> HealthResponse:
        dataset = request.app.state.dataset
        return HealthResponse(
            status="ok", phase=1, dataset_version=dataset.version, counts=dataset.counts
        )

    return application


app = create_app()
