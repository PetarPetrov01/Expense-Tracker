// Generates the app icon set: a donut/pie-chart mark in the app's own category colors
// (emerald, teal, amber, blue) on a dark-navy field. Run: node tools/gen-icons.mjs
// Requires sharp (install transiently with: npm i sharp --no-save).
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images');

const NAVY = '#0f172a';
// Donut segments — pulled from the seed category palette so the icon matches the app.
const SEGMENTS = [
  { color: '#10b981', frac: 0.46 }, // emerald (primary)
  { color: '#14b8a6', frac: 0.24 }, // teal
  { color: '#f59e0b', frac: 0.18 }, // amber
  { color: '#3b82f6', frac: 0.12 }, // blue
];

function pt(c, r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [c + r * Math.cos(a), c + r * Math.sin(a)];
}

function arc(c, r, a0, a1) {
  const [sx, sy] = pt(c, r, a0);
  const [ex, ey] = pt(c, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

// Build the donut arcs centred in a `size` box, centreline radius `r`, stroke `w`.
function donutPaths(size, r, w, { gapDeg = 5, mono = null, cap = 'round' } = {}) {
  const c = size / 2;
  if (mono) {
    // Single solid ring (one colour) for the Android themed/monochrome layer.
    return `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${mono}" stroke-width="${w}"/>`;
  }
  const data = 360 - gapDeg * SEGMENTS.length;
  let angle = 0;
  let out = '';
  for (const seg of SEGMENTS) {
    const sweep = seg.frac * data;
    out += `<path d="${arc(c, r, angle, angle + sweep)}" fill="none" stroke="${seg.color}" stroke-width="${w}" stroke-linecap="${cap}"/>`;
    angle += sweep + gapDeg;
  }
  return out;
}

// A bold dollar sign, centred. `height` ≈ font cap size; baseline nudged down by ~0.35×
// so the glyph sits vertically centred. (sharp/librsvg renders this with a system font.)
function dollarGlyph(size, { height, color = '#ffffff' } = {}) {
  const c = size / 2;
  const y = c + height * 0.35;
  return `<text x="${c}" y="${y}" font-family="Arial, Helvetica, DejaVu Sans, sans-serif" font-size="${height}" font-weight="800" fill="${color}" text-anchor="middle">$</text>`;
}

function svg(size, { bg = null, r, w, dollar = null, opts = {} } = {}) {
  const bgRect = bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : '';
  const ring = (r && w) ? donutPaths(size, r, w, opts) : '';
  const dol = dollar ? dollarGlyph(size, dollar) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bgRect}${ring}${dol}</svg>`;
}

async function render(name, svgStr, size) {
  const buf = await sharp(Buffer.from(svgStr)).resize(size, size).png().toBuffer();
  await writeFile(join(OUT, name), buf);
  console.log('wrote', name, `(${size}x${size})`);
}

const DOLLAR = '#f8fafc'; // near-white, matches theme text colour

const SVGS = {
  // Full app icon (iOS / general): navy field + thinner donut + centred dollar sign.
  'icon.png':       { size: 1024, svg: svg(1024, { bg: NAVY, r: 320, w: 110, dollar: { height: 360, color: DOLLAR } }) },
  // Android adaptive FOREGROUND: transparent, donut + dollar kept inside the 66% safe zone.
  'android-icon-foreground.png': { size: 512, svg: svg(512, { r: 120, w: 54, dollar: { height: 150, color: DOLLAR } }) },
  // Android adaptive BACKGROUND: solid navy (also set via backgroundColor in app.json).
  'android-icon-background.png': { size: 512, svg: svg(512, { bg: NAVY }) },
  // Android themed/MONOCHROME: single white ring + dollar, system tints the whole thing.
  'android-icon-monochrome.png': { size: 432, svg: svg(432, { r: 102, w: 46, dollar: { height: 128, color: '#ffffff' }, opts: { mono: '#ffffff' } }) },
  // Splash logo: transparent so the splash plugin's navy background shows through.
  'splash-icon.png': { size: 1024, svg: svg(1024, { r: 320, w: 110, dollar: { height: 360, color: DOLLAR } }) },
  // Web favicon.
  'favicon.png':    { size: 96, svg: svg(96, { bg: NAVY, r: 30, w: 11, dollar: { height: 34, color: DOLLAR } }) },
};

for (const [name, { svg: s, size }] of Object.entries(SVGS)) {
  await render(name, s, size);
}
console.log('done');
