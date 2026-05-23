import Constants from 'expo-constants';
import { eq, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { categories, expenses } from '../../db/schema';
import { useSettings } from '../../stores/settings';
import { generateUserStableId, seedStableIdFor, isSeedName } from './stable-id';
import { computeExpenseContentHash } from './hash';
import type { ExportV1, ExportV1Category, ExportV1Expense } from './format-v1';
import { CURRENT_FORMAT_VERSION } from './format-v1';

async function ensureAllCategoriesHaveStableId(): Promise<void> {
  const missing = await db.select().from(categories).where(isNull(categories.stableId));
  for (const row of missing) {
    const sid = row.isSeed || isSeedName(row.name) ? seedStableIdFor(row.name) : generateUserStableId();
    await db.update(categories).set({ stableId: sid }).where(eq(categories.id, row.id));
  }
}

export async function buildExport(): Promise<ExportV1> {
  await ensureAllCategoriesHaveStableId();

  const catRows = await db.select().from(categories);
  const expRows = await db.select().from(expenses);

  const sidByCategoryId = new Map<number, string>();
  for (const c of catRows) {
    if (!c.stableId) throw new Error(`Category ${c.id} (${c.name}) has no stableId after backfill — invariant violated`);
    sidByCategoryId.set(c.id, c.stableId);
  }

  const exportedCategories: ExportV1Category[] = catRows.map(c => ({
    stableId: c.stableId!,
    name: c.name,
    icon: c.icon,
    color: c.color,
    isSeed: c.isSeed,
    createdAt: new Date(c.createdAt).toISOString(),
  }));

  const exportedExpenses: ExportV1Expense[] = [];
  for (const e of expRows) {
    const sid = sidByCategoryId.get(e.categoryId);
    if (!sid) throw new Error(`Expense ${e.id} references missing categoryId ${e.categoryId}`);
    const occurredAtIso = new Date(e.occurredAt).toISOString();
    const contentHash = await computeExpenseContentHash({
      amountCents: e.amountCents,
      occurredAtIso,
      categoryStableId: sid,
      note: e.note,
    });
    exportedExpenses.push({
      contentHash,
      amountCents: e.amountCents,
      categoryStableId: sid,
      note: e.note,
      occurredAt: occurredAtIso,
      createdAt: new Date(e.createdAt).toISOString(),
    });
  }

  const appVersion = (Constants.expoConfig?.version as string | undefined) ?? '0.0.0';
  const currency = useSettings.getState().currency;

  return {
    format: 'expense-tracker-export',
    formatVersion: CURRENT_FORMAT_VERSION,
    appVersion,
    exportedAt: new Date().toISOString(),
    currency,
    categories: exportedCategories,
    expenses: exportedExpenses,
  };
}
