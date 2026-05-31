// Converts the "eur export.csv" from the old expense app into the Expense Tracker
// import format (formatVersion 2). Run: node tools/csv-to-import.mjs <input.csv> <output.json>
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const inPath = process.argv[2];
const outPath = process.argv[3] ?? 'expense-tracker-import.json';

// --- category mapping --------------------------------------------------------
// seed:* stableIds merge into the app's built-in categories (matched on import).
// user:csv-* are brand-new categories. Icons are MaterialCommunityIcons names.
const CATS = {
  Groceries:      { stableId: 'seed:groceries', name: 'Groceries',      isSeed: true,  icon: 'cart',                  color: '#10b981' },
  Health:         { stableId: 'seed:health',    name: 'Health',         isSeed: true,  icon: 'heart-pulse',           color: '#ef4444' },
  Food:           { stableId: 'user:csv-food',         name: 'Food',           isSeed: false, icon: 'silverware-fork-knife', color: '#f59e0b' },
  Transportation: { stableId: 'user:csv-transportation', name: 'Transportation', isSeed: false, icon: 'car',                color: '#3b82f6' },
  Leisure:        { stableId: 'user:csv-leisure',      name: 'Leisure',        isSeed: false, icon: 'movie-open',            color: '#ec4899' },
  Gifts:          { stableId: 'user:csv-gifts',        name: 'Gifts',          isSeed: false, icon: 'gift',                  color: '#a855f7' },
  Bills:          { stableId: 'user:csv-bills',        name: 'Bills',          isSeed: false, icon: 'file-document-outline', color: '#eab308' },
  Barber:         { stableId: 'user:csv-barber',       name: 'Barber',         isSeed: false, icon: 'content-cut',           color: '#14b8a6' },
  Home:           { stableId: 'user:csv-home',         name: 'Home',           isSeed: false, icon: 'home-city',             color: '#8b5cf6' },
  Clothes:        { stableId: 'user:csv-clothes',      name: 'Clothes',        isSeed: false, icon: 'tshirt-crew',           color: '#06b6d4' },
  Fuel:           { stableId: 'user:csv-fuel',         name: 'Fuel',           isSeed: false, icon: 'gas-station',           color: '#f97316' },
  Fines:          { stableId: 'user:csv-fines',        name: 'Fines',          isSeed: false, icon: 'gavel',                 color: '#dc2626' },
  Cafe:           { stableId: 'user:csv-cafe',         name: 'Cafe',           isSeed: false, icon: 'coffee',                color: '#a16207' },
};

// entryCurrency → EUR, ×1e6. BGN is pegged (1 EUR = 1.95583 BGN); 1e12/1955830 ≈ 511292,
// matching the app's deriveRateToBaseX1e6 so converted totals agree exactly.
const RATE_BY_CCY = { EUR: 1_000_000, BGN: 511_292 };

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tag';
const tagStableId = name => 'user:csv-tag-' + (slug(name) === 'tag' ? Buffer.from(name).toString('hex') : slug(name));

// --- tiny CSV line parser (respects double quotes) ---------------------------
function parseLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const pad = n => String(n).padStart(2, '0');
function toIso(mdy) {
  const [m, d, y] = mdy.split('/').map(s => parseInt(s, 10));
  return `${y}-${pad(m)}-${pad(d)}T12:00:00.000Z`; // noon UTC → same calendar day everywhere
}
function toCents(s) {
  const [a, b = ''] = s.replace(/\s/g, '').replace(/\./g, '').split(','); // decimal comma
  return parseInt(a || '0', 10) * 100 + parseInt((b + '00').slice(0, 2), 10);
}
const sha1 = p => 'sha1:' + createHash('sha1').update(p, 'utf8').digest('hex');

const raw = await readFile(inPath, 'utf8');
const lines = raw.split(/\r?\n/).filter(l => l.trim().length);

const exportedAt = new Date().toISOString();
const usedCats = new Map();
const usedTags = new Map();
const expenses = [];

for (const line of lines) {
  const f = parseLine(line);
  // Only data rows: col0 must look like M/D/YYYY.
  if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(f[0]?.trim() ?? '')) continue;
  const [date, category, , amount, accCurrency, , , tags, comment] = f;
  const cat = CATS[category.trim()];
  if (!cat) { console.warn('Unmapped category:', category); continue; }
  const currency = (accCurrency ?? '').trim() || 'EUR';
  const rateToBaseX1e6 = RATE_BY_CCY[currency];
  if (!rateToBaseX1e6) { console.warn('Unknown currency, skipping row:', currency); continue; }
  usedCats.set(cat.stableId, cat);

  // App supports a single tag; if the source packed several ("💧, ⚡") take the first.
  const tagName = (tags ?? '').split(',')[0].trim();
  let tagSid = null;
  if (tagName) {
    tagSid = tagStableId(tagName);
    if (!usedTags.has(tagSid)) usedTags.set(tagSid, { stableId: tagSid, name: tagName, createdAt: exportedAt });
  }
  const note = (comment ?? '').trim() || null;
  const amountCents = toCents(amount);
  const occurredAt = toIso(date.trim());
  const contentHash = sha1([String(amountCents), occurredAt, cat.stableId, tagSid ?? '', (note ?? '').trim()].join('|'));

  expenses.push({ contentHash, amountCents, currency, rateToBaseX1e6,
    categoryStableId: cat.stableId, tagStableId: tagSid, note, occurredAt, createdAt: occurredAt });
}

const doc = {
  format: 'expense-tracker-export',
  formatVersion: 2,
  appVersion: '1.0.0',
  exportedAt,
  currency: expenses[0]?.currency ?? 'EUR',
  categories: [...usedCats.values()].map(c => ({
    stableId: c.stableId, name: c.name, icon: c.icon, color: c.color, isSeed: c.isSeed, createdAt: exportedAt,
  })),
  tags: [...usedTags.values()],
  expenses,
};

await writeFile(outPath, JSON.stringify(doc, null, 2));
const total = expenses.reduce((s, e) => s + e.amountCents, 0);
console.log(`Wrote ${outPath}`);
console.log(`  ${expenses.length} expenses, ${doc.categories.length} categories, ${doc.tags.length} tags`);
console.log(`  total: €${(total / 100).toFixed(2)}`);
console.log(`  categories: ${doc.categories.map(c => c.name).join(', ')}`);
console.log(`  tags: ${doc.tags.map(t => t.name).join(', ')}`);
