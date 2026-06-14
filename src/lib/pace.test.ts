import { describe, it, expect } from 'vitest';
import { buildCumulativeSeries } from './pace';

const RATE = 1_000_000; // 1:1 → base cents == amountCents

describe('buildCumulativeSeries', () => {
  const start = new Date(2026, 0, 1); // Jan 1 2026 00:00 local
  const end = new Date(2026, 0, 3, 23, 59, 59); // Jan 3 2026 end-of-day → 3 days

  it('returns one entry per day with zeros when there are no expenses', () => {
    const series = buildCumulativeSeries([], start, end);
    expect(series).toEqual([
      { dayIndex: 0, cumulativeBaseCents: 0 },
      { dayIndex: 1, cumulativeBaseCents: 0 },
      { dayIndex: 2, cumulativeBaseCents: 0 },
    ]);
  });

  it('accumulates a running total and carries empty days forward', () => {
    const series = buildCumulativeSeries(
      [
        { occurredAt: new Date(2026, 0, 1, 10), amountCents: 100, rateToBaseX1e6: RATE },
        { occurredAt: new Date(2026, 0, 3, 8), amountCents: 50, rateToBaseX1e6: RATE },
      ],
      start,
      end,
    );
    expect(series.map(p => p.cumulativeBaseCents)).toEqual([100, 100, 150]);
  });

  it('sums multiple expenses on the same day', () => {
    const series = buildCumulativeSeries(
      [
        { occurredAt: new Date(2026, 0, 2, 9), amountCents: 30, rateToBaseX1e6: RATE },
        { occurredAt: new Date(2026, 0, 2, 18), amountCents: 70, rateToBaseX1e6: RATE },
      ],
      start,
      end,
    );
    expect(series.map(p => p.cumulativeBaseCents)).toEqual([0, 100, 100]);
  });

  it('converts to base cents using each row rate', () => {
    // rate 500000 = 0.5 → 200 amountCents becomes 100 base cents
    const series = buildCumulativeSeries(
      [{ occurredAt: new Date(2026, 0, 1, 12), amountCents: 200, rateToBaseX1e6: 500_000 }],
      start,
      end,
    );
    expect(series[0].cumulativeBaseCents).toBe(100);
  });

  it('ignores expenses outside the range', () => {
    const series = buildCumulativeSeries(
      [{ occurredAt: new Date(2025, 11, 31, 12), amountCents: 999, rateToBaseX1e6: RATE }],
      start,
      end,
    );
    expect(series.map(p => p.cumulativeBaseCents)).toEqual([0, 0, 0]);
  });
});
