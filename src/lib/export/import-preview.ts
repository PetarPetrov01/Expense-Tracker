import { db } from '../../db/client';
import { categories, expenses, tags } from '../../db/schema';
import { computeExpenseContentHash } from './hash';
import type { ExportV1 } from './format-v1';

export type ImportPreview = {
  doc: ExportV1;
  expensesToInsert: number;
  expensesToSkip: number;
  categoriesNew: string[];
  categoriesMatchedByName: string[];
  tagsNew: string[];
  expensesUnknownCategory: number;
};

export async function computeImportPreview(doc: ExportV1): Promise<ImportPreview> {
  const localCats = await db.select().from(categories);
  const localExps = await db.select().from(expenses);

  const localBySid = new Map<string, typeof localCats[number]>();
  const localByName = new Map<string, typeof localCats[number]>();
  for (const c of localCats) {
    if (c.stableId) localBySid.set(c.stableId, c);
    localByName.set(c.name.trim().toLowerCase(), c);
  }

  const fileCatBySid = new Map(doc.categories.map(c => [c.stableId, c]));

  const categoriesNew: string[] = [];
  const categoriesMatchedByName: string[] = [];
  for (const fc of doc.categories) {
    if (localBySid.has(fc.stableId)) continue;
    const nameMatch = localByName.get(fc.name.trim().toLowerCase());
    if (nameMatch) {
      categoriesMatchedByName.push(fc.stableId);
    } else {
      categoriesNew.push(fc.stableId);
    }
  }

  const sidByLocalCatId = new Map<number, string>();
  for (const c of localCats) {
    if (c.stableId) sidByLocalCatId.set(c.id, c.stableId);
  }

  const localTags = await db.select().from(tags);
  const sidByLocalTagId = new Map<number, string>();
  const localTagBySid = new Set<string>();
  const localTagByName = new Set<string>();
  for (const t of localTags) {
    sidByLocalTagId.set(t.id, t.stableId);
    localTagBySid.add(t.stableId);
    localTagByName.add(t.name.trim().toLowerCase());
  }

  const tagsNew: string[] = [];
  for (const ft of doc.tags) {
    if (localTagBySid.has(ft.stableId)) continue;
    if (localTagByName.has(ft.name.trim().toLowerCase())) continue;
    tagsNew.push(ft.stableId);
  }

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

  let expensesToInsert = 0;
  let expensesToSkip = 0;
  let expensesUnknownCategory = 0;
  for (const fe of doc.expenses) {
    if (!fileCatBySid.has(fe.categoryStableId)) expensesUnknownCategory++;
    if (localHashes.has(fe.contentHash)) expensesToSkip++;
    else expensesToInsert++;
  }

  return {
    doc,
    expensesToInsert,
    expensesToSkip,
    categoriesNew,
    categoriesMatchedByName,
    tagsNew,
    expensesUnknownCategory,
  };
}
