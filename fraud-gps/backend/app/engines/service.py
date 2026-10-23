"""Dataset-scoped orchestration and serialization shared by all API consumers."""

from app.engines.explainer import format_date, format_inr, generate_case_summary
from app.engines.fraud_gps import FraudGPS
from app.engines.graph_builder import GraphBuilder
from app.engines.risk_scorer import RiskScorer
from app.models.analysis import (
    AccountDetail,
    GraphEdge,
    GraphEdgeData,
    GraphNode,
    GraphNodeData,
    GraphResult,
    TimelineEvent,
    TraceOptions,
    TraceRequest,
    TraceResult,
)
from app.repository import Dataset


class AnalysisService:
    def __init__(self, dataset: Dataset):
        self.graph = GraphBuilder(dataset)
        self.gps = FraudGPS(self.graph)
        self.default_trails = {
            c.complaint_id: self.gps.trace_money_trail(
                c.victim_account, c.initial_tx_id, complaint_id=c.complaint_id
            )
            for c in dataset.complaints
        }
        self.risk = RiskScorer(self.graph, self.default_trails)
        self.risk.score_all_nodes()

    def complaint(self, complaint_id: str):
        if complaint_id not in self.graph.complaints:
            raise KeyError(f"Unknown complaint: {complaint_id}")
        return self.graph.complaints[complaint_id]

    def account_detail(self, account_id: str) -> AccountDetail:
        stats = self.graph.get_node_data(account_id)
        direct = {c.complaint_id for c in self.graph.get_linked_complaints(account_id)}
        return AccountDetail(
            dataset_version=self.graph.dataset.version,
            account=self.graph.dataset.accounts_by_id[account_id],
            **{
                key: stats[key]
                for key in (
                    "total_inflow",
                    "total_outflow",
                    "transaction_count",
                    "distinct_senders",
                    "distinct_recipients",
                )
            },
            average_forward_minutes=self.graph.average_forward_minutes(account_id),
            linked_complaint_ids=sorted(direct | self.risk.membership[account_id]),
        )

    def trace(self, request: TraceRequest) -> TraceResult:
        options = TraceOptions(**request.model_dump(include=set(TraceOptions.model_fields)))
        if request.complaint_id:
            complaint = self.complaint(request.complaint_id)
            if options == TraceOptions():
                result = self.default_trails[request.complaint_id].model_copy(deep=True)
            else:
                result = self.gps.trace_money_trail(
                    complaint.victim_account,
                    complaint.initial_tx_id,
                    complaint_id=request.complaint_id,
                    **options.model_dump(),
                )
        else:
            result = self.gps.trace_money_trail(
                request.account_id, request.start_tx_id, **options.model_dump()
            )
        nodes = {result.start_account} | {
            a for s in result.steps for a in (s.from_account, s.to_account)
        }
        result.roles = {a: self.risk.classify_node_role(a, result) for a in sorted(nodes)}
        complaint = self.complaint(request.complaint_id) if request.complaint_id else None
        victim = self.graph.dataset.accounts_by_id[result.start_account]
        result.summary = generate_case_summary(result, complaint, victim)
        result.summary_transaction_ids = [s.tx_id for s in result.steps]
        return result

    def serialize_graph(self, account_ids=None, trail: TraceResult | None = None) -> GraphResult:
        ids = set(account_ids) if account_ids is not None else set(self.graph.graph.nodes)
        if trail is not None:
            ids = {trail.start_account} | {
                a for s in trail.steps for a in (s.from_account, s.to_account)
            }
        nodes = []
        for account in sorted(ids):
            stats = self.graph.get_node_data(account)
            risk = self.risk.compute_risk_score(account)
            nodes.append(
                GraphNode(
                    data=GraphNodeData(
                        id=account,
                        label=stats["masked_account"],
                        bank_name=stats["bank_name"],
                        holder_name=stats["holder_name"],
                        risk_score=risk.total_score,
                        risk_level=risk.risk_level,
                        role=trail.roles[account].role if trail is not None else risk.role,
                        total_inflow=stats["total_inflow"],
                        total_outflow=stats["total_outflow"],
                        transaction_count=stats["transaction_count"],
                    )
                )
            )
        transfers = trail.steps if trail is not None else self.graph.transactions
        edges = [
            GraphEdge(
                data=GraphEdgeData(
                    id=tx.tx_id,
                    source=tx.from_account,
                    target=tx.to_account,
                    amount=tx.amount,
                    amount_display=format_inr(tx.amount),
                    timestamp=tx.timestamp,
                    date_display=format_date(tx.timestamp),
                    channel=tx.channel,
                    attributed_amount=tx.attributed_amount if trail is not None else None,
                )
            )
            for tx in transfers
            if tx.from_account in ids and tx.to_account in ids
        ]
        return GraphResult(dataset_version=self.graph.dataset.version, nodes=nodes, edges=edges)

    def timeline(self, trail: TraceResult) -> list[TimelineEvent]:
        events = []
        for tx in trail.steps:
            events.append(
                TimelineEvent(
                    step=0,
                    event_id=f"transfer:{tx.tx_id}",
                    type="transfer",
                    timestamp=tx.timestamp,
                    account_ids=[tx.from_account, tx.to_account],
                    transaction_ids=[tx.tx_id],
                    amount=tx.attributed_amount,
                    description=f"Attributed {format_inr(tx.attributed_amount)} of "
                    f"{format_inr(tx.amount)} via {tx.channel} on {format_date(tx.timestamp)}.",
                    metrics={"source_amount": str(tx.amount)},
                )
            )
        events.extend(TimelineEvent(step=0, **d.model_dump()) for d in trail.detections)
        events.sort(key=lambda e: (e.timestamp, e.type != "transfer", e.event_id))
        for index, event in enumerate(events, 1):
            event.step = index
        return events
