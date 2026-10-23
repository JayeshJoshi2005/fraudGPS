import { useEffect, useRef, useState } from 'react';
import type { TraceResult } from '../types';
import type { DNAReport } from '../types/dna';
import { errorMessage, fetchDNAReport } from '../utils/api';
import { validateDNA } from '../utils/dna';

export function useDNA(trace?: TraceResult) {
  const [state, setState] = useState<{
    source?: TraceResult;
    loading: boolean;
    data?: DNAReport;
    error?: string;
  }>({ loading: false });
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    pending.current?.abort();
    setState({ source: trace, loading: false });
    return () => pending.current?.abort();
  }, [trace]);
  async function run() {
    if (!trace?.complaint_id || !trace.steps.length) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setState({ source: trace, loading: true });
    try {
      const data = await fetchDNAReport(trace.complaint_id, trace.options, controller.signal);
      validateDNA(data, trace);
      if (!controller.signal.aborted) setState({ source: trace, loading: false, data });
    } catch (error) {
      if (!controller.signal.aborted)
        setState({ source: trace, loading: false, error: errorMessage(error) });
    }
  }
  return { ...(state.source === trace ? state : { loading: false }), run };
}
