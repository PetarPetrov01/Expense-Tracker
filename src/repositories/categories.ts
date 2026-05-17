import { db, schema } from '../db/client';
import { eq, asc } from 'drizzle-orm';
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
