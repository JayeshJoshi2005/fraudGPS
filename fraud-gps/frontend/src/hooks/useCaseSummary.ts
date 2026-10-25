import { useEffect, useState } from 'react';
import type { TraceResult } from '../types';
import type { CaseSummary } from '../types/reports';
import { errorMessage, fetchCaseSummary } from '../utils/api';
import { validateSummary } from '../utils/reports';

export function useCaseSummary(trace?: TraceResult) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    source?: TraceResult;
    loading: boolean;
    data?: CaseSummary;
    error?: string;
  }>({ loading: false });
  useEffect(() => {
    if (!trace?.complaint_id) return;
    const controller = new AbortController();
    setState({ source: trace, loading: true });
    fetchCaseSummary(trace.complaint_id, trace.options, controller.signal)
      .then((data) => {
        validateSummary(data, trace);
        if (!controller.signal.aborted) setState({ source: trace, loading: false, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ source: trace, loading: false, error: errorMessage(error) });
      });
    return () => controller.abort();
  }, [trace, attempt]);
  return {
    ...(state.source === trace ? state : { loading: !!trace }),
    retry: () => setAttempt((value) => value + 1),
  };
}
