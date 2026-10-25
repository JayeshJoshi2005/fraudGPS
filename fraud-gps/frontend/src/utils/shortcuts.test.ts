import { describe, expect, it } from 'vitest';
import { shortcutAction } from './shortcuts';
const event = {
  key: ' ',
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  shiftKey: false,
  repeat: false,
  defaultPrevented: false,
};
describe('keyboard shortcut eligibility', () => {
  it.each([
    [' ', 'toggle'],
    ['ArrowLeft', 'previous'],
    ['ArrowRight', 'next'],
    ['f', 'fit'],
    ['r', 'replay'],
    ['Escape', 'deselect'],
  ])('maps %s to %s', (key, action) =>
    expect(shortcutAction({ ...event, key }, false)).toBe(action),
  );
  it.each(['ctrlKey', 'altKey', 'metaKey', 'shiftKey', 'repeat', 'defaultPrevented'] as const)(
    'respects %s',
    (key) => expect(shortcutAction({ ...event, [key]: true }, false)).toBeUndefined(),
  );
  it('leaves typing and native control navigation alone', () => {
    for (const key of [' ', 'ArrowLeft', 'ArrowRight', 'f', 'r', 'Escape'])
      expect(shortcutAction({ ...event, key }, true)).toBeUndefined();
    expect(shortcutAction({ ...event, key: 'x' }, false)).toBeUndefined();
  });
});
