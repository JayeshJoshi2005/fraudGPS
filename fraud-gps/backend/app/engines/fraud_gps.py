"""Chronological FIFO attribution with explicit limits and conservation of funds."""

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal

from app.engines.graph_builder import GraphBuilder
from app.models.analysis import (
    Allocation,
    Balance,
    Detection,
    DetectionOutput,
    TraceMetrics,
    TraceOptions,
    TraceResult,
    TrailStep,
)

ZERO = Decimal("0.00")
PATTERN_WINDOW = timedelta(minutes=30)


@dataclass
class Lot:
    account: str
    receipt: str
    timestamp: datetime
    amount: Decimal
    path: list[str]


class FraudGPS:
    def __init__(self, graph: GraphBuilder):
        self.graph = graph

    def trace_money_trail(
        self,
        start_account: str,
        start_tx_id: str | None = None,
        max_depth: int = 5,
        min_amount: Decimal = Decimal("100.00"),
        forwarding_window_hours: int = 24,
        complaint_id: str | None = None,
    ) -> TraceResult:
        options = TraceOptions(
            max_depth=max_depth,
            min_amount=min_amount,
            forwarding_window_hours=forwarding_window_hours,
        )
        self.graph.require_account(start_account)
        if start_tx_id is not None:
            initial = self.graph.dataset.transactions_by_id.get(start_tx_id)
            if initial is None:
                raise KeyError(f"Unknown transaction: {start_tx_id}")
            if initial.from_account != start_account:
                raise ValueError("Initial transaction must originate at the start account")
        window = timedelta(hours=options.forwarding_window_hours)
        lots = defaultdict(list)
        steps = []
        stopped = []
        seed_amount = ZERO
        for tx in self.graph.transactions:
            seed = tx.tx_id == start_tx_id if start_tx_id else tx.from_account == start_account
            allocations = []
            if seed:
                if tx.amount < options.min_amount:
                    continue
                seed_amount += tx.amount
                allocations.append(Allocation(amount=tx.amount, path=[tx.tx_id], depth=1))
            else:
                capacity = tx.amount
                for lot in lots[tx.from_account]:
                    if lot.amount == 0 or lot.timestamp >= tx.timestamp:
                        continue
                    if tx.timestamp - lot.timestamp > window:
                        # Preserve the balance at its observation window, but never spend
                        # it on later transfers. Later activity must not erase an endpoint.
                        continue
                    if capacity == 0:
                        break
                    amount = min(capacity, lot.amount)
                    capacity -= amount
                    lot.amount -= amount
                    reason = None
                    if len(lot.path) >= options.max_depth:
                        reason = "max_depth"
                    elif tx.amount < options.min_amount:
                        reason = "min_amount"
                    if reason:
                        stopped.append(
                            Balance(
                                account_id=lot.account,
                                receipt_tx_id=lot.receipt,
                                amount=amount,
                                reason=reason,
                                stopping_tx_id=tx.tx_id,
                            )
                        )
                    else:
                        allocations.append(
                            Allocation(
                                amount=amount,
                                path=[*lot.path, tx.tx_id],
                                parent_tx_id=lot.receipt,
                                depth=len(lot.path) + 1,
                            )
                        )
            if not allocations:
                continue
            step = TrailStep(
                **tx.model_dump(),
                allocations=allocations,
                attributed_amount=sum((a.amount for a in allocations), ZERO),
                depth=min(a.depth for a in allocations),
            )
            steps.append(step)
            for allocation in allocations:
                lots[tx.to_account].append(
                    Lot(
                        tx.to_account,
                        tx.tx_id,
                        tx.timestamp,
                        allocation.amount,
                        allocation.path,
                    )
                )
        balances = []
        terminals = []
        for account, receipts in lots.items():
            for lot in receipts:
                if lot.amount == 0:
                    continue
                onward = [
                    tx
                    for tx in self.graph.outgoing[account]
                    if lot.timestamp < tx.timestamp <= lot.timestamp + window
                    and tx.amount >= options.min_amount
                ]
                complete = self.graph.observed_until >= lot.timestamp + window
                if not onward and complete:
                    reason = "probable_terminal"
                elif len(lot.path) >= options.max_depth:
                    reason = "max_depth"
                elif not complete:
                    reason = "observation_cutoff"
                else:
                    reason = "retained_balance"
                balance = Balance(
                    account_id=account,
                    receipt_tx_id=lot.receipt,
                    amount=lot.amount,
                    reason=reason,
                )
                balances.append(balance)
                if reason == "probable_terminal":
                    terminals.append(
                        Detection(
                            event_id=f"terminal:{lot.receipt}:{len(terminals)}",
                            type="terminal",
                            timestamp=lot.timestamp + window,
                            account_ids=[account],
                            transaction_ids=[lot.receipt],
                            amount=lot.amount,
                            description="Probable endpoint: no significant onward transfer "
                            "in the window; withdrawal method unknown.",
                            metrics={"window_hours": options.forwarding_window_hours},
                        )
                    )
        nodes = {start_account} | {a for s in steps for a in (s.from_account, s.to_account)}
        result = TraceResult(
            dataset_version=self.graph.dataset.version,
            complaint_id=complaint_id,
            start_account=start_account,
            options=options,
            steps=steps,
            detections=[],
            balances=balances + stopped,
            metrics=TraceMetrics(
                seed_amount=seed_amount,
                hop_volume=sum((s.attributed_amount for s in steps), ZERO),
                retained_amount=sum((b.amount for b in balances), ZERO),
                stopped_amount=sum((b.amount for b in stopped), ZERO),
                probable_terminal_amount=sum((e.amount for e in terminals), ZERO),
                account_count=len(nodes),
                transaction_count=len(steps),
                max_depth_reached=max((a.depth for s in steps for a in s.allocations), default=0),
            ),
            warnings=[
                "Attribution is a FIFO hypothesis through pooled funds, not proof of ownership."
            ],
        )
        result.detections = sorted(
            self.detect_splits(result)
            + self.detect_merges(result)
            + self.detect_rapid_forwards(result)
            + self.detect_layering_chains(result)
            + terminals,
            key=lambda e: (e.timestamp, e.event_id),
        )
        if start_tx_id is None:
            result.warnings.append(
                "Account mode seeds gross outgoing volume; funds may recur in cycles."
            )
        return result

    @staticmethod
    def _links(trail: TraceResult) -> dict:
        steps = {s.tx_id: s for s in trail.steps}
        links = defaultdict(list)
        for step in trail.steps:
            for allocation in step.allocations:
                parent = steps.get(allocation.parent_tx_id)
                if parent and step.timestamp - parent.timestamp <= PATTERN_WINDOW:
                    links[parent.tx_id].append((step, allocation.amount))
        return links

    def detect_splits(self, trail: TraceResult) -> list[Detection]:
        steps = {s.tx_id: s for s in trail.steps}
        events = []
        for parent_id, links in self._links(trail).items():
            destinations = {step.to_account for step, _ in links}
            if len(destinations) < 2:
                continue
            parent = steps[parent_id]
            outgoing = sum((amount for _, amount in links), ZERO)
            outputs = defaultdict(lambda: ZERO)
            for step, amount in links:
                outputs[(step.tx_id, step.to_account)] += amount
            events.append(
                Detection(
                    event_id=f"split:{parent_id}",
                    type="split",
                    timestamp=max(step.timestamp for step, _ in links),
                    account_ids=[parent.to_account, *sorted(destinations)],
                    transaction_ids=[parent_id, *sorted({step.tx_id for step, _ in links})],
                    amount=outgoing,
                    outputs=[
                        DetectionOutput(
                            transaction_id=txid, to_account=target, attributed_amount=amount
                        )
                        for (txid, target), amount in sorted(outputs.items())
                    ],
                    description=f"One receipt funded {len(destinations)} destinations "
                    "within 30 minutes.",
                    metrics={
                        "incoming_amount": str(parent.attributed_amount),
                        "outgoing_amount": str(outgoing),
                        "destination_count": len(destinations),
                        "retained_amount": str(parent.attributed_amount - outgoing),
                        "elapsed_seconds": (
                            max(step.timestamp for step, _ in links) - parent.timestamp
                        ).total_seconds(),
                    },
                )
            )
        return events

    @staticmethod
    def detect_merges(trail: TraceResult) -> list[Detection]:
        steps = {s.tx_id: s for s in trail.steps}
        events = []
        for step in trail.steps:
            parents = {
                a.parent_tx_id
                for a in step.allocations
                if a.parent_tx_id
                and step.timestamp - steps[a.parent_tx_id].timestamp <= PATTERN_WINDOW
            }
            if len({steps[p].from_account for p in parents}) < 2:
                continue
            amount = sum((a.amount for a in step.allocations if a.parent_tx_id in parents), ZERO)
            events.append(
                Detection(
                    event_id=f"merge:{step.tx_id}",
                    type="merge",
                    timestamp=step.timestamp,
                    account_ids=[step.from_account, step.to_account],
                    transaction_ids=[*sorted(parents), step.tx_id],
                    amount=amount,
                    description=f"Transfer combines tracked receipts from {len(parents)} "
                    "transactions.",
                    metrics={"receipt_count": len(parents)},
                )
            )
        return events

    def detect_rapid_forwards(self, trail: TraceResult) -> list[Detection]:
        steps = {s.tx_id: s for s in trail.steps}
        events = []
        for parent_id, links in self._links(trail).items():
            parent = steps[parent_id]
            forwarded = sum((amount for _, amount in links), ZERO)
            ratio = forwarded / parent.attributed_amount
            if ratio <= Decimal("0.8"):
                continue
            events.append(
                Detection(
                    event_id=f"rapid:{parent_id}",
                    type="rapid_forward",
                    timestamp=max(step.timestamp for step, _ in links),
                    account_ids=[parent.to_account],
                    transaction_ids=[parent_id, *sorted({step.tx_id for step, _ in links})],
                    amount=forwarded,
                    description=f"Forwarded {ratio:.1%} of this receipt within 30 minutes.",
                    metrics={
                        "received_amount": str(parent.attributed_amount),
                        "ratio": float(ratio),
                    },
                )
            )
        return events

    @staticmethod
    def detect_layering_chains(trail: TraceResult) -> list[Detection]:
        steps = {s.tx_id: s for s in trail.steps}
        paths = {tuple(a.path) for s in trail.steps for a in s.allocations if len(a.path) >= 4}
        destinations = defaultdict(set)
        for step in trail.steps:
            destinations[step.from_account].add(step.to_account)
        segments = set()
        for path in sorted(paths):
            chain = [steps[tx_id] for tx_id in path]
            for start in range(len(chain) - 3):
                end = start + 1
                while end < len(chain):
                    left, right = chain[end - 1], chain[end]
                    if not (
                        len(destinations[left.to_account]) == 1
                        and right.timestamp - left.timestamp <= PATTERN_WINDOW
                        and Decimal("0.8") <= right.attributed_amount / left.attributed_amount <= 1
                    ):
                        break
                    end += 1
                if end - start >= 4:
                    segments.add(path[start:end])
        # Keep maximal contiguous segments and collapse shared suffixes after merges.
        maximal = [
            p
            for p in segments
            if not any(
                len(q) > len(p) and any(q[i : i + len(p)] == p for i in range(len(q) - len(p) + 1))
                for q in segments
            )
        ]
        events = []
        for path in sorted(maximal):
            chain = [steps[txid] for txid in path]
            retained = sum(
                (a.amount for a in chain[-1].allocations if tuple(a.path[-len(path) :]) == path),
                ZERO,
            )
            initial = chain[0].attributed_amount
            events.append(
                Detection(
                    event_id="layering:" + ":".join(path),
                    type="layering",
                    timestamp=chain[-1].timestamp,
                    account_ids=[chain[0].from_account, *[s.to_account for s in chain]],
                    transaction_ids=list(path),
                    amount=retained,
                    description=f"{len(chain) - 1} consecutive pass-through accounts "
                    "in a timed chain.",
                    metrics={
                        "elapsed_seconds": (
                            chain[-1].timestamp - chain[0].timestamp
                        ).total_seconds(),
                        "incoming_amount": str(initial),
                        "retained_amount": str(retained),
                        "amount_decay": str(initial - retained),
                    },
                )
            )
        return events

    @staticmethod
    def detect_cashout_terminals(trail: TraceResult) -> list[Detection]:
        return [event for event in trail.detections if event.type == "terminal"]
