import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear,
  eachDayOfInterval, eachMonthOfInterval, subDays, subMonths, subYears, format } from 'date-fns';

export type Period = 'day' | 'month' | 'year';

export function rangeFor(period: Period, anchor: Date = new Date()) {
  if (period === 'day') {
    return { start: startOfDay(subDays(anchor, 6)), end: endOfDay(anchor) };
  }
  if (period === 'month') {
    return { start: startOfMonth(subMonths(anchor, 11)), end: endOfMonth(anchor) };
  }
  return { start: startOfYear(subYears(anchor, 4)), end: endOfYear(anchor) };
}

export function bucketsFor(period: Period, anchor: Date = new Date()) {
  const { start, end } = rangeFor(period, anchor);
  if (period === 'day')   return eachDayOfInterval({ start, end }).map(d => ({ key: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE'), date: d }));
  if (period === 'month') return eachMonthOfInterval({ start, end }).map(d => ({ key: format(d, 'yyyy-MM'),    label: format(d, 'MMM'),  date: d }));
  const years: { key: string; label: string; date: Date }[] = [];
  for (let y = anchor.getFullYear() - 4; y <= anchor.getFullYear(); y++) {
    years.push({ key: String(y), label: String(y), date: new Date(y, 0, 1) });
  }
  return years;
}

export function bucketKeyFor(period: Period, d: Date): string {
  if (period === 'day')   return format(d, 'yyyy-MM-dd');
  if (period === 'month') return format(d, 'yyyy-MM');
  return format(d, 'yyyy');
}
