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
