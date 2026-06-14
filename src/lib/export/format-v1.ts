import { z } from 'zod';

export const ExportV1CategorySchema = z.object({
  stableId: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().min(1),
  color: z.string().min(1),
  isSeed: z.boolean(),
  createdAt: z.string().datetime(),
});

export const ExportV1TagSchema = z.object({
  stableId: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const ExportV1ExpenseSchema = z.object({
  contentHash: z.string().regex(/^sha1:[0-9a-f]{40}$/),
  amountCents: z.number().int().nonnegative(),
  // Per-expense currency + snapshotted rate to base (EUR). Added in formatVersion 2.
  // v1 backups omit these; they default to EUR @ 1:1, which matches how v1 stored amounts.
  currency: z.string().min(1).default('EUR'),
  rateToBaseX1e6: z.number().int().positive().default(1_000_000),
  categoryStableId: z.string().min(1),
  tagStableId: z.string().min(1).nullable().default(null),
  note: z.string().nullable(),
  occurredAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const ExportV1Schema = z.object({
  format: z.literal('expense-tracker-export'),
  // Accept v1 (no per-expense currency) and v2 (with it). migrateToCurrent rejects newer.
  formatVersion: z.union([z.literal(1), z.literal(2)]),
  appVersion: z.string().min(1),
  exportedAt: z.string().datetime(),
  currency: z.string().min(1),
  categories: z.array(ExportV1CategorySchema),
  tags: z.array(ExportV1TagSchema).default([]),
  expenses: z.array(ExportV1ExpenseSchema),
});

export type ExportV1Category = z.infer<typeof ExportV1CategorySchema>;
export type ExportV1Tag = z.infer<typeof ExportV1TagSchema>;
export type ExportV1Expense = z.infer<typeof ExportV1ExpenseSchema>;
export type ExportV1 = z.infer<typeof ExportV1Schema>;

export const CURRENT_FORMAT_VERSION = 2 as const;
