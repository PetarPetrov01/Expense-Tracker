import * as Crypto from 'expo-crypto';

export const SEED_CATEGORY_NAMES: readonly string[] = [
  'Groceries', 'Restaurants', 'Transport', 'Rent', 'Utilities',
  'Entertainment', 'Health', 'Shopping', 'Travel', 'Other',
] as const;

export function seedStableIdFor(name: string): string {
  return 'seed:' + name.toLowerCase().replace(/\s+/g, '-');
}

export function generateUserStableId(): string {
  return 'user:' + Crypto.randomUUID();
}

export function isSeedName(name: string): boolean {
  return (SEED_CATEGORY_NAMES as readonly string[]).includes(name);
}
