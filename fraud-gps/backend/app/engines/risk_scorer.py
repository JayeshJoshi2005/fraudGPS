"""Bounded, transparent risk heuristics over observed records and complaint trails."""

from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

import networkx as nx

from app.engines.explainer import format_inr, generate_explanation
from app.engines.graph_builder import GraphBuilder
from app.models.analysis import Evidence, RiskResult, Role, TraceResult

WEIGHTS = {
    "anomaly": 0.20,
    "graph": 0.20,
    "complaints": 0.20,
    "temporal": 0.15,
    "dormancy": 0.10,
    "entity": 0.15,
}

FORMULAS = {
    "anomaly": "Mean of min(in,out)/max(in,out), FIFO 30-minute forwarding fraction, "
    "and min(1, max(0, distinct_recipients-1)/4); zero flow terms when no inflow.",
    "graph": "Mean of min(1, directed_degree/6) and min(1, 5*normalized_betweenness) "
    "in the complaint-derived account subgraph.",
    "complaints": "Max of 1/(directed_distance_from_suspect+1), within 3 hops, "
    "and 0.8 for default-trail membership; victim-only accounts score zero.",
    "temporal": "Maximum max(0, (burst_count-max(1, baseline_per_hour))/burst_count) "
    "over forward one-hour windows; baseline uses up to 7 preceding days and "
    "requires at least 24 hours of prior observed history.",
    "dormancy": "min(1, longest_observed_gap_days/60), requiring gap >=30 days "
    "followed by >=3 transactions in one hour; otherwise zero.",
    "entity": "min(1, distinct_complaint_linked_phone_device_upi_peers/3).",
}


def risk_level(score: float) -> str:
    return (
        "Low" if score < 0.3 else "Medium" if score < 0.5 else "High" if score < 0.7 else "Critical"
    )


class RiskScorer:
    def __init__(self, graph: GraphBuilder, complaint_trails: dict[str, TraceResult]):
        self.graph = graph
        self.trails = complaint_trails
        self.membership = defaultdict(set)
        self.patterns = defaultdict(set)
        self.victims = {c.victim_account for c in graph.dataset.complaints}
        self.suspects = {c.suspect_account for c in graph.dataset.complaints}
        suspicious = set()
        for complaint_id, trail in complaint_trails.items():
            for step in trail.steps:
                for account in (step.from_account, step.to_account):
                    self.membership[account].add(complaint_id)
                    if account != trail.start_account:
                        suspicious.add(account)
            for detection in trail.detections:
                # The first account is the actor; other nodes are supporting context.
                if detection.type == "layering":
                    for account in detection.account_ids[1:-1]:
                        self.patterns[account].add("layering")
                else:
                    self.patterns[detection.account_ids[0]].add(detection.type)
        self.suspicious = suspicious | self.suspects
        projection = nx.DiGraph(graph.graph.subgraph(self.suspicious))
        self.centrality = nx.betweenness_centrality(projection) if projection else {}
        self.degree = dict(projection.degree())
        self.distances = {}
        for suspect in self.suspects:
            for account, distance in nx.single_source_shortest_path_length(
                graph.graph, suspect, cutoff=3
            ).items():
                self.distances[account] = min(distance, self.distances.get(account, 4))
        self._scores = {}

    def classify_node_role(self, account_id: str, trail: TraceResult | None = None) -> Role:
        stats = self.graph.get_node_data(account_id)
        patterns = set(self.patterns[account_id]) if trail is None else set()
        reached = account_id in self.suspicious
        if trail is not None:
            reached = any(s.to_account == account_id for s in trail.steps)
            for event in trail.detections:
                actors = (
                    event.account_ids[1:-1] if event.type == "layering" else event.account_ids[:1]
                )
                if account_id in actors:
                    patterns.add(event.type)
        if account_id in self.victims and account_id not in self.suspects:
            return Role(
                role="Victim", confidence=1, reasons=["Named victim in a source complaint."]
            )
        candidates = [
            (
                "split" in patterns,
                "Splitter",
                0.85,
                "A traced receipt funds multiple destinations.",
            ),
            (
                reached and stats["distinct_senders"] >= 3,
                "Collector",
                0.75,
                f"Observed {stats['distinct_senders']} distinct inbound senders.",
            ),
            (
                len(self.membership[account_id]) >= 2,
                "Bridge",
                0.75,
                f"Appears in {len(self.membership[account_id])} complaint trails.",
            ),
            (
                "layering" in patterns or "rapid_forward" in patterns,
                "Layering Node",
                0.7,
                "Observed rapid pass-through behavior in the analyzed trail(s).",
            ),
            (
                self.centrality.get(account_id, 0) >= 0.1,
                "Hub",
                0.65,
                "Betweenness is at least 0.1 in the complaint-derived subgraph.",
            ),
            (
                "terminal" in patterns,
                "Cash-Out",
                0.5,
                "Probable endpoint in an observed window; withdrawal method unknown.",
            ),
        ]
        for matches, role, confidence, reason in candidates:
            if matches:
                return Role(role=role, confidence=confidence, reasons=[reason])
        return Role(
            role="Normal", confidence=0.5, reasons=["No role rule matched the observed evidence."]
        )

    def _rapid_forwarding(self, account_id: str) -> tuple[float, list[str]]:
        incoming = self.graph.incoming[account_id]
        activity = sorted(
            [*incoming, *self.graph.outgoing[account_id]], key=lambda t: (t.timestamp, t.tx_id)
        )
        receipts = []
        forwarded = Decimal("0.00")
        evidence = set()
        for tx in activity:
            if tx.to_account == account_id:
                receipts.append([tx, tx.amount])
                continue
            capacity = tx.amount
            for receipt in receipts:
                source, remaining = receipt
                if remaining == 0 or source.timestamp >= tx.timestamp:
                    continue
                amount = min(capacity, remaining)
                receipt[1] -= amount
                capacity -= amount
                if tx.timestamp - source.timestamp <= timedelta(minutes=30) and amount:
                    forwarded += amount
                    evidence.update((source.tx_id, tx.tx_id))
                if capacity == 0:
                    break
        total = sum((t.amount for t in incoming), Decimal("0.00"))
        return (float(forwarded / total) if total else 0), sorted(evidence)

    def _temporal(self, account_id: str) -> tuple[float, float, list[Evidence]]:
        activity = sorted(
            [*self.graph.incoming[account_id], *self.graph.outgoing[account_id]],
            key=lambda t: (t.timestamp, t.tx_id),
        )
        peak = []
        peak_score = 0.0
        baseline = 0.0
        dormancy = 0.0
        dormant_ids = []
        gap_days = 0.0
        for i, tx in enumerate(activity):
            burst = [t for t in activity[i:] if t.timestamp < tx.timestamp + timedelta(hours=1)]
            history = [t for t in activity[:i] if t.timestamp >= tx.timestamp - timedelta(days=7)]
            observed_hours = min(168, (tx.timestamp - activity[0].timestamp).total_seconds() / 3600)
            if observed_hours >= 24:
                expected = len(history) / observed_hours
                score = max(0.0, (len(burst) - max(1, expected)) / max(1, len(burst)))
                if score > peak_score:
                    peak_score, peak, baseline = score, burst, expected
            if i:
                gap = (tx.timestamp - activity[i - 1].timestamp).total_seconds() / 86400
                if gap >= 30 and len(burst) >= 3 and gap > gap_days:
                    gap_days = gap
                    dormancy = min(1.0, gap / 60)
                    dormant_ids = [activity[i - 1].tx_id, *[t.tx_id for t in burst]]
        return (
            peak_score,
            dormancy,
            [
                Evidence(
                    code="temporal",
                    description=f"Peak qualifying burst has {len(peak)} transactions "
                    f"in one hour; preceding observed baseline is {baseline:.3f} per hour. "
                    "At least 24 hours of prior observations are required.",
                    transaction_ids=[t.tx_id for t in peak],
                    values={"peak_count": len(peak), "baseline_per_hour": baseline},
                ),
                Evidence(
                    code="dormancy",
                    description=f"Observed inactive gap before a burst of at least "
                    f"3 transactions: {gap_days:.2f} days; account age is not used.",
                    transaction_ids=dormant_ids,
                    values={"observed_gap_days": gap_days},
                ),
            ],
        )

    def compute_risk_score(self, account_id: str) -> RiskResult:
        self.graph.require_account(account_id)
        if account_id in self._scores:
            return self._scores[account_id].model_copy(deep=True)
        stats = self.graph.get_node_data(account_id)
        rapid, rapid_ids = self._rapid_forwarding(account_id)
        inflow, outflow = stats["total_inflow"], stats["total_outflow"]
        balance_ratio = (
            float(min(inflow, outflow) / max(inflow, outflow)) if inflow and outflow else 0
        )
        fragment = min(1.0, max(0, stats["distinct_recipients"] - 1) / 4) if inflow else 0
        anomaly = (balance_ratio + rapid + fragment) / 3
        graph_score = (
            min(1, self.degree.get(account_id, 0) / 6)
            + min(1, self.centrality.get(account_id, 0) * 5)
        ) / 2
        distance = self.distances.get(account_id)
        complaint_score = 1 / (distance + 1) if distance is not None else 0
        if self.membership[account_id] and account_id not in self.victims:
            complaint_score = max(complaint_score, 0.8)
        if account_id in self.victims and account_id not in self.suspects:
            complaint_score = 0
        temporal, dormancy, temporal_evidence = self._temporal(account_id)
        shared_entities = []
        peers = set()
        for entity in self.graph.dataset.entities:
            if entity.entity_type not in {"phone", "device_id", "upi_id"}:
                continue
            linked = (set(entity.linked_accounts) - {account_id}) & self.suspicious
            if account_id in entity.linked_accounts and linked:
                shared_entities.append(entity.entity_id)
                peers.update(linked)
        components = {
            "anomaly": anomaly,
            "graph": graph_score,
            "complaints": complaint_score,
            "temporal": temporal,
            "dormancy": dormancy,
            "entity": min(1, len(peers) / 3),
        }
        total = sum(components[key] * weight for key, weight in WEIGHTS.items())
        role = self.classify_node_role(account_id)
        incoming = self.graph.incoming[account_id]
        outgoing = self.graph.outgoing[account_id]
        evidence = [
            Evidence(
                code="flow",
                description=f"Received {format_inr(inflow)} from "
                f"{stats['distinct_senders']} distinct senders and sent {format_inr(outflow)} "
                f"to {stats['distinct_recipients']} recipients.",
                transaction_ids=sorted(t.tx_id for t in [*incoming, *outgoing]),
                values={
                    "inflow": str(inflow),
                    "outflow": str(outflow),
                    "balance_ratio": balance_ratio,
                    "fragmentation": fragment,
                },
            ),
            Evidence(
                code="rapid",
                description=f"FIFO matched {rapid:.1%} of observed incoming "
                "funds to outgoing transfers within 30 minutes.",
                transaction_ids=rapid_ids,
                values={"ratio": rapid},
            ),
            Evidence(
                code="graph",
                description=f"Directed degree {self.degree.get(account_id, 0)} and normalized "
                f"betweenness {self.centrality.get(account_id, 0):.4f} "
                "in the complaint-derived subgraph.",
                values={
                    "degree": self.degree.get(account_id, 0),
                    "betweenness": self.centrality.get(account_id, 0),
                },
            ),
            Evidence(
                code="complaints",
                description=f"Appears in {len(self.membership[account_id])} "
                "default complaint trails; graph proximity is not proof of involvement.",
                complaint_ids=sorted(self.membership[account_id]),
                values={
                    "trail_count": len(self.membership[account_id]),
                    "suspect_distance": distance if distance is not None else -1,
                },
            ),
            *temporal_evidence,
            Evidence(
                code="entity",
                description=f"Shares phone/device/UPI entities with "
                f"{len(peers)} complaint-linked peers.",
                entity_ids=sorted(shared_entities),
                values={"peer_count": len(peers)},
            ),
        ]
        result = RiskResult(
            dataset_version=self.graph.dataset.version,
            account_id=account_id,
            total_score=total,
            component_scores=components,
            weights=WEIGHTS,
            component_formulas=FORMULAS,
            risk_level=risk_level(total),
            **role.model_dump(),
            evidence=evidence,
            explanations=[],
        )
        result.explanations = generate_explanation(account_id, result)
        self._scores[account_id] = result
        return result.model_copy(deep=True)

    def score_all_nodes(self) -> list[RiskResult]:
        return sorted(
            [self.compute_risk_score(a.account_id) for a in self.graph.dataset.accounts],
            key=lambda r: (-r.total_score, r.account_id),
        )
