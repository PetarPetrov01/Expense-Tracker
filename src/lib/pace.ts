import { differenceInCalendarDays, differenceInCalendarMonths, startOfDay, startOfMonth, addDays, addMonths, format } from 'date-fns';
import type { Scope } from './dates';
import { amountInBaseCents } from './fx';

// Minimal shape this module needs. `ExpenseWithCategory` from listExpenses satisfies it.
export type PaceInput = {
  occurredAt: Date | number; // Date (drizzle timestamp_ms) or ms epoch
  amountCents: number;
  rateToBaseX1e6: number;
};

export type CumulativePoint = { dayIndex: number; cumulativeBaseCents: number };

// How wide one "step" is in per-step (non-cumulative) mode. Day-granular for week/month;
// month-granular for year so the line stays readable (12 points, not 365).
export type StepGranularity = 'day' | 'month';
export function stepGranularity(scope: Scope): StepGranularity {
  return scope === 'year' ? 'month' : 'day';
}

// Non-cumulative spend per step spanning [start, end] inclusive. For 'day' granularity each
// entry is one calendar day; for 'month' each entry is one calendar month. Empty steps are 0.
// Pure: amounts summed in base cents via amountInBaseCents; currency conversion happens elsewhere.
export function buildStepSeries(
  expenses: PaceInput[],
  start: Date,
  end: Date,
  granularity: StepGranularity,
): number[] {
  const byMonth = granularity === 'month';
  const anchor = byMonth ? startOfMonth(start) : startOfDay(start);
  const stepOf = (d: Date) =>
    byMonth
      ? differenceInCalendarMonths(startOfMonth(d), anchor)
      : differenceInCalendarDays(startOfDay(d), anchor);

  const stepCount = stepOf(end) + 1;
  if (stepCount <= 0) return [];

  const perStep = new Array<number>(stepCount).fill(0);
  for (const e of expenses) {
    const idx = stepOf(new Date(e.occurredAt));
    if (idx < 0 || idx >= stepCount) continue; // defensively ignore out-of-range rows
    perStep[idx] += amountInBaseCents(e);
  }
  return perStep;
}

// Cumulative-by-day running total spanning [start, end] inclusive of both calendar days.
// dayIndex 0 = the start day. Empty days repeat the prior cumulative. Built as a running sum
// over buildStepSeries('day') so daily bucketing has a single source of truth.
export function buildCumulativeSeries(
  expenses: PaceInput[],
  start: Date,
  end: Date,
): CumulativePoint[] {
  const perDay = buildStepSeries(expenses, start, end, 'day');
  const out: CumulativePoint[] = [];
  let running = 0;
  for (let i = 0; i < perDay.length; i++) {
    running += perDay[i];
    out.push({ dayIndex: i, cumulativeBaseCents: running });
  }
  return out;
}

// Index of the in-progress step for per-step mode (mirrors paceTodayIndex but honours the
// scope's granularity). Completed periods return the last step; the current period clamps
// "now" into [0, lastIndex] so the current line stops at today/this month.
export function stepTodayIndex(scope: Scope, start: Date, end: Date, isCurrent: boolean, now: Date): number {
  if (stepGranularity(scope) === 'day') return paceTodayIndex(start, end, isCurrent, now);
  const anchor = startOfMonth(start);
  const lastIndex = differenceInCalendarMonths(startOfMonth(end), anchor);
  if (!isCurrent) return lastIndex;
  const idx = differenceInCalendarMonths(startOfMonth(now), anchor);
  return Math.min(Math.max(idx, 0), lastIndex);
}

export type PaceComparison = {
  currentAtPoint: number;      // base cents at the comparison index
  prevAtPoint: number | null;  // null when no previous data
  deltaCents: number | null;   // current - prev, null when no previous data
};

// Index within the period at which the current line ends and the comparison is taken.
// Completed/past periods compare full length; the in-progress period compares to "now",
// clamped into [0, lastIndex].
export function paceTodayIndex(start: Date, end: Date, isCurrent: boolean, now: Date): number {
  const startDay = startOfDay(start);
  const lastIndex = differenceInCalendarDays(startOfDay(end), startDay);
  // `now` is only consulted for the in-progress period; a completed period returns full length.
  if (!isCurrent) return lastIndex;
  const idx = differenceInCalendarDays(startOfDay(now), startDay);
  return Math.min(Math.max(idx, 0), lastIndex);
}

// Read both cumulative series at the same elapsed index. When the previous period is
// shorter than todayIndex, clamp to its final total (e.g. comparing day 30 vs a 28-day Feb).
// The empty-`current` fallback (currentAtPoint = 0) is only defensive: callers feed series from
// buildCumulativeSeries, which always yields >=1 point for a valid range. A period with no spend
// is an all-zeros series, not an empty one, so in practice current is never empty.
export function comparePace(
  current: CumulativePoint[],
  previous: CumulativePoint[],
  todayIndex: number,
): PaceComparison {
  const curIdx = current.length ? Math.min(Math.max(todayIndex, 0), current.length - 1) : 0;
  const currentAtPoint = current.length ? current[curIdx].cumulativeBaseCents : 0;

  if (previous.length === 0) {
    return { currentAtPoint, prevAtPoint: null, deltaCents: null };
  }
  const prevIdx = Math.min(Math.max(todayIndex, 0), previous.length - 1);
  const prevAtPoint = previous[prevIdx].cumulativeBaseCents;
  return { currentAtPoint, prevAtPoint, deltaCents: currentAtPoint - prevAtPoint };
}

export type AxisTick = { index: number; label: string };

// Scope-adaptive x-axis ticks for the pace chart. `start` is the period's first day and
// `dayCount` the number of days in the period. Kept small so labels never crowd:
// single-letter weekdays for a week, ~5 day-number ticks for a month, month abbreviations
// for a year. Pure — formatting only, no accumulation.
export function paceAxisTicks(scope: Scope, start: Date, dayCount: number): AxisTick[] {
  if (dayCount <= 0) return [];
  if (scope === 'week') {
    return Array.from({ length: dayCount }, (_, i) => ({
      index: i,
      label: format(addDays(start, i), 'EEEEE'), // single-letter weekday
    }));
  }
  if (scope === 'year') {
    const ticks: AxisTick[] = [];
    for (let i = 0; i < dayCount; i++) {
      const d = addDays(start, i);
      if (d.getDate() === 1) ticks.push({ index: i, label: format(d, 'MMM') });
    }
    return ticks;
  }
  // month (and any other day-granular scope): ~5 evenly spaced day-number ticks
  const count = Math.min(5, dayCount);
  const ticks: AxisTick[] = [];
  for (let t = 0; t < count; t++) {
    const i = count <= 1 ? 0 : Math.round((t / (count - 1)) * (dayCount - 1));
    ticks.push({ index: i, label: format(addDays(start, i), 'd') });
  }
  return ticks;
}

// One human label per series index, for the scrubber tooltip. Day granularity → "d MMM"
// (e.g. "14 Mar"); month granularity → "MMM" (e.g. "Mar"). `count` is the series length.
export function pointLabels(start: Date, count: number, granularity: StepGranularity): string[] {
  if (count <= 0) return [];
  const byMonth = granularity === 'month';
  const anchor = byMonth ? startOfMonth(start) : startOfDay(start);
  return Array.from({ length: count }, (_, i) =>
    byMonth ? format(addMonths(anchor, i), 'MMM') : format(addDays(anchor, i), 'd MMM'),
  );
}

// X-axis ticks for per-step mode. Day-granular scopes reuse paceAxisTicks (one tick per day
// domain). Year steps by month, so it gets one month-abbreviation label per step.
export function stepAxisTicks(scope: Scope, start: Date, stepCount: number): AxisTick[] {
  if (stepCount <= 0) return [];
  if (stepGranularity(scope) === 'month') {
    return Array.from({ length: stepCount }, (_, i) => ({
      index: i,
      label: format(addMonths(startOfMonth(start), i), 'MMM'),
    }));
  }
  return paceAxisTicks(scope, start, stepCount);
}
