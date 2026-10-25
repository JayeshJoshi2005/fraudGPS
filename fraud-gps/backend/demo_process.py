"""Stop an owned demo server, including Windows virtualenv launcher children."""

import os
import subprocess


def stop_demo_process(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    if os.name == "nt":
        result = subprocess.run(
            ["taskkill.exe", "/PID", str(process.pid), "/T", "/F"],
            capture_output=True,
            timeout=15,
            check=False,
        )
        if result.returncode and process.poll() is None:
            raise RuntimeError(result.stderr.decode(errors="replace"))
        process.wait(timeout=10)
        return
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)
