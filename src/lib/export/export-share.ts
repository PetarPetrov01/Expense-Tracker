import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { buildExport } from './build-export';

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export async function exportToShareSheet(): Promise<void> {
  const doc = await buildExport();
  const json = JSON.stringify(doc, null, 2);
  const filename = `expense-tracker-${timestampForFilename()}.json`;
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export expenses',
    UTI: 'public.json',
  });
}

export async function copyRawDatabase(): Promise<void> {
  const dbPath = FileSystem.documentDirectory + 'SQLite/expense-tracker.db';
  const info = await FileSystem.getInfoAsync(dbPath);
  if (!info.exists) {
    throw new Error(`Database file not found at ${dbPath}.`);
  }
  const filename = `expense-tracker-${timestampForFilename()}.db`;
  const copyUri = FileSystem.cacheDirectory + filename;
  await FileSystem.copyAsync({ from: dbPath, to: copyUri });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(copyUri, {
    mimeType: 'application/x-sqlite3',
    dialogTitle: 'Copy raw database',
  });
}
