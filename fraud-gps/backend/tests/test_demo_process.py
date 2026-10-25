import json
import os
import socket
import subprocess
import sys
import time

import pytest

from demo_process import stop_demo_process


@pytest.mark.skipif(os.name != "nt", reason="Windows virtualenv process-tree regression")
def test_stopping_owned_server_closes_child_listener(tmp_path):
    ready = tmp_path / "ready.json"
    child_code = """
import json, socket, sys, time
from pathlib import Path
with socket.socket() as listener:
    listener.bind(('127.0.0.1', 0))
    listener.listen()
    Path(sys.argv[1]).write_text(json.dumps({'port': listener.getsockname()[1]}))
    time.sleep(60)
"""
    parent_code = """
import subprocess, sys
child = subprocess.Popen([sys.executable, '-c', sys.argv[1], sys.argv[2]])
child.wait()
"""
    process = subprocess.Popen([sys.executable, "-c", parent_code, child_code, str(ready)])
    try:
        deadline = time.monotonic() + 10
        while not ready.exists():
            assert process.poll() is None
            assert time.monotonic() < deadline, "Child listener did not become ready"
            time.sleep(0.05)
        port = json.loads(ready.read_text())["port"]
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            pass
        stop_demo_process(process)
        assert process.poll() is not None
        with socket.socket() as probe:
            assert probe.connect_ex(("127.0.0.1", port)) != 0
        stop_demo_process(process)  # Repeated cleanup is harmless.
    finally:
        stop_demo_process(process)
