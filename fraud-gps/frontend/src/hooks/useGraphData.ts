import { useEffect, useState } from 'react';
import { errorMessage, fetchComplaints, fetchGraphData } from '../utils/api';
import type { Complaint, GraphData } from '../types';

export function useGraphData() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    loading: boolean;
    error?: string;
    data?: { complaints: Complaint[]; graph: GraphData };
  }>({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true });
    Promise.all([fetchComplaints(controller.signal), fetchGraphData(controller.signal)])
      .then(([complaints, graph]) => {
        if (!controller.signal.aborted) setState({ loading: false, data: { complaints, graph } });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ loading: false, error: errorMessage(error) });
      });
    return () => controller.abort();
  }, [attempt]);
  return { ...state, retry: () => setAttempt((value) => value + 1) };
}
