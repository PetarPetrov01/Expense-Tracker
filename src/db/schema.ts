import { sqliteTable, integer, text, primaryKey } from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  isSeed: integer('is_seed', { mode: 'boolean' }).notNull().default(false),
  stableId: text('stable_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull(),                    // ISO code (EUR/USD/GBP/BGN)
  rateToBaseX1e6: integer('rate_to_base_x1e6').notNull(),  // entryCurrency→EUR, x1e6
  categoryId: integer('category_id').notNull().references(() => categories.id),
  note: text('note'),
  occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const fxRates = sqliteTable('fx_rates', {
  base: text('base').notNull(),
  quote: text('quote').notNull(),
  rateX1e6: integer('rate_x1e6').notNull(),
  fetchedAt: integer('fetched_at').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.base, t.quote] }),
}));

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type FxRateRow = typeof fxRates.$inferSelect;
export type NewFxRateRow = typeof fxRates.$inferInsert;
export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
