import { db, schema } from '../db/client';
import { eq, gte, lte, and, desc, sql } from 'drizzle-orm';
import type { Expense, NewExpense } from '../db/schema';

export type ExpenseWithCategory = Expense & {
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
};

export async function listExpenses(opts?: { start?: Date; end?: Date; limit?: number }): Promise<ExpenseWithCategory[]> {
  const conds = [];
  if (opts?.start) conds.push(gte(schema.expenses.occurredAt, opts.start));
  if (opts?.end)   conds.push(lte(schema.expenses.occurredAt, opts.end));
  const rows = await db
    .select({
      id: schema.expenses.id,
      amountCents: schema.expenses.amountCents,
      currency: schema.expenses.currency,
      rateToBaseX1e6: schema.expenses.rateToBaseX1e6,
      categoryId: schema.expenses.categoryId,
      note: schema.expenses.note,
      occurredAt: schema.expenses.occurredAt,
      createdAt: schema.expenses.createdAt,
      categoryName: schema.categories.name,
      categoryIcon: schema.categories.icon,
      categoryColor: schema.categories.color,
    })
    .from(schema.expenses)
    .innerJoin(schema.categories, eq(schema.expenses.categoryId, schema.categories.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.expenses.occurredAt))
    .limit(opts?.limit ?? 1000);
  return rows;
}

export async function createExpense(
  input: Omit<NewExpense, 'id' | 'createdAt'>
): Promise<number> {
  const [row] = await db.insert(schema.expenses)
    .values({ ...input, createdAt: new Date() })
    .returning({ id: schema.expenses.id });
  return row.id;
}

export async function updateExpense(
  id: number,
  patch: Partial<Pick<Expense, 'amountCents' | 'currency' | 'rateToBaseX1e6' | 'categoryId' | 'note' | 'occurredAt'>>,
) {
  await db.update(schema.expenses).set(patch).where(eq(schema.expenses.id, id));
}

export async function deleteExpense(id: number) {
  await db.delete(schema.expenses).where(eq(schema.expenses.id, id));
}

// Returns *base-cents* aggregate so callers can convert to whatever display currency
// is current. Caller multiplies by the EUR→display rate once.
export async function sumExpensesInBase(start: Date, end: Date): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(ROUND(${schema.expenses.amountCents} * ${schema.expenses.rateToBaseX1e6} / 1000000.0) AS INTEGER)), 0)`,
    })
    .from(schema.expenses)
    .where(and(gte(schema.expenses.occurredAt, start), lte(schema.expenses.occurredAt, end)));
  return Number(row.total);
}

export async function sumByCategoryInBase(start: Date, end: Date) {
  return db
    .select({
      categoryId:   schema.categories.id,
      categoryName: schema.categories.name,
      categoryIcon: schema.categories.icon,
      categoryColor: schema.categories.color,
      total: sql<number>`COALESCE(SUM(CAST(ROUND(${schema.expenses.amountCents} * ${schema.expenses.rateToBaseX1e6} / 1000000.0) AS INTEGER)), 0)`,
    })
    .from(schema.expenses)
    .innerJoin(schema.categories, eq(schema.expenses.categoryId, schema.categories.id))
    .where(and(gte(schema.expenses.occurredAt, start), lte(schema.expenses.occurredAt, end)))
    .groupBy(schema.categories.id);
}

// TEMP shim until Phase 5 updates callers — removed in Task 17.
export const sumExpenses = sumExpensesInBase;
export const sumByCategory = sumByCategoryInBase;
