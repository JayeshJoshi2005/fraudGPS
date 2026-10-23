import type { GraphData } from '../types';
import { sameDataset } from './dataset';

export function mergeGraphs(base: GraphData, extra: GraphData): GraphData {
  sameDataset(base.dataset_version, extra.dataset_version);
  // Existing trail data takes precedence over un-attributed neighborhood data.
  return {
    dataset_version: base.dataset_version,
    nodes: [...new Map([...extra.nodes, ...base.nodes].map((n) => [n.data.id, n])).values()],
    edges: [...new Map([...extra.edges, ...base.edges].map((e) => [e.data.id, e])).values()],
  };
}
export function filterGraph(graph: GraphData, suspicious: boolean, victim?: string): GraphData {
  if (!suspicious) return graph;
  const nodes = graph.nodes.filter((n) => n.data.risk_score >= 0.5 || n.data.id === victim);
  const ids = new Set(nodes.map((n) => n.data.id));
  return {
    ...graph,
    nodes,
    edges: graph.edges.filter((e) => ids.has(e.data.source) && ids.has(e.data.target)),
  };
}
export const emptyGraph = (): GraphData => ({ dataset_version: '', nodes: [], edges: [] });
