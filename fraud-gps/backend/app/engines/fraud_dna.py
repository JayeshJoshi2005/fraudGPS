"""Deterministic source-derived matching; generator truth is never consulted."""

from collections import Counter, OrderedDict, defaultdict
from dataclasses import dataclass
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal
from hashlib import sha256
from itertools import combinations
from threading import RLock
from zoneinfo import ZoneInfo

import networkx as nx

from app.engines.fraud_gps import FraudGPS
from app.engines.graph_builder import GraphBuilder
from app.models.analysis import TraceOptions, TraceResult
from app.models.dna import (
    BehavioralDNA,
    BehavioralFingerprint,
    Campaign,
    CampaignList,
    CampaignMatch,
    ComponentMatch,
    ComponentScores,
    DNAGraph,
    DNAReport,
    EntityDNA,
    EntityLink,
    EntityLinkData,
    EntityMatch,
    NetworkDNA,
    NetworkFeatures,
    OperatingHours,
    SimilarCase,
)

METHOD = "source-dna-v1"
WEIGHTS = {"entity": 0.40, "behavioral": 0.35, "network": 0.25}
BEHAVIOR_WEIGHTS = {
    "amount": 0.18,
    "forwarding": 0.18,
    "split": 0.14,
    "hours": 0.20,
    "hops": 0.14,
    "channels": 0.10,
    "dormancy": 0.06,
}
ENTITY_THRESHOLD = 0.25
SIGNATURE_THRESHOLD = 0.65
IST = ZoneInfo("Asia/Kolkata")
ZERO = Decimal("0.00")
FORMULAS = {
    "entity": "Jaccard overlap of identifiers on non-victim trail accounts; empty union = 0.",
    "behavioral": "Available-weight mean of scalar min/max and histogram intersection: "
    "amount .18, forwarding .18, split .14, IST hours .20, hops .14, channels .10, dormancy .06.",
    "network": "Topology equality .20; node/transfer/unique-edge/max-degree/avg-degree/"
    "fan-in/fan-out ratio .10 each; density/clustering absolute proximity .05 each.",
    "signature": ".40 entity + .35 behavioral + .25 network, all for the same best other case.",
    "campaign": "Connected components of pairs with entity >= .25 AND signature >= .65; "
    "at least two cases. Transitive inferred groups, not confirmed operators.",
}


def ratio(left, right) -> float:
    if left == right:
        return 1.0
    return float(min(left, right) / max(left, right)) if max(left, right) else 0.0


def intersection(left, right) -> float:
    return min(1.0, sum(min(a, b) for a, b in zip(left, right, strict=True)))


def mask_entity(kind: str, value: str) -> str:
    """All values are synthetic; still keep UI/API display fields masked."""
    if len(value) <= 4:
        return "*" * len(value)
    if kind == "email":
        return value[:1] + "***@***" + ("." + value.rsplit(".", 1)[-1] if "." in value else "")
    if kind == "ip_address":
        return (
            "***.***.***." + value.rsplit(".", 1)[-1]
            if "." in value
            else "****:" + value.rsplit(":", 1)[-1]
        )
    return value[:2] + "***" + value[-2:]


@dataclass
class Profile:
    trail: TraceResult
    accounts: set[str]
    entities: set[str]
    behavior: BehavioralFingerprint
    network: NetworkFeatures


@dataclass
class Pair:
    components: ComponentScores
    similarity: float
    coverage: float
    entity_ids: list[str]


@dataclass
class Context:
    profiles: dict[str, Profile]
    memberships: dict[str, set[str]]
    pairs: dict[tuple[str, str], Pair]
    campaigns: list[Campaign]


class FraudDNA:
    def __init__(self, graph: GraphBuilder, default_trails: dict[str, TraceResult]):
        self.graph = graph
        self.gps = FraudGPS(graph)
        self.default_trails = default_trails
        self.version = graph.dataset.version
        self.victim_only = {c.victim_account for c in graph.dataset.complaints} - {
            c.suspect_account for c in graph.dataset.complaints
        }
        self.entities = {entity.entity_id: entity for entity in graph.dataset.entities}
        self.account_entities = defaultdict(set)
        for entity in graph.dataset.entities:
            for account in entity.linked_accounts:
                self.account_entities[account].add(entity.entity_id)
        self._contexts = OrderedDict()
        self._lock = RLock()

    def _context(self, options: TraceOptions) -> Context:
        key = (
            METHOD,
            options.max_depth,
            str(options.min_amount.normalize()),
            options.forwarding_window_hours,
        )
        with self._lock:
            if key in self._contexts:
                self._contexts.move_to_end(key)
                return self._contexts[key]
            profiles = {}
            memberships = defaultdict(set)
            for case in self.graph.dataset.complaints:
                trail = (
                    self.default_trails[case.complaint_id]
                    if options == TraceOptions()
                    else self.gps.trace_money_trail(
                        case.victim_account,
                        case.initial_tx_id,
                        complaint_id=case.complaint_id,
                        **options.model_dump(),
                    )
                )
                accounts = {
                    a for tx in trail.steps for a in (tx.from_account, tx.to_account)
                } - self.victim_only
                entities = {
                    entity for account in accounts for entity in self.account_entities[account]
                }
                profiles[case.complaint_id] = Profile(
                    trail,
                    accounts,
                    entities,
                    self.fingerprint(trail, accounts),
                    self.network_features(trail, accounts),
                )
                for account in accounts:
                    memberships[account].add(case.complaint_id)
            pairs = {
                (a, b): self.compare(profiles[a], profiles[b])
                for a, b in combinations(sorted(profiles), 2)
            }
            context = Context(profiles, memberships, pairs, [])
            context.campaigns = self._campaigns(context)
            self._contexts[key] = context
            while len(self._contexts) > 8:
                self._contexts.popitem(last=False)
            return context

    @staticmethod
    def operating_hours(trail: TraceResult) -> OperatingHours:
        counts = Counter(tx.timestamp.astimezone(IST).hour for tx in trail.steps)
        hours = sorted(counts)
        start = end = None
        wraps = False
        if hours:
            # Remove the largest circular gap to obtain the smallest observed arc.
            gap = max(
                range(len(hours)), key=lambda i: (hours[(i + 1) % len(hours)] - hours[i]) % 24
            )
            start, end = hours[(gap + 1) % len(hours)], (hours[gap] + 1) % 24
            if len(hours) == 24:
                start = end = 0
            wraps = end <= start
        return OperatingHours(
            histogram=[counts[h] / len(trail.steps) if trail.steps else 0 for h in range(24)],
            active_hours=hours,
            start_hour=start,
            end_hour=end,
            wraps_midnight=wraps,
        )

    def fingerprint(self, trail: TraceResult, accounts: set[str]) -> BehavioralFingerprint:
        steps = {step.tx_id: step for step in trail.steps}
        matched = ZERO
        weighted = ZERO
        for step in trail.steps:
            for allocation in step.allocations:
                parent = steps.get(allocation.parent_tx_id)
                if parent and step.timestamp > parent.timestamp:
                    matched += allocation.amount
                    weighted += allocation.amount * Decimal(
                        str((step.timestamp - parent.timestamp).total_seconds())
                    )
        splits = [
            int(event.metrics["destination_count"])
            for event in trail.detections
            if event.type == "split"
        ]
        dormancy = []
        for account in sorted(accounts):
            activation = min(
                tx.timestamp for tx in trail.steps if account in (tx.from_account, tx.to_account)
            )
            activity = self.graph.incoming[account] + self.graph.outgoing[account]
            before = [tx.timestamp for tx in activity if tx.timestamp < activation]
            if before:
                gap = (activation - max(before)).total_seconds() / 86400
                burst = sum(
                    activation <= tx.timestamp <= activation + timedelta(hours=1) for tx in activity
                )
                dormancy.append(gap if gap >= 30 and burst >= 3 else 0.0)
        count = len(trail.steps)
        channels = Counter(tx.channel for tx in trail.steps)
        return BehavioralFingerprint(
            transaction_count=count,
            avg_transaction_amount=(sum((tx.amount for tx in trail.steps), ZERO) / count).quantize(
                Decimal(".01"), rounding=ROUND_HALF_UP
            )
            if count
            else None,
            avg_time_to_forward_minutes=float(weighted / matched / 60) if matched else None,
            split_ratio=sum(splits) / len(splits) if splits else 0,
            operating_hours=self.operating_hours(trail),
            num_hops=trail.metrics.max_depth_reached,
            channel_histogram={
                channel: channels[channel] / count if count else 0
                for channel in ("UPI", "IMPS", "NEFT")
            },
            dormancy_days=sum(dormancy) / len(dormancy) if dormancy else None,
            dormancy_sample_accounts=len(dormancy),
            transaction_ids=[tx.tx_id for tx in trail.steps],
        )

    @staticmethod
    def network_features(trail: TraceResult, accounts: set[str]) -> NetworkFeatures:
        graph = nx.DiGraph()
        graph.add_nodes_from(sorted(accounts))
        transfers = [
            tx for tx in trail.steps if tx.from_account in accounts and tx.to_account in accounts
        ]
        graph.add_edges_from((tx.from_account, tx.to_account) for tx in transfers)
        fan_in = sum(graph.in_degree(a) >= 2 for a in graph)
        fan_out = sum(graph.out_degree(a) >= 2 for a in graph)
        degrees = [degree for _, degree in graph.degree()]
        count = len(graph)
        topology = "empty"
        if graph.number_of_edges():
            if (
                max(dict(graph.in_degree()).values()) <= 1
                and max(dict(graph.out_degree()).values()) <= 1
            ):
                topology = "chain" if nx.is_directed_acyclic_graph(graph) else "cycle"
            elif fan_in and fan_out:
                topology = "fan-in-fan-out"
            elif (
                max(dict(graph.out_degree()).values()) == count - 1
                or max(dict(graph.in_degree()).values()) == count - 1
            ):
                topology = "star"
            else:
                topology = "hub-spoke"
        return NetworkFeatures(
            topology_type=topology,
            node_count=count,
            edge_count=len(transfers),
            unique_edge_count=graph.number_of_edges(),
            max_degree=max(degrees, default=0),
            avg_degree=sum(degrees) / count if count else 0,
            fan_in_count=fan_in,
            fan_out_count=fan_out,
            density=nx.density(graph),
            clustering_coefficient=nx.average_clustering(graph.to_undirected()) if count else 0,
        )

    @staticmethod
    def behavioral_similarity(
        left: BehavioralFingerprint, right: BehavioralFingerprint
    ) -> tuple[float, float]:
        if not left.transaction_count or not right.transaction_count:
            return 0.0, 0.0
        terms = {
            "amount": ratio(left.avg_transaction_amount, right.avg_transaction_amount),
            "split": ratio(left.split_ratio, right.split_ratio),
            "hours": intersection(left.operating_hours.histogram, right.operating_hours.histogram),
            "hops": ratio(left.num_hops, right.num_hops),
            "channels": intersection(
                [left.channel_histogram[c] for c in sorted(left.channel_histogram)],
                [right.channel_histogram[c] for c in sorted(right.channel_histogram)],
            ),
        }
        for name, a, b in [
            ("forwarding", left.avg_time_to_forward_minutes, right.avg_time_to_forward_minutes),
            ("dormancy", left.dormancy_days, right.dormancy_days),
        ]:
            if a is not None and b is not None:
                terms[name] = ratio(a, b)
        coverage = sum(BEHAVIOR_WEIGHTS[name] for name in terms)
        return min(
            1.0, sum(BEHAVIOR_WEIGHTS[name] * score for name, score in terms.items()) / coverage
        ), min(1.0, coverage)

    @staticmethod
    def network_similarity(left: NetworkFeatures, right: NetworkFeatures) -> float:
        if not left.edge_count or not right.edge_count:
            return 0.0
        terms = [
            ratio(getattr(left, field), getattr(right, field))
            for field in (
                "node_count",
                "edge_count",
                "unique_edge_count",
                "max_degree",
                "avg_degree",
                "fan_in_count",
                "fan_out_count",
            )
        ]
        return min(
            1.0,
            0.20 * (left.topology_type == right.topology_type)
            + 0.10 * sum(terms)
            + 0.05 * (1 - abs(left.density - right.density))
            + 0.05 * (1 - abs(left.clustering_coefficient - right.clustering_coefficient)),
        )

    def compare(self, left: Profile, right: Profile) -> Pair:
        shared = sorted(left.entities & right.entities)
        union = left.entities | right.entities
        behavior, coverage = self.behavioral_similarity(left.behavior, right.behavior)
        components = ComponentScores(
            entity=len(shared) / len(union) if union else 0,
            behavioral=behavior,
            network=self.network_similarity(left.network, right.network),
        )
        signature = sum(WEIGHTS[key] * value for key, value in components.model_dump().items())
        return Pair(components, signature, coverage, shared)

    @staticmethod
    def _pair(context: Context, first: str, second: str) -> Pair:
        return context.pairs[tuple(sorted((first, second)))]

    def _campaigns(self, context: Context) -> list[Campaign]:
        graph = nx.Graph()
        graph.add_nodes_from(sorted(context.profiles))
        for (a, b), pair in sorted(context.pairs.items()):
            if (
                pair.components.entity >= ENTITY_THRESHOLD
                and pair.similarity >= SIGNATURE_THRESHOLD
            ):
                graph.add_edge(a, b)
        groups = sorted(
            (sorted(group) for group in nx.connected_components(graph) if len(group) >= 2),
            key=lambda ids: ids[0],
        )
        result = []
        for index, ids in enumerate(groups, 1):
            hours = Counter()
            for cid in ids:
                hours.update(
                    {
                        h: value
                        for h, value in enumerate(
                            context.profiles[cid].behavior.operating_hours.histogram
                        )
                    }
                )
            peak = max(hours, key=lambda h: (hours[h], -h))
            period = "Night" if peak >= 18 or peak < 6 else "Morning" if peak < 12 else "Afternoon"
            topology = Counter(
                context.profiles[cid].network.topology_type for cid in ids
            ).most_common(1)[0][0]
            result.append(
                Campaign(
                    campaign_id="DNA-" + sha256("|".join(ids).encode()).hexdigest()[:10],
                    campaign_name=f"Family {index:02} · {period} activity",
                    complaint_ids=ids,
                    case_count=len(ids),
                    total_loss=sum((self.graph.complaints[cid].amount_lost for cid in ids), ZERO),
                    topology_type=topology,
                    operating_period=period,
                )
            )
        return result

    def compute_entity_dna(self, subject_id: str, options: TraceOptions | None = None) -> EntityDNA:
        options = options or TraceOptions()
        context = self._context(options)
        if subject_id in context.profiles:
            accounts = context.profiles[subject_id].accounts
            excluded = {subject_id}
            memberships = context.memberships
        else:
            self.graph.require_account(subject_id)
            accounts, excluded = {subject_id}, set()
            # Explicit account inspection reports factual victim links too. These
            # links never enter operation fingerprints or campaign scoring.
            memberships = defaultdict(set)
            for cid, profile in context.profiles.items():
                for tx in profile.trail.steps:
                    memberships[tx.from_account].add(cid)
                    memberships[tx.to_account].add(cid)
        matches = []
        for eid in sorted({e for account in accounts for e in self.account_entities[account]}):
            entity = self.entities[eid]
            current = sorted(accounts.intersection(entity.linked_accounts))
            external = sorted(set(entity.linked_accounts) - accounts)
            others = sorted(
                {cid for a in entity.linked_accounts for cid in memberships[a]} - excluded
            )
            if not external and not others:
                continue
            matches.append(
                EntityMatch(
                    entity_id=eid,
                    entity_type=entity.entity_type,
                    masked_value=mask_entity(entity.entity_type, entity.entity_value),
                    matched_account_ids=current,
                    shared_with_accounts=external,
                    shared_with_complaints=others,
                )
            )
        linked = sorted({cid for match in matches for cid in match.shared_with_complaints})
        return EntityDNA(
            dataset_version=self.version,
            method_version=METHOD,
            options=options,
            subject_id=subject_id,
            scope_account_ids=sorted(accounts),
            entity_matches=matches,
            total_entity_overlaps=len(matches),
            linked_complaint_ids=linked,
            unique_linked_complaints=len(linked),
        )

    def compute_behavioral_dna(
        self, complaint_id: str, options: TraceOptions | None = None
    ) -> BehavioralDNA:
        options = options or TraceOptions()
        context = self._context(options)
        self._require_case(complaint_id)
        scores = [
            ComponentMatch(
                complaint_id=cid,
                similarity=self._pair(context, complaint_id, cid).components.behavioral,
            )
            for cid in context.profiles
            if cid != complaint_id
        ]
        campaigns = []
        for campaign in context.campaigns:
            members = [cid for cid in campaign.complaint_ids if cid != complaint_id]
            if members:
                campaigns.append(
                    CampaignMatch(
                        campaign=campaign,
                        similarity=sum(
                            self._pair(context, complaint_id, cid).components.behavioral
                            for cid in members
                        )
                        / len(members),
                        compared_case_count=len(members),
                    )
                )
        return BehavioralDNA(
            fingerprint=context.profiles[complaint_id].behavior,
            similar_cases=sorted(
                (match for match in scores if match.similarity > 0),
                key=lambda m: (-m.similarity, m.complaint_id),
            )[:10],
            similar_campaigns=sorted(
                (match for match in campaigns if match.similarity > 0),
                key=lambda m: (-m.similarity, m.campaign.campaign_id),
            )[:5],
        ).model_copy(deep=True)

    def compute_network_dna(
        self, complaint_id: str, options: TraceOptions | None = None
    ) -> NetworkDNA:
        options = options or TraceOptions()
        context = self._context(options)
        self._require_case(complaint_id)
        scores = [
            ComponentMatch(
                complaint_id=cid,
                similarity=self._pair(context, complaint_id, cid).components.network,
            )
            for cid in context.profiles
            if cid != complaint_id
        ]
        features = context.profiles[complaint_id].network
        return NetworkDNA(
            topology_type=features.topology_type,
            topology_features=features,
            similar_topologies=sorted(
                (match for match in scores if match.similarity > 0),
                key=lambda m: (-m.similarity, m.complaint_id),
            )[:10],
        ).model_copy(deep=True)

    def _require_case(self, complaint_id: str):
        if complaint_id not in self.graph.complaints:
            raise KeyError(f"Unknown complaint: {complaint_id}")

    def campaigns(self, options: TraceOptions | None = None) -> CampaignList:
        options = options or TraceOptions()
        return CampaignList(
            dataset_version=self.version,
            method_version=METHOD,
            options=options,
            entity_threshold=ENTITY_THRESHOLD,
            signature_threshold=SIGNATURE_THRESHOLD,
            items=self._context(options).campaigns,
        ).model_copy(deep=True)

    def _link_graph(self, entity_dna: EntityDNA, context: Context) -> DNAGraph:
        edges = []
        used = set(self.graph.dataset.transactions_by_id) | set(self.graph.dataset.accounts_by_id)
        for match in entity_dna.entity_matches:
            for source in match.matched_account_ids:
                for target in match.shared_with_accounts:
                    cases = sorted(set(match.shared_with_complaints) & context.memberships[target])
                    if not cases:
                        continue
                    identity = f"{match.entity_id}|{source}|{target}"
                    eid = "DNA-LINK-" + sha256(identity.encode()).hexdigest()[:20]
                    while eid in used:
                        eid += ":"
                    used.add(eid)
                    edges.append(
                        EntityLink(
                            data=EntityLinkData(
                                id=eid,
                                source=source,
                                target=target,
                                entity_ids=[match.entity_id],
                                complaint_ids=cases,
                                label=f"Also in case {cases[0]}"
                                + (f" (+{len(cases) - 1})" if len(cases) > 1 else ""),
                            )
                        )
                    )
        return DNAGraph(
            dataset_version=self.version,
            edges=edges[:100],
            total_link_count=len(edges),
            truncated=len(edges) > 100,
        )

    def compute_fraud_dna(
        self, complaint_id: str, options: TraceOptions | None = None
    ) -> DNAReport:
        self._require_case(complaint_id)
        options = options or TraceOptions()
        context = self._context(options)
        family = {cid: campaign for campaign in context.campaigns for cid in campaign.complaint_ids}
        ranked = sorted(
            (cid for cid in context.profiles if cid != complaint_id),
            key=lambda cid: (-self._pair(context, complaint_id, cid).similarity, cid),
        )
        best = self._pair(context, complaint_id, ranked[0]) if ranked else None
        entity = self.compute_entity_dna(complaint_id, options)
        rows = []
        for cid in ranked:
            pair = self._pair(context, complaint_id, cid)
            if pair.similarity <= 0:
                continue
            case = self.graph.complaints[cid]
            rows.append(
                SimilarCase(
                    complaint_id=cid,
                    similarity=pair.similarity,
                    component_scores=pair.components,
                    behavioral_coverage=pair.coverage,
                    shared_entity_ids=pair.entity_ids,
                    amount_lost=case.amount_lost,
                    scam_type=case.scam_type,
                    campaign_id=family[cid].campaign_id if cid in family else None,
                )
            )
        return DNAReport(
            dataset_version=self.version,
            method_version=METHOD,
            complaint_id=complaint_id,
            options=options,
            signature_score=best.similarity if best else 0,
            best_match_complaint_id=ranked[0] if ranked and best.similarity > 0 else None,
            component_scores=best.components
            if best
            else ComponentScores(entity=0, behavioral=0, network=0),
            weights=WEIGHTS,
            component_formulas=FORMULAS,
            campaign=family.get(complaint_id),
            entity_dna=entity,
            behavioral_dna=self.compute_behavioral_dna(complaint_id, options),
            network_dna=self.compute_network_dna(complaint_id, options),
            similar_cases=rows[:10],
            compared_case_count=len(ranked),
            link_graph=self._link_graph(entity, context),
            limitations=[
                "Matching scores and campaign thresholds are heuristic, "
                "not proof of a common operator.",
                "Entity links describe shared identifiers; they are not money transfers.",
                "Withdrawal method is unknown. Dormancy uses only observed prior gaps "
                "with activation bursts.",
                "All case comparisons use the same trace options; "
                "filters may change inferred families.",
            ],
        ).model_copy(deep=True)
