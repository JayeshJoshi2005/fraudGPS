import { describe, expect, it } from 'vitest';
import { sectionFromHash } from './useWorkspaceNavigation';

describe('workspace deep links', () => {
  it.each(['cases', 'trace', 'dna', 'summary'] as const)('resolves the %s section', (section) => {
    expect(sectionFromHash(`#/${section}`)).toBe(section);
  });
  it.each(['', '#', '#/unknown', '#/dna/other'])('recovers from %s with the case library', (hash) =>
    expect(sectionFromHash(hash)).toBe('cases'),
  );
});
