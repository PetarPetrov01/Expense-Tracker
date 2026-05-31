import { eq } from 'drizzle-orm';
import { db, runInTransaction } from '../../db/client';
import { categories, expenses, tags } from '../../db/schema';
import { getOrCreateUncategorizedId } from '../../repositories/categories';
import { computeExpenseContentHash } from './hash';
import type { ExportV1, ExportV1Category, ExportV1Tag } from './format-v1';

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

async function resolveTagToLocalId(ft: ExportV1Tag): Promise<number> {
  const bySid = await db.select().from(tags).where(eq(tags.stableId, ft.stableId)).limit(1);
  if (bySid[0]) return bySid[0].id;
  const allLocal = await db.select().from(tags);
  const target = ft.name.trim().toLowerCase();
  const byName = allLocal.find(t => t.name.trim().toLowerCase() === target);
  if (byName) {
    await db.update(tags).set({ stableId: ft.stableId }).where(eq(tags.id, byName.id));
    return byName.id;
  }
  const [row] = await db.insert(tags).values({
    name: ft.name,
    stableId: ft.stableId,
    createdAt: new Date(ft.createdAt),
  }).returning({ id: tags.id });
  return row.id;
}

async function mergeImportInner(doc: ExportV1): Promise<{ inserted: number; skipped: number }> {
  const fileCatBySid = new Map(doc.categories.map(c => [c.stableId, c]));
  const localCatIdBySid = new Map<string, number>();
  for (const fc of doc.categories) {
    localCatIdBySid.set(fc.stableId, await resolveCategoryToLocalId(fc));
  }

  const localTagIdBySid = new Map<string, number>();
  for (const ft of doc.tags) {
    localTagIdBySid.set(ft.stableId, await resolveTagToLocalId(ft));
  }

  const localExps = await db.select().from(expenses);
  const localCats = await db.select().from(categories);
  const sidByLocalCatId = new Map<number, string>();
  for (const c of localCats) {
    if (c.stableId) sidByLocalCatId.set(c.id, c.stableId);
  }

  const localTags = await db.select().from(tags);
  const sidByLocalTagId = new Map<number, string>();
  for (const t of localTags) sidByLocalTagId.set(t.id, t.stableId);
  const localHashes = new Set<string>();
  for (const e of localExps) {
    const sid = sidByLocalCatId.get(e.categoryId);
    if (!sid) continue;
    const h = await computeExpenseContentHash({
      amountCents: e.amountCents,
      occurredAtIso: new Date(e.occurredAt).toISOString(),
      categoryStableId: sid,
      tagStableId: e.tagId != null ? (sidByLocalTagId.get(e.tagId) ?? null) : null,
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
      if (unknownCategoryLocalId === null) unknownCategoryLocalId = await getOrCreateUncategorizedId();
      localCatId = unknownCategoryLocalId;
    }
    if (localCatId === undefined) {
      throw new Error(`No local category id for stableId ${fe.categoryStableId}`);
    }
    const localTagId = fe.tagStableId != null ? (localTagIdBySid.get(fe.tagStableId) ?? null) : null;
    await db.insert(expenses).values({
      amountCents: fe.amountCents,
      // v2 backups carry the real currency/rate; v1 backups default to EUR @ 1:1 via the schema.
      currency: fe.currency,
      rateToBaseX1e6: fe.rateToBaseX1e6,
      categoryId: localCatId,
      tagId: localTagId,
      note: fe.note,
      occurredAt: new Date(fe.occurredAt),
      createdAt: new Date(fe.createdAt),
    });
    inserted++;
  }

  return { inserted, skipped };
}

// Public entry points run inside a single transaction so a mid-import failure leaves the
// database untouched rather than half-imported (critical for replace, which wipes first).
export async function applyMergeImport(doc: ExportV1): Promise<{ inserted: number; skipped: number }> {
  return runInTransaction(() => mergeImportInner(doc));
}

export async function applyReplaceImport(doc: ExportV1): Promise<{ inserted: number; skipped: number; wiped: { expenses: number; categories: number } }> {
  return runInTransaction(async () => {
    const expCountBefore = (await db.select().from(expenses)).length;
    const catCountBefore = (await db.select().from(categories)).length;
    await db.delete(expenses);
    await db.delete(tags);
    await db.delete(categories);
    const result = await mergeImportInner(doc);
    return { ...result, wiped: { expenses: expCountBefore, categories: catCountBefore } };
  });
}
