import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { appSettings } from '../db/schema';

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(appSettings);
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value } });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, key));
}
