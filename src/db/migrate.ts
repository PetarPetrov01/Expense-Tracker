import { useEffect, useState } from 'react';
import { eq, isNull } from 'drizzle-orm';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../../drizzle/migrations';
import { db } from './client';
import { categories, appSettings as appSettingsTable } from './schema';
import { seedStableIdFor, generateUserStableId, isSeedName } from '../lib/export/stable-id';
import { symbolToCode, isCurrencyCode } from '../lib/currency';
import { seedBgnIfMissing } from '../repositories/fxRates';
import { setSetting, deleteSetting } from '../repositories/settings';

async function backfillStableIds() {
  const rows = await db.select().from(categories).where(isNull(categories.stableId));
  for (const row of rows) {
    const sid = row.isSeed || isSeedName(row.name)
      ? seedStableIdFor(row.name)
      : generateUserStableId();
    await db.update(categories).set({ stableId: sid }).where(eq(categories.id, row.id));
  }
}

async function migrateCurrencySettingToDisplayCurrency() {
  const rows = await db.select().from(appSettingsTable);
  const byKey = Object.fromEntries(rows.map(r => [r.key, r.value]));
  // Idempotent: if displayCurrency already exists, no-op (drop any leftover legacy key).
  if (typeof byKey.displayCurrency === 'string') {
    if (typeof byKey.currency === 'string') await deleteSetting('currency');
    return;
  }
  if (typeof byKey.currency !== 'string') return; // fresh install — let store default kick in
  const legacy = byKey.currency;
  const code = isCurrencyCode(legacy) ? legacy : symbolToCode(legacy);
  await setSetting('displayCurrency', code);
  await deleteSetting('currency');
}

export function useRunMigrations() {
  const result = useMigrations(db, migrations);
  const [backfilled, setBackfilled] = useState(false);
  const [backfillError, setBackfillError] = useState<Error | null>(null);

  useEffect(() => {
    if (!result.success || backfilled) return;
    (async () => {
      try {
        await backfillStableIds();
        await migrateCurrencySettingToDisplayCurrency();
        await seedBgnIfMissing();
        setBackfilled(true);
      } catch (e) {
        setBackfillError(e as Error);
      }
    })();
  }, [result.success, backfilled]);

  return {
    success: result.success && backfilled,
    error: result.error ?? backfillError,
  };
}
