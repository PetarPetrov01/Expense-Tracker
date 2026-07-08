import { amountInBaseCents } from './fx';
import type { ExpenseWithCategory } from '../repositories/expenses';

export type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export type ExpenseFilter = {
  categoryId?: number | null;
  tagId?: number | null;
  search?: string;
  sort?: SortKey;
};

// Pure, currency-agnostic. Filters then sorts a copy; never mutates the input.
export function filterAndSortExpenses(
  items: ExpenseWithCategory[],
  filter: ExpenseFilter,
): ExpenseWithCategory[] {
  const { categoryId, tagId, search, sort = 'date-desc' } = filter;
  const q = search?.trim().toLowerCase() ?? '';

  const filtered = items.filter((e) => {
    if (categoryId != null && e.categoryId !== categoryId) return false;
    if (tagId != null && e.tagId !== tagId) return false;
    if (q) {
      const inNote = e.note ? e.note.toLowerCase().includes(q) : false;
      const inCategory = e.categoryName.toLowerCase().includes(q);
      if (!inNote && !inCategory) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  switch (sort) {
    case 'date-asc':
      sorted.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
      break;
    case 'date-desc':
      sorted.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
      break;
    case 'amount-asc':
      sorted.sort((a, b) => amountInBaseCents(a) - amountInBaseCents(b));
      break;
    case 'amount-desc':
      sorted.sort((a, b) => amountInBaseCents(b) - amountInBaseCents(a));
      break;
  }
  return sorted;
}
