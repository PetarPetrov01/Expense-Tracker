import { describe, it, expect } from 'vitest';
import { filterAndSortExpenses } from './expense-filter';
import type { ExpenseWithCategory } from '../repositories/expenses';

// Factory: full ExpenseWithCategory with sensible defaults, overridable per test.
function mk(over: Partial<ExpenseWithCategory>): ExpenseWithCategory {
  return {
    id: 1,
    amountCents: 100,
    currency: 'EUR',
    rateToBaseX1e6: 1_000_000, // 1:1 → base cents === amountCents
    categoryId: 1,
    tagId: null,
    note: null,
    occurredAt: new Date(2026, 0, 1),
    createdAt: new Date(2026, 0, 1),
    categoryName: 'Food',
    categoryIcon: 'food',
    categoryColor: '#10b981',
    tagName: null,
    ...over,
  };
}

describe('filterAndSortExpenses', () => {
  it('returns all items in date-desc order by default', () => {
    const a = mk({ id: 1, occurredAt: new Date(2026, 0, 1) });
    const b = mk({ id: 2, occurredAt: new Date(2026, 0, 3) });
    const result = filterAndSortExpenses([a, b], {});
    expect(result.map(e => e.id)).toEqual([2, 1]);
  });

  it('filters by categoryId', () => {
    const a = mk({ id: 1, categoryId: 1 });
    const b = mk({ id: 2, categoryId: 2 });
    const result = filterAndSortExpenses([a, b], { categoryId: 2 });
    expect(result.map(e => e.id)).toEqual([2]);
  });

  it('filters by tagId', () => {
    const a = mk({ id: 1, tagId: null });
    const b = mk({ id: 2, tagId: 7 });
    const result = filterAndSortExpenses([a, b], { tagId: 7 });
    expect(result.map(e => e.id)).toEqual([2]);
  });

  it('search matches the note case-insensitively', () => {
    const a = mk({ id: 1, note: 'Weekly Groceries' });
    const b = mk({ id: 2, note: 'Taxi' });
    const result = filterAndSortExpenses([a, b], { search: 'grocer' });
    expect(result.map(e => e.id)).toEqual([1]);
  });

  it('search matches the category name', () => {
    const a = mk({ id: 1, categoryName: 'Food' });
    const b = mk({ id: 2, categoryName: 'Transport' });
    const result = filterAndSortExpenses([a, b], { search: 'trans' });
    expect(result.map(e => e.id)).toEqual([2]);
  });

  it('empty/whitespace search is a no-op', () => {
    const a = mk({ id: 1 });
    const b = mk({ id: 2 });
    expect(filterAndSortExpenses([a, b], { search: '   ' })).toHaveLength(2);
  });

  it('a null note never matches a non-empty query', () => {
    const a = mk({ id: 1, note: null, categoryName: 'Food' });
    const result = filterAndSortExpenses([a], { search: 'xyz' });
    expect(result).toHaveLength(0);
  });

  it('sorts by amount using base cents across mixed currencies', () => {
    // b is 100 units at rate 2.0 → 200 base cents; a is 150 units at 1:1 → 150 base cents.
    const a = mk({ id: 1, amountCents: 150, rateToBaseX1e6: 1_000_000 });
    const b = mk({ id: 2, amountCents: 100, rateToBaseX1e6: 2_000_000 });
    expect(filterAndSortExpenses([a, b], { sort: 'amount-desc' }).map(e => e.id)).toEqual([2, 1]);
    expect(filterAndSortExpenses([a, b], { sort: 'amount-asc' }).map(e => e.id)).toEqual([1, 2]);
  });

  it('sorts by date ascending', () => {
    const a = mk({ id: 1, occurredAt: new Date(2026, 0, 1) });
    const b = mk({ id: 2, occurredAt: new Date(2026, 0, 3) });
    expect(filterAndSortExpenses([a, b], { sort: 'date-asc' }).map(e => e.id)).toEqual([1, 2]);
  });

  it('applies category + search + sort together', () => {
    const a = mk({ id: 1, categoryId: 1, note: 'lunch', amountCents: 500 });
    const b = mk({ id: 2, categoryId: 1, note: 'dinner', amountCents: 900 });
    const c = mk({ id: 3, categoryId: 2, note: 'lunch', amountCents: 300 });
    const result = filterAndSortExpenses([a, b, c], { categoryId: 1, search: 'lunch', sort: 'amount-desc' });
    expect(result.map(e => e.id)).toEqual([1]);
  });

  it('returns empty when filters exclude everything', () => {
    const a = mk({ id: 1, categoryId: 1 });
    expect(filterAndSortExpenses([a], { categoryId: 999 })).toHaveLength(0);
  });

  it('does not mutate the input array', () => {
    const a = mk({ id: 1, occurredAt: new Date(2026, 0, 1) });
    const b = mk({ id: 2, occurredAt: new Date(2026, 0, 3) });
    const input = [a, b];
    filterAndSortExpenses(input, { sort: 'date-asc' });
    expect(input.map(e => e.id)).toEqual([1, 2]);
  });
});
