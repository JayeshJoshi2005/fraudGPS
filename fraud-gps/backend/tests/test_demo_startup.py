"""Launcher preflight must preserve incomplete and imported source datasets."""

import json
import os
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[3] / "scripts/check_demo.py"


def check(directory):
    return subprocess.run(
        [sys.executable, str(SCRIPT), "dataset"],
        env={**os.environ, "FRAUD_GPS_DATA_DIR": str(directory)},
        capture_output=True,
        text=True,
        check=False,
    )


def test_absent_dataset_is_reported_without_generating_files(tmp_path):
    directory = tmp_path / "absent"
    result = check(directory)
    assert result.returncode == 0
    assert json.loads(result.stdout)["absent"] is True
    assert not directory.exists()


def test_partial_dataset_and_existing_manifest_are_preserved(tmp_path):
    source = tmp_path / "accounts.json"
    source.write_text("[]")
    result = check(tmp_path)
    assert result.returncode != 0
    assert "Partial dataset" in result.stderr
    assert source.read_text() == "[]"
    source.unlink()
    manifest = tmp_path / "manifest.json"
    manifest.write_text("{}")
    result = check(tmp_path)
    assert result.returncode != 0
    assert "not empty" in result.stderr
    assert manifest.read_text() == "{}"


def test_existing_valid_dataset_is_validated_without_changes(generated_dir):
    before = {p.name: p.read_bytes() for p in generated_dir.iterdir()}
    result = check(generated_dir)
    assert result.returncode == 0
    assert json.loads(result.stdout)["counts"]["complaints"] == 50
    assert before == {p.name: p.read_bytes() for p in generated_dir.iterdir()}
