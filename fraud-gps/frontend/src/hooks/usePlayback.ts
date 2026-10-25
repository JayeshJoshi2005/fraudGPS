import { useCallback, useEffect, useState } from 'react';
import type { TimelineEvent, PlaybackState } from '../types';
import {
  eventDelay,
  initialPlayback,
  reducePlayback,
  type PlaybackAction,
} from '../utils/playback';

export function usePlayback(events: TimelineEvent[]) {
  const [session, setSession] = useState({ source: events, state: initialPlayback });
  const state: PlaybackState = session.source === events ? session.state : initialPlayback;
  const dispatch = useCallback(
    (action: PlaybackAction) => {
      setSession((old) => ({
        source: events,
        state: reducePlayback(
          old.source === events ? old.state : initialPlayback,
          action,
          events.length,
        ),
      }));
    },
    [events],
  );
  useEffect(() => {
    if (!state.playing || !events.length) return;
    const timer = window.setTimeout(
      () => {
        setSession((old) =>
          old.source === events
            ? { ...old, state: reducePlayback(old.state, { type: 'tick' }, events.length) }
            : old,
        );
      },
      eventDelay(events[state.step - 1], state.speed),
    );
    return () => clearTimeout(timer);
  }, [events, state]);
  useEffect(() => {
    const pause = () => {
      if (document.hidden)
        setSession((old) => ({ ...old, state: { ...old.state, playing: false } }));
    };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  return { ...state, dispatch };
}
