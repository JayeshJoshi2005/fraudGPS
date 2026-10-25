import { useState } from 'react';
import type { TraceResult } from '../types';
export function useReviewChecklist(trace?: TraceResult) {
  const [state, setState] = useState<{ source?: TraceResult; ids: Set<string> }>({
    ids: new Set(),
  });
  return {
    reviewed: state.source === trace ? state.ids : new Set<string>(),
    toggle: (id: string) =>
      setState((old) => {
        const ids = new Set(old.source === trace ? old.ids : []);
        if (ids.has(id)) ids.delete(id);
        else ids.add(id);
        return { source: trace, ids };
      }),
    reset: () => setState({ source: trace, ids: new Set() }),
  };
}
