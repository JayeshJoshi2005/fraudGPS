import { useCallback, useEffect, useRef, useState } from 'react';
import {
  errorMessage,
  fetchGraphData,
  fetchNeighborhood,
  sameDataset,
  traceComplaint,
} from '../utils/api';
import { mergeGraphs } from '../utils/graph';
import type { GraphData, TraceOptions, TraceResult } from '../types';

interface State {
  loading: boolean;
  expanding: boolean;
  error?: string;
  expansionError?: string;
  expansionTarget?: string;
  trace?: TraceResult;
  graph?: GraphData;
  base?: GraphData;
}
export function useTrace() {
  const [state, setState] = useState<State>({ loading: false, expanding: false });
  const pending = useRef<AbortController | null>(null);
  const expansion = useRef<AbortController | null>(null);
  const reset = useCallback(() => {
    pending.current?.abort();
    expansion.current?.abort();
    setState({ loading: false, expanding: false });
  }, []);
  useEffect(
    () => () => {
      pending.current?.abort();
      expansion.current?.abort();
    },
    [],
  );
  async function run(id: string, options: TraceOptions, version: string) {
    pending.current?.abort();
    expansion.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setState({ loading: true, expanding: false });
    try {
      const [trace, graph] = await Promise.all([
        traceComplaint(id, options, controller.signal),
        fetchGraphData(controller.signal, id, options),
      ]);
      sameDataset(version, trace.dataset_version, graph.dataset_version);
      if (!controller.signal.aborted)
        setState({ loading: false, expanding: false, trace, graph, base: graph });
    } catch (error) {
      if (!controller.signal.aborted)
        setState({ loading: false, expanding: false, error: errorMessage(error) });
    }
  }
  async function expand(id: string, version: string) {
    expansion.current?.abort();
    const controller = new AbortController();
    expansion.current = controller;
    setState((old) => ({
      ...old,
      expanding: true,
      error: undefined,
      expansionError: undefined,
      expansionTarget: id,
    }));
    try {
      const extra = await fetchNeighborhood(id, controller.signal);
      sameDataset(version, extra.dataset_version);
      if (!controller.signal.aborted)
        setState((old) => ({
          ...old,
          expanding: false,
          graph: old.graph ? mergeGraphs(old.graph, extra) : extra,
        }));
    } catch (error) {
      if (!controller.signal.aborted)
        setState((old) => ({ ...old, expanding: false, expansionError: errorMessage(error) }));
    }
  }
  function clearExpansion() {
    expansion.current?.abort();
    setState((old) => ({ ...old, graph: old.base, expanding: false, expansionError: undefined }));
  }
  return { ...state, reset, run, expand, clearExpansion };
}
