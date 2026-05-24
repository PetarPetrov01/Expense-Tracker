import { db, schema } from '../db/client';
import { and, asc, eq, gte, sql } from 'drizzle-orm';
import type { Category, NewCategory } from '../db/schema';

export async function listCategories(): Promise<Category[]> {
  return db.select().from(schema.categories).orderBy(asc(schema.categories.name));
}

export async function getCategory(id: number): Promise<Category | undefined> {
  const rows = await db.select().from(schema.categories).where(eq(schema.categories.id, id));
  return rows[0];
}

export async function createCategory(input: Omit<NewCategory, 'id' | 'createdAt' | 'isSeed'>): Promise<number> {
  const [row] = await db.insert(schema.categories)
    .values({ ...input, isSeed: false, createdAt: new Date() })
    .returning({ id: schema.categories.id });
  return row.id;
}

export async function updateCategory(id: number, patch: Partial<Pick<Category, 'name' | 'icon' | 'color'>>) {
  await db.update(schema.categories).set(patch).where(eq(schema.categories.id, id));
}

export async function deleteCategory(id: number) {
  await db.delete(schema.categories).where(eq(schema.categories.id, id));
}

// Top categories ranked by usage in the last `sinceDays` days.
// Ordering: count desc, then most-recent occurredAt desc, then alphabetical name.
// Categories with no recent expenses appear at the tail (count = 0, max = NULL).
export async function listTopCategoriesByUsage(opts: {
  sinceDays: number;
  limit: number;
}): Promise<Category[]> {
  const cutoff = new Date(Date.now() - opts.sinceDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      id:        schema.categories.id,
      name:      schema.categories.name,
      icon:      schema.categories.icon,
      color:     schema.categories.color,
      isSeed:    schema.categories.isSeed,
      stableId:  schema.categories.stableId,
      createdAt: schema.categories.createdAt,
    })
    .from(schema.categories)
    .leftJoin(
      schema.expenses,
      and(
        eq(schema.expenses.categoryId, schema.categories.id),
        gte(schema.expenses.occurredAt, cutoff),
      ),
    )
    .groupBy(schema.categories.id)
    .orderBy(
      sql`COUNT(${schema.expenses.id}) DESC`,
      sql`MAX(${schema.expenses.occurredAt}) DESC`,
      asc(schema.categories.name),
    )
    .limit(opts.limit);
  return rows;
}
