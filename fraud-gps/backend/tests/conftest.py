from pathlib import Path

import pytest

from generate_data import DEFAULT_REFERENCE_DATE, DEFAULT_SEED, write_dataset


@pytest.fixture(scope="session")
def generated_dir(tmp_path_factory) -> Path:
    directory = tmp_path_factory.mktemp("dataset")
    write_dataset(directory, DEFAULT_SEED, DEFAULT_REFERENCE_DATE)
    return directory
