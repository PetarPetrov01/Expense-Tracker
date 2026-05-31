import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const sqlite = openDatabaseSync('expense-tracker.db', { enableChangeListener: true });
// Enforce foreign keys. SQLite defaults this OFF per-connection, so without it the
// schema's references() are ignored and deleting a category/tag would orphan expenses.
sqlite.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });
// Raw handle, exposed for explicit transaction control (BEGIN/COMMIT/ROLLBACK). The
// drizzle expo-sqlite driver is synchronous, so awaited queries between BEGIN and
// COMMIT execute on this same connection inside the transaction.
export { sqlite };
export { schema };

/**
 * Run `fn` inside a single SQLite transaction. Because the drizzle expo-sqlite driver
 * executes synchronously, every awaited query inside `fn` runs on this connection while
 * the transaction is open; any throw rolls everything back. Do not nest.
 */
export async function runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
  sqlite.execSync('BEGIN');
  try {
    const result = await fn();
    sqlite.execSync('COMMIT');
    return result;
  } catch (e) {
    try { sqlite.execSync('ROLLBACK'); } catch { /* already rolled back */ }
    throw e;
  }
}
