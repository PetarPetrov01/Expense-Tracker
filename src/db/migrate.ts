import { useEffect, useState } from 'react';
import { eq, isNull } from 'drizzle-orm';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../../drizzle/migrations';
import { db } from './client';
import { categories } from './schema';
import { seedStableIdFor, generateUserStableId, isSeedName } from '../lib/export/stable-id';

async function backfillStableIds() {
  const rows = await db.select().from(categories).where(isNull(categories.stableId));
  for (const row of rows) {
    const sid = row.isSeed || isSeedName(row.name)
      ? seedStableIdFor(row.name)
      : generateUserStableId();
    await db.update(categories).set({ stableId: sid }).where(eq(categories.id, row.id));
  }
}

export function useRunMigrations() {
  const result = useMigrations(db, migrations);
  const [backfilled, setBackfilled] = useState(false);
  const [backfillError, setBackfillError] = useState<Error | null>(null);

  useEffect(() => {
    if (!result.success || backfilled) return;
    backfillStableIds()
      .then(() => setBackfilled(true))
      .catch((e: Error) => setBackfillError(e));
  }, [result.success, backfilled]);

  return {
    success: result.success && backfilled,
    error: result.error ?? backfillError,
  };
}
