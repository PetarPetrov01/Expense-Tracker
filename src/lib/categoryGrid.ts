import type { Category } from '../db/schema';

/**
 * Promotes the selected category to position 0 of the grid for display only,
 * when it isn't already in `top`. Drops the last element so the array length
 * is preserved. Does NOT mutate inputs.
 */
export function promoteSelectedToGrid(
  top: Category[],
  selected: Category | null,
): Category[] {
  if (!selected) return top;
  if (top.some(c => c.id === selected.id)) return top;
  return [selected, ...top.slice(0, Math.max(0, top.length - 1))];
}
