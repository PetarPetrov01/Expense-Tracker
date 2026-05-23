// Pure helpers for AmountInput. No React, no state, no imports.
//
// clampWhileTyping enforces the input shape AS the user types:
//   - Allowed chars: digits + a single decimal separator (. or ,, normalized to .)
//   - Max 2 decimal digits — keystrokes that would produce a 3rd decimal are dropped
//   - Leading zero handling: 005 → 5, 00 → 0, 0.5 → 0.5, 00.5 → 0.5, 0 → 0
//   - Leading "." auto-prefixed with "0" → ".5" becomes "0.5"
//   - Empty string is allowed during editing.
//
// padOnBlur pretty-prints on commit:
//   "" → "" (don't auto-fill)
//   "5" → "5.00"
//   "5." → "5.00"
//   "5.9" → "5.90"
//   "5.99" → "5.99"
//   "0." → "0.00"

export function clampWhileTyping(prev: string, next: string): string {
  let s = next.replace(',', '.');
  s = s.replace(/[^0-9.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }
  if (s.startsWith('.')) s = '0' + s;
  const dotAt = s.indexOf('.');
  const intPart = dotAt === -1 ? s : s.slice(0, dotAt);
  const fracWithDot = dotAt === -1 ? '' : s.slice(dotAt);
  let strippedInt = intPart.replace(/^0+/, '');
  if (strippedInt === '') {
    strippedInt = fracWithDot.length > 0 ? '0' : (intPart.length > 0 ? '0' : '');
  }
  s = strippedInt + fracWithDot;
  const dot2 = s.indexOf('.');
  if (dot2 !== -1 && s.length - dot2 - 1 > 2) {
    return prev;
  }
  return s;
}

export function padOnBlur(value: string): string {
  if (value === '') return '';
  const dotAt = value.indexOf('.');
  if (dotAt === -1) return value + '.00';
  const frac = value.slice(dotAt + 1);
  if (frac.length === 0) return value + '00';
  if (frac.length === 1) return value + '0';
  return value;
}
