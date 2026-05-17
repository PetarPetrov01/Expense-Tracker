export type CurrencySymbol = '€' | '$' | '£' | 'лв';

export function formatAmount(cents: number, symbol: CurrencySymbol = '€'): string {
  const whole = (cents / 100).toFixed(2);
  return `${symbol}${whole}`;
}

export function parseAmountToCents(input: string): number | null {
  const normalized = input.replace(',', '.').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
}
