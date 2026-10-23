"""Launch a temporary local server, check every Phase 1 API, and shut it down."""

import json
import socket
import subprocess
import sys
import time
from collections import Counter
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen


def main() -> None:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--log-level",
            "error",
        ],
        cwd=Path(__file__).resolve().parent,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    def request(path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = Request(base + path, data=data, headers={"Content-Type": "application/json"})
        with urlopen(req, timeout=10) as response:
            assert response.status == 200
            return json.load(response)

    try:
        deadline = time.monotonic() + 20
        while True:
            try:
                health = request("/health")
                break
            except URLError:
                if process.poll() is not None or time.monotonic() >= deadline:
                    raise RuntimeError("API did not become ready") from None
                time.sleep(0.1)
        complaints = request("/api/complaints")
        complaint = complaints["items"][0]
        cid, aid = complaint["complaint_id"], complaint["suspect_account"]
        trail = request("/api/trace", {"complaint_id": cid})
        graph = request("/api/graph/full")
        subgraph = request(f"/api/graph/subgraph/{aid}?depth=2")
        trail_graph = request(f"/api/graph/trail/{cid}")
        timeline = request(f"/api/timeline/{cid}")
        risk = request(f"/api/risk/{aid}")
        ranking = request("/api/risk/top?limit=20")
        detail = request(f"/api/complaints/{cid}")
        assert detail["trace"] == trail
        assert len(trail_graph["edges"]) == len(trail["steps"])
        assert sum(e["type"] == "transfer" for e in timeline) == len(trail["steps"])
        assert len(ranking) == 20 and subgraph["nodes"]
        print(
            json.dumps(
                {
                    "base_url": base,
                    "health": health,
                    "complaint_id": cid,
                    "graph_nodes": len(graph["nodes"]),
                    "graph_edges": len(graph["edges"]),
                    "trace_metrics": trail["metrics"],
                    "detections": dict(Counter(e["type"] for e in trail["detections"])),
                    "timeline_events": len(timeline),
                    "suspect_risk": risk["total_score"],
                    "checked_endpoints": 10,
                },
                indent=2,
            )
        )
    finally:
        process.terminate()
        try:
            output, _ = process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            output, _ = process.communicate(timeout=5)
        if output:
            print(output.decode(errors="replace"), file=sys.stderr)


if __name__ == "__main__":
    main()
