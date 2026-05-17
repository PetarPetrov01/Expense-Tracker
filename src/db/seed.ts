import { db } from './client';
import { categories } from './schema';
import { count } from 'drizzle-orm';

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
  { name: 'Other',         icon: 'dots-horizontal',   color: '#6b7280' },
];

export async function seedIfEmpty() {
  const [{ value }] = await db.select({ value: count() }).from(categories);
  if (value > 0) return;
  const now = new Date();
  await db.insert(categories).values(SEED.map(c => ({ ...c, isSeed: true, createdAt: now })));
}
