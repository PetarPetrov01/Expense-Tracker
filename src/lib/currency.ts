export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'BGN';
export type CurrencySymbol = '€' | '$' | '£' | 'лв';

export const CURRENCY_CODES: readonly CurrencyCode[] = ['EUR', 'USD', 'GBP', 'BGN'] as const;

const CODE_TO_SYMBOL: Record<CurrencyCode, CurrencySymbol> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  BGN: 'лв',
};

const SYMBOL_TO_CODE: Record<CurrencySymbol, CurrencyCode> = {
  '€': 'EUR',
  '$': 'USD',
  '£': 'GBP',
  'лв': 'BGN',
};

export function codeToSymbol(code: CurrencyCode): CurrencySymbol {
  return CODE_TO_SYMBOL[code];
}

export function symbolToCode(symbol: string): CurrencyCode {
  return (SYMBOL_TO_CODE as Record<string, CurrencyCode | undefined>)[symbol] ?? 'EUR';
}

export function isCurrencyCode(s: string): s is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(s);
}

// formatAmount overloads: accept either a symbol (legacy) or a code (new code paths).
export function formatAmount(cents: number, symbolOrCode: CurrencyCode | CurrencySymbol = 'EUR'): string {
  const symbol: CurrencySymbol = isCurrencyCode(symbolOrCode)
    ? CODE_TO_SYMBOL[symbolOrCode]
    : symbolOrCode as CurrencySymbol;
  const whole = (cents / 100).toFixed(2);
  return `${symbol}${whole}`;
}

export function parseAmountToCents(input: string): number | null {
  const normalized = input.replace(',', '.').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
}
