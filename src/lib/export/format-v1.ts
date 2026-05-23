import { z } from 'zod';

export const ExportV1CategorySchema = z.object({
  stableId: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().min(1),
  color: z.string().min(1),
  isSeed: z.boolean(),
  createdAt: z.string().datetime(),
});

export const ExportV1ExpenseSchema = z.object({
  contentHash: z.string().regex(/^sha1:[0-9a-f]{40}$/),
  amountCents: z.number().int().nonnegative(),
  categoryStableId: z.string().min(1),
  note: z.string().nullable(),
  occurredAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const ExportV1Schema = z.object({
  format: z.literal('expense-tracker-export'),
  formatVersion: z.literal(1),
  appVersion: z.string().min(1),
  exportedAt: z.string().datetime(),
  currency: z.string().min(1),
  categories: z.array(ExportV1CategorySchema),
  expenses: z.array(ExportV1ExpenseSchema),
});

export type ExportV1Category = z.infer<typeof ExportV1CategorySchema>;
export type ExportV1Expense = z.infer<typeof ExportV1ExpenseSchema>;
export type ExportV1 = z.infer<typeof ExportV1Schema>;

export const CURRENT_FORMAT_VERSION = 1 as const;
