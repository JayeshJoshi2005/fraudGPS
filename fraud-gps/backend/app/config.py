"""Environment configuration without machine-specific paths."""

import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    cors_origins: tuple[str, ...]

    @classmethod
    def from_env(cls) -> "Settings":
        data_dir = Path(os.getenv("FRAUD_GPS_DATA_DIR", "app/data"))
        if not data_dir.is_absolute():
            data_dir = BACKEND_ROOT / data_dir
        origins = tuple(
            origin.strip()
            for origin in os.getenv(
                "FRAUD_GPS_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
            ).split(",")
            if origin.strip()
        )
        if not origins or "*" in origins:
            raise ValueError("Configure explicit development origins; wildcard CORS is disabled.")
        return cls(data_dir=data_dir.resolve(), cors_origins=origins)
