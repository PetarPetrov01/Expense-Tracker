import { ExportV1Schema, type ExportV1, CURRENT_FORMAT_VERSION } from './format-v1';

export class ImportFormatError extends Error {
  constructor(message: string, public readonly issues?: unknown) {
    super(message);
    this.name = 'ImportFormatError';
  }
}

export function migrateToCurrent(raw: unknown): ExportV1 {
  if (typeof raw !== 'object' || raw === null) {
    throw new ImportFormatError('Imported file is not a JSON object.');
  }
  const fv = (raw as { formatVersion?: unknown }).formatVersion;
  if (typeof fv !== 'number') {
    throw new ImportFormatError('Imported file is missing formatVersion.');
  }
  if (fv > CURRENT_FORMAT_VERSION) {
    throw new ImportFormatError(
      `This backup was made by a newer version of the app (formatVersion=${fv}). Update the app and try again.`,
    );
  }
  const parsed = ExportV1Schema.safeParse(raw);
  if (!parsed.success) {
    throw new ImportFormatError('Invalid export format.', parsed.error.issues);
  }
  return parsed.data;
}
