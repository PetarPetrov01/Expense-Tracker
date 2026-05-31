import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear,
  startOfWeek, endOfWeek, eachDayOfInterval, eachMonthOfInterval,
  subDays, addDays, subMonths, addMonths, subWeeks, addWeeks, subYears, addYears,
  isSameDay, isSameWeek, isSameMonth, isSameYear, format } from 'date-fns';

export type Period = 'day' | 'month' | 'year';
export type Scope = 'day' | 'week' | 'month' | 'year' | 'custom';
export type WeekStart = 'mon' | 'sun';

export const weekStartsOn = (w: WeekStart): 0 | 1 => (w === 'mon' ? 1 : 0);

// For 'custom', consumers must use `customRange` directly rather than this
// function — the anchor alone cannot express an arbitrary range. We return a
// degenerate single-day range as a safe fallback if called.
export function scopeRange(scope: Scope, anchor: Date, weekStart: WeekStart): { start: Date; end: Date } {
  if (scope === 'day' || scope === 'custom') return { start: startOfDay(anchor), end: endOfDay(anchor) };
  if (scope === 'month') return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  if (scope === 'year') return { start: startOfYear(anchor), end: endOfYear(anchor) };
  const opt = { weekStartsOn: weekStartsOn(weekStart) } as const;
  return { start: startOfWeek(anchor, opt), end: endOfWeek(anchor, opt) };
}

export function stepAnchor(scope: Scope, anchor: Date, direction: -1 | 1): Date {
  if (scope === 'custom') return anchor;
  if (scope === 'day') return direction < 0 ? subDays(anchor, 1) : addDays(anchor, 1);
  if (scope === 'week') return direction < 0 ? subWeeks(anchor, 1) : addWeeks(anchor, 1);
  if (scope === 'year') return direction < 0 ? subYears(anchor, 1) : addYears(anchor, 1);
  return direction < 0 ? subMonths(anchor, 1) : addMonths(anchor, 1);
}

// Step the anchor by any integer offset (positive = forward, negative = backward).
export function stepAnchorBy(scope: Scope, anchor: Date, offset: number): Date {
  if (offset === 0 || scope === 'custom') return anchor;
  const dir: -1 | 1 = offset > 0 ? 1 : -1;
  let cur = anchor;
  for (let i = 0; i < Math.abs(offset); i++) cur = stepAnchor(scope, cur, dir);
  return cur;
}

export function isAtCurrent(scope: Scope, anchor: Date, weekStart: WeekStart, now: Date = new Date()): boolean {
  if (scope === 'custom') return true;
  if (scope === 'day') return isSameDay(anchor, now);
  if (scope === 'month') return isSameMonth(anchor, now);
  if (scope === 'year') return isSameYear(anchor, now);
  return isSameWeek(anchor, now, { weekStartsOn: weekStartsOn(weekStart) });
}

export function canGoForward(scope: Scope, anchor: Date, weekStart: WeekStart, now: Date = new Date()): boolean {
  if (scope === 'custom') return false;
  return !isAtCurrent(scope, anchor, weekStart, now);
}

export function formatScope(scope: Scope, anchor: Date, weekStart: WeekStart): string {
  const currentYear = new Date().getFullYear();
  if (scope === 'day') return format(anchor, anchor.getFullYear() === currentYear ? 'EEE, d MMM' : 'EEE, d MMM yyyy');
  if (scope === 'month') return format(anchor, anchor.getFullYear() === currentYear ? 'MMMM' : 'MMMM yyyy');
  if (scope === 'year') return format(anchor, 'yyyy');
  if (scope === 'custom') return 'Custom range';
  const { start, end } = scopeRange('week', anchor, weekStart);
  const sameMonth = isSameMonth(start, end);
  const showYear = start.getFullYear() !== currentYear;
  const endFmt = showYear ? 'd MMM yyyy' : 'd MMM';
  if (sameMonth) return `${format(start, 'd')}–${format(end, endFmt)}`;
  return `${format(start, 'd MMM')} – ${format(end, endFmt)}`;
}

export function formatCustomRange(start: Date, end: Date): string {
  const currentYear = new Date().getFullYear();
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = isSameMonth(start, end);
  const showYear = start.getFullYear() !== currentYear || end.getFullYear() !== currentYear;
  if (sameMonth) {
    return `${format(start, 'd')}–${format(end, showYear ? 'd MMM yyyy' : 'd MMM')}`;
  }
  if (sameYear) {
    return `${format(start, 'd MMM')} – ${format(end, showYear ? 'd MMM yyyy' : 'd MMM')}`;
  }
  return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`;
}

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

export type Bucket = { key: string; label: string; start: Date; end: Date };

export function lastNBuckets(scope: Scope, n: number, anchor: Date, weekStart: WeekStart): Bucket[] {
  const anchors: Date[] = [anchor];
  for (let i = 1; i < n; i++) anchors.push(stepAnchor(scope, anchors[i - 1], -1));
  const out: Bucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const { start, end } = scopeRange(scope, anchors[i], weekStart);
    out.push({
      key: formatBucketKey(scope, start),
      label: formatBucketLabel(scope, start),
      start,
      end,
    });
  }
  return out;
}

function formatBucketKey(scope: Scope, d: Date): string {
  if (scope === 'day')   return format(d, 'yyyy-MM-dd');
  if (scope === 'week')  return `W-${format(d, 'yyyy-MM-dd')}`;
  if (scope === 'month') return format(d, 'yyyy-MM');
  return format(d, 'yyyy');
}

function formatBucketLabel(scope: Scope, d: Date): string {
  if (scope === 'day')   return format(d, 'd MMM');
  if (scope === 'week')  return format(d, "'w'I");
  if (scope === 'month') return format(d, 'MMM');
  return format(d, 'yyyy');
}
