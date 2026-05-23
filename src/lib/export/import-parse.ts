import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { migrateToCurrent, ImportFormatError } from './migrate';
import type { ExportV1 } from './format-v1';

export type PickResult =
  | { kind: 'cancelled' }
  | { kind: 'parsed'; doc: ExportV1 }
  | { kind: 'error'; message: string };

export async function pickAndParseImport(): Promise<PickResult> {
  const pick = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (pick.canceled) return { kind: 'cancelled' };
  const asset = pick.assets[0];
  if (!asset) return { kind: 'error', message: 'No file selected.' };

  let raw: unknown;
  try {
    const text = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
    raw = JSON.parse(text);
  } catch (e) {
    return { kind: 'error', message: 'Could not read the file as JSON: ' + (e as Error).message };
  }

  try {
    const doc = migrateToCurrent(raw);
    return { kind: 'parsed', doc };
  } catch (e) {
    if (e instanceof ImportFormatError) return { kind: 'error', message: e.message };
    return { kind: 'error', message: 'Unknown error: ' + (e as Error).message };
  }
}
