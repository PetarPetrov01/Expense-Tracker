import { describe, it, expect } from 'vitest';
import { buildCumulativeSeries, comparePace, paceTodayIndex, paceAxisTicks,
  buildStepSeries, stepTodayIndex, stepAxisTicks, stepGranularity, pointLabels } from './pace';

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

describe('stepGranularity', () => {
  it('is month for year, day otherwise', () => {
    expect(stepGranularity('year')).toBe('month');
    expect(stepGranularity('month')).toBe('day');
    expect(stepGranularity('week')).toBe('day');
  });
});

describe('buildStepSeries (day)', () => {
  const start = new Date(2026, 0, 1);
  const end = new Date(2026, 0, 3, 23, 59, 59); // 3 days

  it('returns one non-cumulative entry per day, zeros when empty', () => {
    expect(buildStepSeries([], start, end, 'day')).toEqual([0, 0, 0]);
  });

  it('does NOT accumulate — each day holds only its own spend', () => {
    const series = buildStepSeries(
      [
        { occurredAt: new Date(2026, 0, 1, 10), amountCents: 100, rateToBaseX1e6: RATE },
        { occurredAt: new Date(2026, 0, 3, 8), amountCents: 50, rateToBaseX1e6: RATE },
      ],
      start, end, 'day',
    );
    expect(series).toEqual([100, 0, 50]);
  });

  it('sums multiple expenses on the same day and converts by rate', () => {
    const series = buildStepSeries(
      [
        { occurredAt: new Date(2026, 0, 2, 9), amountCents: 30, rateToBaseX1e6: RATE },
        { occurredAt: new Date(2026, 0, 2, 18), amountCents: 200, rateToBaseX1e6: 500_000 }, // → 100
      ],
      start, end, 'day',
    );
    expect(series).toEqual([0, 130, 0]);
  });

  it('ignores expenses outside the range', () => {
    const series = buildStepSeries(
      [{ occurredAt: new Date(2025, 11, 31, 12), amountCents: 999, rateToBaseX1e6: RATE }],
      start, end, 'day',
    );
    expect(series).toEqual([0, 0, 0]);
  });

  it('cumulative series is the running sum of the day steps', () => {
    const expenses = [
      { occurredAt: new Date(2026, 0, 1, 10), amountCents: 100, rateToBaseX1e6: RATE },
      { occurredAt: new Date(2026, 0, 3, 8), amountCents: 50, rateToBaseX1e6: RATE },
    ];
    const steps = buildStepSeries(expenses, start, end, 'day');
    const cum = buildCumulativeSeries(expenses, start, end).map(p => p.cumulativeBaseCents);
    let running = 0;
    expect(steps.map(s => (running += s))).toEqual(cum);
  });
});

describe('buildStepSeries (month)', () => {
  const start = new Date(2026, 0, 1);            // Jan 1
  const end = new Date(2026, 11, 31, 23, 59, 59); // Dec 31 → 12 months

  it('buckets expenses into their calendar month', () => {
    const series = buildStepSeries(
      [
        { occurredAt: new Date(2026, 0, 15), amountCents: 100, rateToBaseX1e6: RATE }, // Jan
        { occurredAt: new Date(2026, 0, 20), amountCents: 50, rateToBaseX1e6: RATE },  // Jan
        { occurredAt: new Date(2026, 2, 5), amountCents: 70, rateToBaseX1e6: RATE },   // Mar
      ],
      start, end, 'month',
    );
    expect(series).toHaveLength(12);
    expect(series[0]).toBe(150); // Jan
    expect(series[2]).toBe(70);  // Mar
    expect(series[1]).toBe(0);   // Feb
  });
});

describe('stepTodayIndex', () => {
  it('delegates to day index for month scope', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 31, 23, 59, 59);
    expect(stepTodayIndex('month', start, end, true, new Date(2026, 0, 15, 10))).toBe(14);
    expect(stepTodayIndex('month', start, end, false, new Date(2026, 5, 1))).toBe(30);
  });

  it('returns the current month index for an in-progress year', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 11, 31, 23, 59, 59);
    expect(stepTodayIndex('year', start, end, true, new Date(2026, 3, 10))).toBe(3); // April
  });

  it('returns the last month index (11) for a completed year', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 11, 31, 23, 59, 59);
    expect(stepTodayIndex('year', start, end, false, new Date(2027, 5, 1))).toBe(11);
  });
});

describe('stepAxisTicks', () => {
  it('reuses day ticks for month scope', () => {
    const ticks = stepAxisTicks('month', new Date(2026, 0, 1), 31);
    expect(ticks).toEqual(paceAxisTicks('month', new Date(2026, 0, 1), 31));
  });

  it('returns one month label per step for year scope', () => {
    const ticks = stepAxisTicks('year', new Date(2026, 0, 1), 12);
    expect(ticks).toHaveLength(12);
    expect(ticks[0]).toEqual({ index: 0, label: 'Jan' });
    expect(ticks[11]).toEqual({ index: 11, label: 'Dec' });
  });

  it('returns empty for non-positive stepCount', () => {
    expect(stepAxisTicks('year', new Date(2026, 0, 1), 0)).toEqual([]);
  });
});

describe('pointLabels', () => {
  it('labels each day as "d MMM" for day granularity', () => {
    const labels = pointLabels(new Date(2026, 2, 14), 3, 'day'); // Mar 14
    expect(labels).toEqual(['14 Mar', '15 Mar', '16 Mar']);
  });

  it('labels each month as "MMM" for month granularity', () => {
    const labels = pointLabels(new Date(2026, 0, 1), 3, 'month');
    expect(labels).toEqual(['Jan', 'Feb', 'Mar']);
  });

  it('returns empty for non-positive count', () => {
    expect(pointLabels(new Date(2026, 0, 1), 0, 'day')).toEqual([]);
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

describe('paceAxisTicks', () => {
  it('returns one single-letter weekday label per day for week scope', () => {
    const ticks = paceAxisTicks('week', new Date(2026, 0, 5), 7); // Mon Jan 5 2026
    expect(ticks).toHaveLength(7);
    expect(ticks[0].index).toBe(0);
    expect(ticks.every(t => t.label.length >= 1)).toBe(true);
  });

  it('returns ~5 day-number ticks spanning the month', () => {
    const ticks = paceAxisTicks('month', new Date(2026, 0, 1), 31);
    expect(ticks).toHaveLength(5);
    expect(ticks[0]).toEqual({ index: 0, label: '1' });
    expect(ticks[ticks.length - 1]).toEqual({ index: 30, label: '31' });
  });

  it('returns month abbreviations on the 1st of each month for year scope', () => {
    const ticks = paceAxisTicks('year', new Date(2026, 0, 1), 365);
    expect(ticks).toHaveLength(12);
    expect(ticks[0]).toEqual({ index: 0, label: 'Jan' });
    expect(ticks[1].label).toBe('Feb');
  });

  it('returns empty for non-positive dayCount', () => {
    expect(paceAxisTicks('month', new Date(2026, 0, 1), 0)).toEqual([]);
  });
});
