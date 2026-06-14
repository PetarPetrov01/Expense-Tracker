import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { amountInBaseCents } from './fx';

// Minimal shape this module needs. `ExpenseWithCategory` from listExpenses satisfies it.
export type PaceInput = {
  occurredAt: Date | number; // Date (drizzle timestamp_ms) or ms epoch
  amountCents: number;
  rateToBaseX1e6: number;
};

export type CumulativePoint = { dayIndex: number; cumulativeBaseCents: number };

// Cumulative-by-day running total spanning [start, end] inclusive of both calendar days.
// dayIndex 0 = the start day. Empty days repeat the prior cumulative. Pure: amounts are
// summed in base cents via amountInBaseCents; currency conversion happens elsewhere.
export function buildCumulativeSeries(
  expenses: PaceInput[],
  start: Date,
  end: Date,
): CumulativePoint[] {
  const startDay = startOfDay(start);
  const dayCount = differenceInCalendarDays(startOfDay(end), startDay) + 1;
  if (dayCount <= 0) return [];

  const perDay = new Array<number>(dayCount).fill(0);
  for (const e of expenses) {
    const idx = differenceInCalendarDays(startOfDay(new Date(e.occurredAt)), startDay);
    if (idx < 0 || idx >= dayCount) continue; // defensively ignore out-of-range rows
    perDay[idx] += amountInBaseCents(e);
  }

  const out: CumulativePoint[] = [];
  let running = 0;
  for (let i = 0; i < dayCount; i++) {
    running += perDay[i];
    out.push({ dayIndex: i, cumulativeBaseCents: running });
  }
  return out;
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
  if (!isCurrent) return lastIndex;
  const idx = differenceInCalendarDays(startOfDay(now), startDay);
  return Math.min(Math.max(idx, 0), lastIndex);
}

// Read both cumulative series at the same elapsed index. When the previous period is
// shorter than todayIndex, clamp to its final total (e.g. comparing day 30 vs a 28-day Feb).
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
