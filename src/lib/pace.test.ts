import { describe, it, expect } from 'vitest';
import { buildCumulativeSeries, comparePace, paceTodayIndex } from './pace';

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

describe('paceTodayIndex', () => {
  const start = new Date(2026, 0, 1);
  const end = new Date(2026, 0, 31, 23, 59, 59); // 31-day month → last index 30

  it('returns the last index for a completed (not current) period', () => {
    expect(paceTodayIndex(start, end, false, new Date(2026, 5, 1))).toBe(30);
  });

  it('returns the elapsed index for an in-progress period', () => {
    expect(paceTodayIndex(start, end, true, new Date(2026, 0, 15, 10))).toBe(14);
  });

  it('clamps to 0 when now is before the period start', () => {
    expect(paceTodayIndex(start, end, true, new Date(2025, 11, 20))).toBe(0);
  });

  it('clamps to the last index when now is past the period end', () => {
    expect(paceTodayIndex(start, end, true, new Date(2026, 1, 10))).toBe(30);
  });
});

describe('comparePace', () => {
  const current = [
    { dayIndex: 0, cumulativeBaseCents: 10 },
    { dayIndex: 1, cumulativeBaseCents: 20 },
    { dayIndex: 2, cumulativeBaseCents: 30 },
  ];

  it('compares both series at the same elapsed index', () => {
    const prev = [
      { dayIndex: 0, cumulativeBaseCents: 5 },
      { dayIndex: 1, cumulativeBaseCents: 15 },
      { dayIndex: 2, cumulativeBaseCents: 40 },
      { dayIndex: 3, cumulativeBaseCents: 60 },
    ];
    expect(comparePace(current, prev, 1)).toEqual({
      currentAtPoint: 20,
      prevAtPoint: 15,
      deltaCents: 5,
    });
  });

  it('clamps to the previous final total when the previous period is shorter', () => {
    const prev = [
      { dayIndex: 0, cumulativeBaseCents: 5 },
      { dayIndex: 1, cumulativeBaseCents: 15 },
    ];
    expect(comparePace(current, prev, 2)).toEqual({
      currentAtPoint: 30,
      prevAtPoint: 15, // clamped to last available
      deltaCents: 15,
    });
  });

  it('returns nulls when there is no previous data', () => {
    expect(comparePace(current, [], 2)).toEqual({
      currentAtPoint: 30,
      prevAtPoint: null,
      deltaCents: null,
    });
  });

  it('handles the first-day boundary (todayIndex 0)', () => {
    const prev = [
      { dayIndex: 0, cumulativeBaseCents: 5 },
      { dayIndex: 1, cumulativeBaseCents: 15 },
    ];
    expect(comparePace(current, prev, 0)).toEqual({
      currentAtPoint: 10,
      prevAtPoint: 5,
      deltaCents: 5,
    });
  });
});
