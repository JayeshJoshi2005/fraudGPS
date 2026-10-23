"""Transaction-preserving graph projections, independent of HTTP and fixtures."""

from collections import defaultdict
from decimal import Decimal

import networkx as nx

from app.repository import Dataset


class GraphBuilder:
    def __init__(self, dataset: Dataset):
        self.dataset = dataset
        self.graph = nx.MultiDiGraph()
        self.entity_graph = nx.Graph()
        self.incoming = defaultdict(list)
        self.outgoing = defaultdict(list)
        self.complaints = {c.complaint_id: c for c in dataset.complaints}
        for account in dataset.accounts:
            self.graph.add_node(account.account_id, **account.model_dump())
            self.entity_graph.add_node(("account", account.account_id), kind="account")
        self.transactions = sorted(dataset.transactions, key=lambda tx: (tx.timestamp, tx.tx_id))
        for tx in self.transactions:
            self.graph.add_edge(tx.from_account, tx.to_account, key=tx.tx_id, **tx.model_dump())
            self.incoming[tx.to_account].append(tx)
            self.outgoing[tx.from_account].append(tx)
        for entity in dataset.entities:
            key = ("entity", entity.entity_id)
            self.entity_graph.add_node(key, kind="entity", **entity.model_dump())
            for account in entity.linked_accounts:
                self.entity_graph.add_edge(("account", account), key, kind="uses_entity")
        self.observed_until = max((tx.timestamp for tx in self.transactions), default=None)
        nx.freeze(self.graph)
        nx.freeze(self.entity_graph)

    def require_account(self, account_id: str) -> None:
        if account_id not in self.dataset.accounts_by_id:
            raise KeyError(f"Unknown account: {account_id}")

    def get_node_data(self, account_id: str) -> dict:
        self.require_account(account_id)
        incoming, outgoing = self.incoming[account_id], self.outgoing[account_id]
        return {
            **self.dataset.accounts_by_id[account_id].model_dump(),
            "total_inflow": sum((tx.amount for tx in incoming), Decimal("0.00")),
            "total_outflow": sum((tx.amount for tx in outgoing), Decimal("0.00")),
            "transaction_count": len(incoming) + len(outgoing),
            "distinct_senders": len({tx.from_account for tx in incoming}),
            "distinct_recipients": len({tx.to_account for tx in outgoing}),
        }

    def get_neighbors(self, account_id: str) -> list[str]:
        self.require_account(account_id)
        return sorted(
            set(self.graph.predecessors(account_id)) | set(self.graph.successors(account_id))
        )

    def average_forward_minutes(self, account_id: str) -> float | None:
        """Amount-weighted observed FIFO lag; unknown opening balance is excluded."""
        self.require_account(account_id)
        receipts = []
        matched = Decimal("0")
        weighted_seconds = Decimal("0")
        activity = sorted(
            [*self.incoming[account_id], *self.outgoing[account_id]],
            key=lambda tx: (tx.timestamp, tx.tx_id),
        )
        for tx in activity:
            if tx.to_account == account_id:
                receipts.append([tx, tx.amount])
                continue
            remaining = tx.amount
            for receipt in receipts:
                source, available = receipt
                if source.timestamp >= tx.timestamp or not available:
                    continue
                amount = min(remaining, available)
                receipt[1] -= amount
                remaining -= amount
                matched += amount
                seconds = Decimal(str((tx.timestamp - source.timestamp).total_seconds()))
                weighted_seconds += amount * seconds
                if not remaining:
                    break
        return float(weighted_seconds / matched / 60) if matched else None

    def get_subgraph(self, account_id: str, depth: int = 3) -> nx.MultiDiGraph:
        self.require_account(account_id)
        if not 0 <= depth <= 7:
            raise ValueError("Neighborhood depth must be between 0 and 7")
        nodes = nx.single_source_shortest_path_length(
            self.graph.to_undirected(as_view=True), account_id, cutoff=depth
        )
        return self.graph.subgraph(nodes)

    def get_linked_complaints(self, account_id: str) -> list:
        self.require_account(account_id)
        return [
            c
            for c in self.dataset.complaints
            if account_id in (c.victim_account, c.suspect_account)
        ]
