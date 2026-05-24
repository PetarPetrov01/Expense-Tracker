import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { categories, expenses } from '../../db/schema';
import { computeExpenseContentHash } from './hash';
import type { ExportV1, ExportV1Category } from './format-v1';

const UNKNOWN_CATEGORY = {
  name: 'Imported (unknown)',
  icon: 'help-circle',
  color: '#9ca3af',
};

async function resolveCategoryToLocalId(fc: ExportV1Category): Promise<number> {
  const bySid = await db.select().from(categories).where(eq(categories.stableId, fc.stableId)).limit(1);
  if (bySid[0]) return bySid[0].id;
  const allLocal = await db.select().from(categories);
  const target = fc.name.trim().toLowerCase();
  const byName = allLocal.find(c => c.name.trim().toLowerCase() === target);
  if (byName) {
    await db.update(categories).set({ stableId: fc.stableId }).where(eq(categories.id, byName.id));
    return byName.id;
  }
  const [row] = await db.insert(categories).values({
    name: fc.name,
    icon: fc.icon,
    color: fc.color,
    isSeed: false,
    stableId: fc.stableId,
    createdAt: new Date(fc.createdAt),
  }).returning({ id: categories.id });
  return row.id;
}

async function getOrCreateUnknownCategoryId(): Promise<number> {
  const sid = 'user:imported-unknown';
  const existing = await db.select().from(categories).where(eq(categories.stableId, sid)).limit(1);
  if (existing[0]) return existing[0].id;
  const [row] = await db.insert(categories).values({
    name: UNKNOWN_CATEGORY.name,
    icon: UNKNOWN_CATEGORY.icon,
    color: UNKNOWN_CATEGORY.color,
    isSeed: false,
    stableId: sid,
    createdAt: new Date(),
  }).returning({ id: categories.id });
  return row.id;
}

export async function applyMergeImport(doc: ExportV1): Promise<{ inserted: number; skipped: number }> {
  const fileCatBySid = new Map(doc.categories.map(c => [c.stableId, c]));
  const localCatIdBySid = new Map<string, number>();
  for (const fc of doc.categories) {
    localCatIdBySid.set(fc.stableId, await resolveCategoryToLocalId(fc));
  }

  const localExps = await db.select().from(expenses);
  const localCats = await db.select().from(categories);
  const sidByLocalCatId = new Map<number, string>();
  for (const c of localCats) {
    if (c.stableId) sidByLocalCatId.set(c.id, c.stableId);
  }
  const localHashes = new Set<string>();
  for (const e of localExps) {
    const sid = sidByLocalCatId.get(e.categoryId);
    if (!sid) continue;
    const h = await computeExpenseContentHash({
      amountCents: e.amountCents,
      occurredAtIso: new Date(e.occurredAt).toISOString(),
      categoryStableId: sid,
      note: e.note,
    });
    localHashes.add(h);
  }

  let inserted = 0;
  let skipped = 0;
  let unknownCategoryLocalId: number | null = null;

  for (const fe of doc.expenses) {
    if (localHashes.has(fe.contentHash)) {
      skipped++;
      continue;
    }
    let localCatId = localCatIdBySid.get(fe.categoryStableId);
    if (localCatId === undefined && !fileCatBySid.has(fe.categoryStableId)) {
      if (unknownCategoryLocalId === null) unknownCategoryLocalId = await getOrCreateUnknownCategoryId();
      localCatId = unknownCategoryLocalId;
    }
    if (localCatId === undefined) {
      throw new Error(`No local category id for stableId ${fe.categoryStableId}`);
    }
    await db.insert(expenses).values({
      amountCents: fe.amountCents,
      currency: 'EUR',                  // imports pre-currency format default to EUR
      rateToBaseX1e6: 1_000_000,        // 1:1 rate
      categoryId: localCatId,
      note: fe.note,
      occurredAt: new Date(fe.occurredAt),
      createdAt: new Date(fe.createdAt),
    });
    inserted++;
  }

  return { inserted, skipped };
}

export async function applyReplaceImport(doc: ExportV1): Promise<{ inserted: number; skipped: number; wiped: { expenses: number; categories: number } }> {
  const expCountBefore = (await db.select().from(expenses)).length;
  const catCountBefore = (await db.select().from(categories)).length;
  await db.delete(expenses);
  await db.delete(categories);
  const result = await applyMergeImport(doc);
  return { ...result, wiped: { expenses: expCountBefore, categories: catCountBefore } };
}
