export const keyboardShortcuts = [
  ['Space', 'Play / pause'],
  ['← / →', 'Previous / next event'],
  ['F', 'Fit graph'],
  ['R', 'Replay trail'],
  ['Esc', 'Deselect account'],
] as const;
export function shortcutAction(
  event: Pick<
    KeyboardEvent,
    'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey' | 'repeat' | 'defaultPrevented'
  >,
  editing: boolean,
) {
  if (
    editing ||
    event.defaultPrevented ||
    event.repeat ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    event.shiftKey
  )
    return;
  const actions: Record<
    string,
    'toggle' | 'previous' | 'next' | 'fit' | 'replay' | 'deselect' | undefined
  > = {
    ' ': 'toggle',
    ArrowLeft: 'previous',
    ArrowRight: 'next',
    f: 'fit',
    r: 'replay',
    Escape: 'deselect',
  };
  return actions[event.key];
}
