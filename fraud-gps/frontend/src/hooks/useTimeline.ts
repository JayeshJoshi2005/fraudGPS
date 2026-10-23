import { useEffect, useState } from 'react';
import { errorMessage, fetchTimeline, sameDataset } from '../utils/api';
import { validateTimeline } from '../utils/playback';
import type { TimelineEvent, TraceResult } from '../types';

export const noEvents: TimelineEvent[] = [];
export function useTimeline(trace?: TraceResult) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    source?: TraceResult;
    events: TimelineEvent[];
    loading: boolean;
    error?: string;
  }>({ events: noEvents, loading: false });
  useEffect(() => {
    const controller = new AbortController();
    setState({ source: trace, events: noEvents, loading: !!trace?.complaint_id });
    if (trace?.complaint_id) {
      void fetchTimeline(trace.complaint_id, trace.options, controller.signal)
        .then((data) => {
          sameDataset(trace.dataset_version, data.dataset_version);
          validateTimeline(data.events, trace);
          if (!controller.signal.aborted)
            setState({ source: trace, events: data.events, loading: false });
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setState({
              source: trace,
              events: noEvents,
              loading: false,
              error: errorMessage(error),
            });
        });
    }
    return () => controller.abort();
  }, [trace, attempt]);
  const current =
    state.source === trace ? state : { events: noEvents, loading: !!trace?.complaint_id };
  return { ...current, retry: () => setAttempt((n) => n + 1) };
}
