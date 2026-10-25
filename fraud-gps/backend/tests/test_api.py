import pytest
from fastapi.testclient import TestClient

from app.config import BACKEND_ROOT, Settings
from app.main import create_app
from app.repository import DatasetError


def test_health_docs_and_no_later_phase_endpoints(generated_dir):
    settings = Settings(generated_dir, ("http://localhost:3000",))
    with TestClient(create_app(settings)) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert response.json()["phase"] == 1
        assert response.json()["counts"]["accounts"] == 200
        assert len(response.json()["dataset_version"]) == 64
        assert client.get("/docs").status_code == 200
        paths = set(client.get("/openapi.json").json()["paths"])
        assert "/api/trace" in paths
        assert "/api/dna/campaigns" in paths
        assert "/api/report/{complaint_id}" in paths
        assert "/api/report/{complaint_id}/summary" in paths
        assert client.post("/api/trace", json={"account_id": "ACC-000001"}).status_code == 200


def test_cors_allows_configured_origin_and_rejects_other_origin(generated_dir):
    with TestClient(create_app(Settings(generated_dir, ("http://localhost:3000",)))) as client:

        def preflight(origin):
            return client.options(
                "/health", headers={"Origin": origin, "Access-Control-Request-Method": "GET"}
            )

        allowed = preflight("http://localhost:3000")
        assert allowed.status_code == 200
        assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
        denied = preflight("https://untrusted.example")
        assert denied.status_code == 400
        assert "access-control-allow-origin" not in denied.headers


def test_startup_fails_on_missing_dataset(tmp_path):
    with (
        pytest.raises(DatasetError, match="accounts.json"),
        TestClient(create_app(Settings(tmp_path, ("http://localhost:3000",)))),
    ):
        pass


def test_relative_config_is_backend_relative(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("FRAUD_GPS_DATA_DIR", "app/data")
    assert Settings.from_env().data_dir == (BACKEND_ROOT / "app/data").resolve()


def test_wildcard_cors_is_rejected(monkeypatch):
    monkeypatch.setenv("FRAUD_GPS_CORS_ORIGINS", "*")
    with pytest.raises(ValueError, match="wildcard"):
        Settings.from_env()
