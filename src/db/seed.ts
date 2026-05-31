import { db, runInTransaction } from './client';
import { categories } from './schema';
import { count } from 'drizzle-orm';
import { seedStableIdFor } from '../lib/export/stable-id';

const SEED: Array<{ name: string; icon: string; color: string }> = [
  { name: 'Groceries',     icon: 'cart',              color: '#10b981' },
  { name: 'Restaurants',   icon: 'silverware-fork-knife', color: '#f59e0b' },
  { name: 'Transport',     icon: 'bus',               color: '#3b82f6' },
  { name: 'Rent',          icon: 'home-city',         color: '#8b5cf6' },
  { name: 'Utilities',     icon: 'lightning-bolt',    color: '#eab308' },
  { name: 'Entertainment', icon: 'movie-open',        color: '#ec4899' },
  { name: 'Health',        icon: 'heart-pulse',       color: '#ef4444' },
  { name: 'Shopping',      icon: 'shopping',          color: '#14b8a6' },
  { name: 'Travel',        icon: 'airplane',          color: '#06b6d4' },
];

export async function seedIfEmpty() {
  // Count-then-insert in one transaction so two concurrent callers can't both see an
  // empty table and double-seed the default categories.
  await runInTransaction(async () => {
    const [{ value }] = await db.select({ value: count() }).from(categories);
    if (value > 0) return;
    const now = new Date();
    await db.insert(categories).values(SEED.map(c => ({
      ...c,
      isSeed: true,
      stableId: seedStableIdFor(c.name),
      createdAt: now,
    })));
  });
}
