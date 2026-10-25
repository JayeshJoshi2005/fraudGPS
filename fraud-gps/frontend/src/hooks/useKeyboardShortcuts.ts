import { useEffect } from 'react';
import { shortcutAction } from '../utils/shortcuts';

interface Handlers {
  toggle: () => void;
  previous: () => void;
  next: () => void;
  fit: () => void;
  replay: () => void;
  deselect: () => void;
}
export function useKeyboardShortcuts(
  handlers: Handlers,
  timelineReady: boolean,
  graphReady: boolean,
) {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target;
      const editing =
        target instanceof HTMLElement &&
        (!!target.closest(
          'input,select,textarea,button,[role="tab"],[role="slider"],[role="combobox"]',
        ) ||
          target.isContentEditable);
      const action = shortcutAction(event, editing);
      if (
        !action ||
        (['toggle', 'previous', 'next', 'replay'].includes(action) && !timelineReady) ||
        (action === 'fit' && !graphReady)
      )
        return;
      event.preventDefault();
      handlers[action]();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [handlers, timelineReady, graphReady]);
}
