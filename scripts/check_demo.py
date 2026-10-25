"""Small launcher preflight; dependency inspection needs only the standard library."""

import argparse
import importlib.metadata
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "fraud-gps/backend"


def dependencies():
    missing = []
    for line in (BACKEND / "requirements.txt").read_text().splitlines():
        match = re.fullmatch(r"([\w-]+)(?:\[[\w,]+\])?==([^\s]+)", line.strip())
        if not match:
            continue
        name, expected = match.groups()
        try:
            installed = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            installed = None
        if installed != expected:
            missing.append(f"{name}=={expected}")
    return {"ready": not missing, "missing": missing}


def dataset():
    sys.path.insert(0, str(BACKEND))
    from app.config import Settings
    from app.repository import load_dataset

    directory = Settings.from_env().data_dir
    names = ("accounts", "complaints", "transactions", "entities")
    existing = [name for name in names if (directory / f"{name}.json").exists()]
    if not existing:
        # An existing manifest or other files may belong to an interrupted/imported set.
        if directory.exists() and any(directory.iterdir()):
            raise ValueError(
                f"Dataset directory is not empty: {directory}. No data was changed."
            )
        return {"absent": True, "directory": str(directory)}
    if len(existing) != len(names):
        raise ValueError(
            f"Partial dataset in {directory}. Restore all four files; no data was changed."
        )
    data = load_dataset(directory)
    return {
        "absent": False,
        "directory": str(directory),
        "version": data.version,
        "counts": data.counts,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("check", choices=("dependencies", "dataset"))
    args = parser.parse_args()
    try:
        print(json.dumps(dependencies() if args.check == "dependencies" else dataset()))
    except (OSError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
