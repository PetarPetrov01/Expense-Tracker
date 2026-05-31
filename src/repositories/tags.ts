import { db, schema } from '../db/client';
import { and, asc, eq, gte, sql } from 'drizzle-orm';
import type { Tag } from '../db/schema';
import { generateUserStableId } from '../lib/export/stable-id';

/** Trim only; display casing is preserved. Uniqueness is compared case-insensitively. */
export function normalizeTagName(name: string): string {
  return name.trim();
}

export async function listTags(): Promise<Tag[]> {
  return db.select().from(schema.tags).orderBy(asc(schema.tags.name));
}

// Tags ranked by usage in the last `sinceDays` days.
// Ordering: count desc, then most-recent occurredAt desc, then alphabetical name.
// Mirrors listTopCategoriesByUsage in repositories/categories.ts.
export async function listTopTagsByUsage(opts: {
  sinceDays: number;
  limit: number;
}): Promise<Tag[]> {
  const cutoff = new Date(Date.now() - opts.sinceDays * 24 * 60 * 60 * 1000);
  return db
    .select({
      id:        schema.tags.id,
      name:      schema.tags.name,
      stableId:  schema.tags.stableId,
      createdAt: schema.tags.createdAt,
    })
    .from(schema.tags)
    .leftJoin(
      schema.expenses,
      and(
        eq(schema.expenses.tagId, schema.tags.id),
        gte(schema.expenses.occurredAt, cutoff),
      ),
    )
    .groupBy(schema.tags.id)
    .orderBy(
      sql`COUNT(${schema.expenses.id}) DESC`,
      sql`COALESCE(MAX(${schema.expenses.occurredAt}), 0) DESC`,
      asc(schema.tags.name),
    )
    .limit(opts.limit);
}

/** Case-insensitive (trimmed) reuse; inserts a new tag with a generated stableId if none matches. */
export async function getOrCreateTag(rawName: string): Promise<Tag> {
  const name = normalizeTagName(rawName);
  if (!name) throw new Error('Tag name cannot be empty');
  const target = name.toLowerCase();
  const all = await db.select().from(schema.tags);
  const existing = all.find(t => t.name.trim().toLowerCase() === target);
  if (existing) return existing;
  const [row] = await db.insert(schema.tags)
    .values({ name, stableId: generateUserStableId(), createdAt: new Date() })
    .returning();
  return row;
}
