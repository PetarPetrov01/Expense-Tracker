import { db, schema } from '../db/client';
import { eq } from 'drizzle-orm';
import type { CurrencyCode } from '../lib/currency';
import { BGN_PEGGED_RATE_X1E6 } from '../lib/fx';

export type RatesEurToQuote = Record<string, number>; // keyed by quote code, x1_000_000

export async function getAllRates(): Promise<RatesEurToQuote> {
  const rows = await db.select().from(schema.fxRates);
  const out: RatesEurToQuote = {};
  for (const r of rows) {
    if (r.base !== 'EUR') continue;
    out[r.quote] = r.rateX1e6;
  }
  return out;
}

export async function upsertRates(
  rates: Record<Exclude<CurrencyCode, 'EUR'>, number>,
  fetchedAt: number,
): Promise<void> {
  // Always force-pin BGN regardless of caller — defense in depth.
  const merged: Record<string, number> = { ...rates, BGN: BGN_PEGGED_RATE_X1E6 };
  for (const [quote, rateX1e6] of Object.entries(merged)) {
    await db.insert(schema.fxRates)
      .values({ base: 'EUR', quote, rateX1e6, fetchedAt })
      .onConflictDoUpdate({
        target: [schema.fxRates.base, schema.fxRates.quote],
        set: { rateX1e6, fetchedAt },
      });
  }
}

export async function seedBgnIfMissing(): Promise<void> {
  const existing = await db.select().from(schema.fxRates)
    .where(eq(schema.fxRates.quote, 'BGN'));
  if (existing.length > 0) return;
  await db.insert(schema.fxRates).values({
    base: 'EUR', quote: 'BGN', rateX1e6: BGN_PEGGED_RATE_X1E6, fetchedAt: 0,
  });
}
