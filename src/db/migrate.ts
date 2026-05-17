import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../../drizzle/migrations';
import { db } from './client';

export function useRunMigrations() {
  return useMigrations(db, migrations);
}
