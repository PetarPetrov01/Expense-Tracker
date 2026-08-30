import { describe, it, expect } from 'vitest';
import { preloadDateFor } from './dates';

const now = new Date(2026, 7, 30, 14, 30); // 30 Aug 2026, 14:30

describe('preloadDateFor', () => {
  it('returns the start of a past day when the day scope is stepped back', () => {
    const anchor = new Date(2026, 7, 27, 9, 15);
    expect(preloadDateFor('day', anchor, now)).toEqual(new Date(2026, 7, 27, 0, 0, 0, 0));
  });

  it('returns null when the day scope is on today', () => {
    expect(preloadDateFor('day', new Date(2026, 7, 30, 1, 0), now)).toBeNull();
  });

  it('returns null for every non-day scope, past or present', () => {
    const past = new Date(2026, 5, 10);
    for (const scope of ['week', 'month', 'year', 'custom'] as const) {
      expect(preloadDateFor(scope, past, now)).toBeNull();
      expect(preloadDateFor(scope, now, now)).toBeNull();
    }
  });
});
