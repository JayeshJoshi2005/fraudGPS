import { useCallback, useEffect, useRef, useState } from 'react';
import type { GraphNode, PlaybackState, TimelineEvent, TraceResult } from '../types';
import type { CaseSummary, ToastMessage } from '../types/reports';
import { eventNotifications } from '../utils/notifications';

export function useNotifications(scope: unknown) {
  const [state, setState] = useState<{ scope: unknown; items: ToastMessage[] }>({
    scope,
    items: [],
  });
  const timers = useRef(new Map<string, number>());
  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setState((old) => ({ ...old, items: old.items.filter((item) => item.id !== id) }));
  }, []);
  const clearStory = useCallback(
    () =>
      setState((old) => {
        const items = old.items.filter((item) => item.kind !== 'story');
        if (items.length === old.items.length) return old;
        old.items
          .filter((item) => item.kind === 'story')
          .forEach((item) => {
            clearTimeout(timers.current.get(item.id));
            timers.current.delete(item.id);
          });
        return { ...old, items };
      }),
    [],
  );
  const push = useCallback(
    (item: ToastMessage) => {
      clearTimeout(timers.current.get(item.id));
      setState((old) => {
        const items = [
          item,
          ...(old.scope === scope ? old.items : []).filter((value) => value.id !== item.id),
        ].slice(0, 4);
        old.items
          .filter((value) => !items.some((next) => next.id === value.id))
          .forEach((value) => {
            clearTimeout(timers.current.get(value.id));
            timers.current.delete(value.id);
          });
        return { scope, items };
      });
      timers.current.set(
        item.id,
        window.setTimeout(() => dismiss(item.id), 4000),
      );
    },
    [scope, dismiss],
  );
  useEffect(() => {
    const active = timers.current;
    return () => {
      active.forEach(clearTimeout);
      active.clear();
    };
  }, [scope]);
  return { items: state.scope === scope ? state.items : [], push, dismiss, clearStory };
}

export function usePlaybackNotifications(
  trace: TraceResult | undefined,
  events: TimelineEvent[],
  playback: PlaybackState,
  nodes: GraphNode[],
  summary: CaseSummary | undefined,
  push: (item: ToastMessage) => void,
  clearStory: () => void,
) {
  const previous = useRef<{
    trace?: TraceResult;
    revision: number;
    step: number;
    seen: Set<string>;
  }>({ revision: 0, step: 0, seen: new Set() });
  useEffect(() => {
    const old = previous.current;
    if (old.trace !== trace || old.revision !== playback.revision) {
      const seen = new Set<string>();
      for (const event of events.slice(0, playback.step))
        eventNotifications(event, nodes, summary, seen);
      previous.current = { trace, revision: playback.revision, step: playback.step, seen };
      clearStory();
      return;
    }
    const last = old.step;
    old.step = playback.step;
    if (playback.mode !== 'story' || playback.step <= last) return;
    for (const event of events.slice(last, playback.step))
      eventNotifications(event, nodes, summary, old.seen).forEach(push);
  }, [trace, events, playback, nodes, summary, push, clearStory]);
}
