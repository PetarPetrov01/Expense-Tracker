import * as Crypto from 'expo-crypto';

export function normalizeNote(note: string | null | undefined): string {
  return (note ?? '').trim();
}

export async function computeExpenseContentHash(input: {
  amountCents: number;
  occurredAtIso: string;
  categoryStableId: string;
  tagStableId: string | null;
  note: string | null | undefined;
}): Promise<string> {
  const payload = [
    String(input.amountCents),
    input.occurredAtIso,
    input.categoryStableId,
    input.tagStableId ?? '',
    normalizeNote(input.note),
  ].join('|');
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, payload);
  return 'sha1:' + digest;
}
