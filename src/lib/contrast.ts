// Returns black or white, whichever has better contrast against the given hex
// background. Uses the YIQ approximation of perceived luminance; threshold
// 0.55 keeps mid-greens reading as white, while yellows/oranges flip to black.
export function contrastFg(bgHex: string): '#fff' | '#000' {
  const hex = bgHex.replace('#', '');
  if (hex.length !== 6) return '#fff';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#fff';
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#000' : '#fff';
}
