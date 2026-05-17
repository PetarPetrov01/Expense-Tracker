# Expense Tracker (Android) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional offline-first Android expense tracker in React Native (Expo) with custom categories, icon picker, backdated entries, EUR default currency, and daily/monthly/yearly charts.

**Architecture:** Expo (managed workflow) + TypeScript + Expo Router (file-based nav) + expo-sqlite via Drizzle ORM for type-safe local persistence + Zustand for UI state + react-native-gifted-charts for visualizations + @expo/vector-icons for the icon picker. All data lives locally on the device (no backend). Predefined categories are seeded on first launch; the user can add, edit, and delete their own.

**Tech Stack:**
- Expo SDK 52+ (managed), React Native, TypeScript
- expo-router (file-based routing)
- expo-sqlite + drizzle-orm + drizzle-kit
- zustand (lightweight global state)
- react-native-gifted-charts (bar / line / pie)
- @expo/vector-icons (MaterialCommunityIcons set for the icon picker)
- react-hook-form + zod (forms and validation)
- date-fns (date math)
- @react-native-community/datetimepicker (native date picker, backdating)

---

## Brainstormed Functionality (MVP-first, then nice-to-haves)

**MVP (in this plan):**
1. Add an expense: amount, category, date (defaults to today, picker allows past dates), optional note.
2. Predefined seed categories: Groceries, Restaurants, Transport, Rent, Utilities, Entertainment, Health, Shopping, Travel, Other.
3. Custom categories: name + color + icon (pick from a curated MaterialCommunityIcons set).
4. List / edit / delete expenses.
5. Three reporting views: **Daily** (this week, bar per day), **Monthly** (this year, bar per month), **Yearly** (last N years, bar per year), plus a per-category **pie chart** for the selected range.
6. EUR default; currency symbol shown but a single setting can switch the symbol (€/$/£/лв).
7. Empty states, totals, average per period.
8. Local-only persistence (SQLite), no auth, no cloud.

**Nice-to-haves (NOT in this plan — flagged for follow-ups):**
- Budgets per category with progress bars.
- Recurring expenses.
- CSV export / import.
- Cloud backup (Supabase/Firebase).
- Multi-currency with FX conversion.
- Biometric lock.
- Widgets / quick-add notification.

---

## Tooling to Emulate an Android Phone (Windows)

Pick **one** of these. Recommended: **Android Studio AVD** for a stable, full emulator on your dev machine. Fallback: **Expo Go on your real phone** — fastest setup, no virtualization needed.

**Option A — Android Studio + AVD (recommended for serious dev):**
1. Install Android Studio: https://developer.android.com/studio
2. During setup, accept the Android SDK + Android Virtual Device components.
3. Enable hardware acceleration: BIOS → enable **Intel VT-x** or **AMD-V**. On Windows, install **Windows Hypervisor Platform** (Control Panel → Programs → Turn Windows Features on/off). Do NOT install HAXM on modern Windows; WHPX is the supported path.
4. Open Android Studio → More Actions → Virtual Device Manager → Create Device → pick **Pixel 7** → System Image **Android 14 (API 34)** (download if needed) → Finish.
5. Add `ANDROID_HOME` env var pointing to `%LOCALAPPDATA%\Android\Sdk` and add `%ANDROID_HOME%\platform-tools` to PATH so `adb` works.

**Option B — Expo Go on a physical phone (fastest):**
1. Install **Expo Go** from the Play Store.
2. Run `npx expo start` on dev machine — scan QR code with Expo Go.
3. Phone and laptop must be on the same Wi-Fi (or use tunnel: `npx expo start --tunnel`).

**Option C — Genymotion (alternative emulator):**
- Free for personal use, often faster than AVD on lower-end machines: https://www.genymotion.com/

**Verify the emulator works (run BEFORE Task 1):**
```powershell
adb devices
```
Expected: at least one device listed under `List of devices attached`. If empty, start the AVD from Android Studio first, then re-run.

---

## File Structure

```
android-app/
├── app/                              # expo-router screens (file-based routes)
│   ├── _layout.tsx                   # Root layout: providers, DB init, theme
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Bottom tab navigator
│   │   ├── index.tsx                 # Home (recent expenses + quick stats)
│   │   ├── stats.tsx                 # Charts (daily/monthly/yearly + pie)
│   │   └── settings.tsx              # Currency, manage categories
│   ├── expense/
│   │   ├── new.tsx                   # Add expense modal
│   │   └── [id].tsx                  # Edit/delete expense
│   └── category/
│       ├── index.tsx                 # Category list
│       └── edit.tsx                  # Create/edit (name, color, icon)
├── src/
│   ├── db/
│   │   ├── client.ts                 # Drizzle client + expo-sqlite handle
│   │   ├── schema.ts                 # categories, expenses tables
│   │   ├── migrate.ts                # Run drizzle migrations on app start
│   │   └── seed.ts                   # Seed predefined categories
│   ├── repositories/
│   │   ├── expenses.ts               # CRUD + range queries
│   │   └── categories.ts             # CRUD
│   ├── stores/
│   │   └── settings.ts               # Zustand: currency, theme
│   ├── components/
│   │   ├── CategoryIcon.tsx          # Circle w/ icon + color
│   │   ├── ExpenseRow.tsx            # List row
│   │   ├── AmountInput.tsx           # Numeric input w/ currency prefix
│   │   ├── IconPicker.tsx            # Grid of MaterialCommunityIcons
│   │   ├── ColorPicker.tsx           # Swatch row
│   │   ├── DateField.tsx             # Date input w/ native picker
│   │   ├── EmptyState.tsx
│   │   └── charts/
│   │       ├── PeriodBarChart.tsx    # Daily/Monthly/Yearly bars
│   │       └── CategoryPieChart.tsx
│   ├── lib/
│   │   ├── currency.ts               # formatAmount(cents, symbol)
│   │   ├── dates.ts                  # range helpers (day/month/year)
│   │   └── icons.ts                  # Curated icon name list for picker
│   └── theme.ts                      # Colors, spacing, typography tokens
├── drizzle/                          # Generated migrations
├── drizzle.config.ts
├── app.json                          # Expo config (Android: package, icon, splash)
├── tsconfig.json
├── package.json
└── babel.config.js
```

Files that change together live together (a screen, its row component, its repo call). The repository layer isolates SQL so screens stay declarative.

---

## Task 1: Initialize Expo Project

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `app/_layout.tsx`, `app/(tabs)/index.tsx`

- [ ] **Step 1: Scaffold the project**

From `D:\code\` (NOT inside `android-app`, since the directory already exists):

```powershell
cd D:\code
npx create-expo-app@latest android-app --template default
```

If `android-app` is non-empty (it has `docs/`), the CLI will refuse. Workaround: scaffold into a temp folder, then move files in:

```powershell
npx create-expo-app@latest _scaffold --template default
robocopy _scaffold android-app /E /XD docs
Remove-Item -Recurse -Force _scaffold
```

- [ ] **Step 2: Verify it runs on the emulator**

```powershell
cd D:\code\android-app
npx expo start --android
```

Expected: emulator (or Expo Go) launches and shows the default Expo welcome screen. If `adb` is not on PATH, fix that first — see "Tooling" section.

- [ ] **Step 3: Strip the demo content**

Delete the demo files Expo generated that we don't need:

```powershell
Remove-Item -Recurse -Force components, constants, hooks, scripts -ErrorAction SilentlyContinue
```

Replace `app/(tabs)/index.tsx` with a placeholder:

```tsx
import { View, Text } from 'react-native';
export default function Home() {
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Expense Tracker</Text>
  </View>;
}
```

- [ ] **Step 4: Commit**

```powershell
git init
git add -A
git commit -m "chore: scaffold expo project"
```

---

## Task 2: Install Core Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime libs**

```powershell
cd D:\code\android-app
npx expo install expo-sqlite expo-router @react-native-community/datetimepicker react-native-screens react-native-safe-area-context
npm install drizzle-orm zustand react-hook-form zod date-fns react-native-gifted-charts react-native-svg
npm install -D drizzle-kit @types/react
```

`npx expo install` (not `npm install`) for native modules — it pins versions Expo SDK supports.

- [ ] **Step 2: Verify install succeeded**

```powershell
npx expo doctor
```

Expected: no version warnings. Fix any reported mismatches before continuing.

- [ ] **Step 3: Commit**

```powershell
git add package.json package-lock.json
git commit -m "chore: add core dependencies"
```

---

## Task 3: Configure App Metadata for Android

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Set Android package + name**

Replace `app.json` with:

```json
{
  "expo": {
    "name": "Expense Tracker",
    "slug": "expense-tracker",
    "version": "1.0.0",
    "orientation": "portrait",
    "scheme": "expensetracker",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "android": {
      "package": "com.craftberry.expensetracker",
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#10b981"
      }
    },
    "plugins": [
      "expo-router",
      "expo-sqlite"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 2: Verify it still boots**

```powershell
npx expo start --android --clear
```

Expected: app launches; title bar says "Expense Tracker".

- [ ] **Step 3: Commit**

```powershell
git add app.json
git commit -m "chore: configure android app metadata"
```

---

## Task 4: Set Up Drizzle Schema

**Files:**
- Create: `src/db/schema.ts`, `drizzle.config.ts`

- [ ] **Step 1: Write the schema**

`src/db/schema.ts`:

```ts
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  isSeed: integer('is_seed', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amountCents: integer('amount_cents').notNull(),
  categoryId: integer('category_id').notNull().references(() => categories.id),
  note: text('note'),
  occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
```

Amounts stored as integer cents — never use floats for money.

- [ ] **Step 2: Write drizzle config**

`drizzle.config.ts`:

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
```

- [ ] **Step 3: Generate the first migration**

```powershell
npx drizzle-kit generate
```

Expected: `drizzle/0000_*.sql` created, plus `drizzle/meta/`.

- [ ] **Step 4: Commit**

```powershell
git add src/db/schema.ts drizzle.config.ts drizzle/
git commit -m "feat(db): add categories and expenses schema"
```

---

## Task 5: Initialize SQLite Client and Run Migrations

**Files:**
- Create: `src/db/client.ts`, `src/db/migrate.ts`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Write the DB client**

`src/db/client.ts`:

```ts
import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const sqlite = openDatabaseSync('expense-tracker.db', { enableChangeListener: true });
export const db = drizzle(sqlite, { schema });
export { schema };
```

- [ ] **Step 2: Add the migrate hook**

`src/db/migrate.ts`:

```ts
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../../drizzle/migrations';
import { db } from './client';

export function useRunMigrations() {
  return useMigrations(db, migrations);
}
```

`drizzle/migrations.js` is auto-generated by `drizzle-kit generate` (file lives at `drizzle/migrations.js` once present). If it's missing, re-run `npx drizzle-kit generate`.

- [ ] **Step 3: Gate the app on migrations**

Replace `app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { useRunMigrations } from '../src/db/migrate';

export default function RootLayout() {
  const { success, error } = useRunMigrations();

  if (error) {
    return <View><Text>Migration error: {error.message}</Text></View>;
  }
  if (!success) {
    return <View><Text>Setting up database…</Text></View>;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 4: Verify it boots without errors**

```powershell
npx expo start --android --clear
```

Expected: app launches past the "Setting up database…" splash to the placeholder home screen. Check the Metro logs — no red error overlay.

- [ ] **Step 5: Commit**

```powershell
git add src/db/client.ts src/db/migrate.ts app/_layout.tsx
git commit -m "feat(db): wire drizzle + migrations on app start"
```

---

## Task 6: Seed Predefined Categories

**Files:**
- Create: `src/db/seed.ts`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Write the seeder**

`src/db/seed.ts`:

```ts
import { db } from './client';
import { categories } from './schema';
import { count } from 'drizzle-orm';

const SEED: Array<{ name: string; icon: string; color: string }> = [
  { name: 'Groceries',     icon: 'cart',              color: '#10b981' },
  { name: 'Restaurants',   icon: 'silverware-fork-knife', color: '#f59e0b' },
  { name: 'Transport',     icon: 'bus',               color: '#3b82f6' },
  { name: 'Rent',          icon: 'home-city',         color: '#8b5cf6' },
  { name: 'Utilities',     icon: 'lightning-bolt',    color: '#eab308' },
  { name: 'Entertainment', icon: 'movie-open',        color: '#ec4899' },
  { name: 'Health',        icon: 'heart-pulse',       color: '#ef4444' },
  { name: 'Shopping',      icon: 'shopping',          color: '#14b8a6' },
  { name: 'Travel',        icon: 'airplane',          color: '#06b6d4' },
  { name: 'Other',         icon: 'dots-horizontal',   color: '#6b7280' },
];

export async function seedIfEmpty() {
  const [{ value }] = await db.select({ value: count() }).from(categories);
  if (value > 0) return;
  const now = new Date();
  await db.insert(categories).values(SEED.map(c => ({ ...c, isSeed: true, createdAt: now })));
}
```

- [ ] **Step 2: Run the seeder after migrations**

Modify `app/_layout.tsx` — replace the existing `RootLayout`:

```tsx
import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useRunMigrations } from '../src/db/migrate';
import { seedIfEmpty } from '../src/db/seed';

export default function RootLayout() {
  const { success, error } = useRunMigrations();
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (success) seedIfEmpty().then(() => setSeeded(true));
  }, [success]);

  if (error) return <View><Text>Migration error: {error.message}</Text></View>;
  if (!success || !seeded) return <View><Text>Loading…</Text></View>;

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 3: Verify seeding**

```powershell
npx expo start --android --clear
```

Open the dev menu in the emulator (Ctrl+M / Cmd+M). In the Metro terminal, add a temporary log in `seedIfEmpty`:

```ts
console.log('[seed] existing count =', value);
```

Expected on first launch: `[seed] existing count = 0` followed by no errors. On second launch: `[seed] existing count = 10`. Remove the log after verifying.

- [ ] **Step 4: Commit**

```powershell
git add src/db/seed.ts app/_layout.tsx
git commit -m "feat(db): seed predefined categories on first launch"
```

---

## Task 7: Currency, Theme, and Date Helpers

**Files:**
- Create: `src/lib/currency.ts`, `src/lib/dates.ts`, `src/theme.ts`, `src/stores/settings.ts`

- [ ] **Step 1: Currency formatter**

`src/lib/currency.ts`:

```ts
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
```

- [ ] **Step 2: Date helpers**

`src/lib/dates.ts`:

```ts
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear,
  eachDayOfInterval, eachMonthOfInterval, subDays, subMonths, subYears, format } from 'date-fns';

export type Period = 'day' | 'month' | 'year';

export function rangeFor(period: Period, anchor: Date = new Date()) {
  if (period === 'day') {
    return { start: startOfDay(subDays(anchor, 6)), end: endOfDay(anchor) };
  }
  if (period === 'month') {
    return { start: startOfMonth(subMonths(anchor, 11)), end: endOfMonth(anchor) };
  }
  return { start: startOfYear(subYears(anchor, 4)), end: endOfYear(anchor) };
}

export function bucketsFor(period: Period, anchor: Date = new Date()) {
  const { start, end } = rangeFor(period, anchor);
  if (period === 'day')   return eachDayOfInterval({ start, end }).map(d => ({ key: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE'), date: d }));
  if (period === 'month') return eachMonthOfInterval({ start, end }).map(d => ({ key: format(d, 'yyyy-MM'),    label: format(d, 'MMM'),  date: d }));
  const years: { key: string; label: string; date: Date }[] = [];
  for (let y = anchor.getFullYear() - 4; y <= anchor.getFullYear(); y++) {
    years.push({ key: String(y), label: String(y), date: new Date(y, 0, 1) });
  }
  return years;
}

export function bucketKeyFor(period: Period, d: Date): string {
  if (period === 'day')   return format(d, 'yyyy-MM-dd');
  if (period === 'month') return format(d, 'yyyy-MM');
  return format(d, 'yyyy');
}
```

- [ ] **Step 3: Theme**

`src/theme.ts`:

```ts
export const theme = {
  colors: {
    bg:        '#0f172a',
    surface:   '#1e293b',
    surface2:  '#334155',
    text:      '#f8fafc',
    textMuted: '#94a3b8',
    primary:   '#10b981',
    danger:    '#ef4444',
    border:    '#334155',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius:  { sm: 6, md: 10, lg: 16, pill: 999 },
};
```

- [ ] **Step 4: Settings store**

`src/stores/settings.ts`:

```ts
import { create } from 'zustand';
import type { CurrencySymbol } from '../lib/currency';

type State = {
  currency: CurrencySymbol;
  setCurrency: (c: CurrencySymbol) => void;
};

export const useSettings = create<State>((set) => ({
  currency: '€',
  setCurrency: (c) => set({ currency: c }),
}));
```

(Persistence to SQLite is a follow-up — default EUR is fine for MVP.)

- [ ] **Step 5: Commit**

```powershell
git add src/lib src/theme.ts src/stores
git commit -m "feat: currency, date, theme, settings utilities"
```

---

## Task 8: Repositories

**Files:**
- Create: `src/repositories/categories.ts`, `src/repositories/expenses.ts`

- [ ] **Step 1: Category repository**

`src/repositories/categories.ts`:

```ts
import { db, schema } from '../db/client';
import { eq, asc } from 'drizzle-orm';
import type { Category, NewCategory } from '../db/schema';

export async function listCategories(): Promise<Category[]> {
  return db.select().from(schema.categories).orderBy(asc(schema.categories.name));
}

export async function getCategory(id: number): Promise<Category | undefined> {
  const rows = await db.select().from(schema.categories).where(eq(schema.categories.id, id));
  return rows[0];
}

export async function createCategory(input: Omit<NewCategory, 'id' | 'createdAt' | 'isSeed'>): Promise<number> {
  const [row] = await db.insert(schema.categories)
    .values({ ...input, isSeed: false, createdAt: new Date() })
    .returning({ id: schema.categories.id });
  return row.id;
}

export async function updateCategory(id: number, patch: Partial<Pick<Category, 'name' | 'icon' | 'color'>>) {
  await db.update(schema.categories).set(patch).where(eq(schema.categories.id, id));
}

export async function deleteCategory(id: number) {
  await db.delete(schema.categories).where(eq(schema.categories.id, id));
}
```

- [ ] **Step 2: Expense repository**

`src/repositories/expenses.ts`:

```ts
import { db, schema } from '../db/client';
import { eq, gte, lte, and, desc, sql } from 'drizzle-orm';
import type { Expense, NewExpense } from '../db/schema';

export type ExpenseWithCategory = Expense & {
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
};

export async function listExpenses(opts?: { start?: Date; end?: Date; limit?: number }): Promise<ExpenseWithCategory[]> {
  const conds = [];
  if (opts?.start) conds.push(gte(schema.expenses.occurredAt, opts.start));
  if (opts?.end)   conds.push(lte(schema.expenses.occurredAt, opts.end));
  const rows = await db
    .select({
      id: schema.expenses.id,
      amountCents: schema.expenses.amountCents,
      categoryId: schema.expenses.categoryId,
      note: schema.expenses.note,
      occurredAt: schema.expenses.occurredAt,
      createdAt: schema.expenses.createdAt,
      categoryName: schema.categories.name,
      categoryIcon: schema.categories.icon,
      categoryColor: schema.categories.color,
    })
    .from(schema.expenses)
    .innerJoin(schema.categories, eq(schema.expenses.categoryId, schema.categories.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.expenses.occurredAt))
    .limit(opts?.limit ?? 1000);
  return rows;
}

export async function createExpense(input: Omit<NewExpense, 'id' | 'createdAt'>): Promise<number> {
  const [row] = await db.insert(schema.expenses)
    .values({ ...input, createdAt: new Date() })
    .returning({ id: schema.expenses.id });
  return row.id;
}

export async function updateExpense(id: number, patch: Partial<Pick<Expense, 'amountCents' | 'categoryId' | 'note' | 'occurredAt'>>) {
  await db.update(schema.expenses).set(patch).where(eq(schema.expenses.id, id));
}

export async function deleteExpense(id: number) {
  await db.delete(schema.expenses).where(eq(schema.expenses.id, id));
}

export async function sumExpenses(start: Date, end: Date): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.expenses.amountCents}), 0)` })
    .from(schema.expenses)
    .where(and(gte(schema.expenses.occurredAt, start), lte(schema.expenses.occurredAt, end)));
  return Number(row.total);
}

export async function sumByCategory(start: Date, end: Date) {
  return db
    .select({
      categoryId:   schema.categories.id,
      categoryName: schema.categories.name,
      categoryIcon: schema.categories.icon,
      categoryColor: schema.categories.color,
      total: sql<number>`COALESCE(SUM(${schema.expenses.amountCents}), 0)`,
    })
    .from(schema.expenses)
    .innerJoin(schema.categories, eq(schema.expenses.categoryId, schema.categories.id))
    .where(and(gte(schema.expenses.occurredAt, start), lte(schema.expenses.occurredAt, end)))
    .groupBy(schema.categories.id);
}
```

- [ ] **Step 3: Verify it compiles**

```powershell
npx tsc --noEmit
```

Expected: 0 errors. Fix any type mismatches before continuing.

- [ ] **Step 4: Commit**

```powershell
git add src/repositories
git commit -m "feat(repo): category and expense CRUD + aggregates"
```

---

## Task 9: Shared UI — CategoryIcon, AmountInput, DateField

**Files:**
- Create: `src/components/CategoryIcon.tsx`, `src/components/AmountInput.tsx`, `src/components/DateField.tsx`, `src/components/EmptyState.tsx`, `src/lib/icons.ts`

- [ ] **Step 1: Curated icon list**

`src/lib/icons.ts`:

```ts
export const PICKABLE_ICONS = [
  'cart', 'silverware-fork-knife', 'bus', 'car', 'train', 'bike', 'airplane',
  'home-city', 'home', 'lightning-bolt', 'water', 'fire', 'wifi',
  'movie-open', 'gamepad-variant', 'music', 'book-open-variant',
  'heart-pulse', 'pill', 'dumbbell',
  'shopping', 'tshirt-crew', 'hanger',
  'gift', 'cake-variant', 'coffee', 'glass-cocktail',
  'school', 'briefcase', 'cellphone', 'laptop',
  'paw', 'tree', 'flower',
  'cash', 'credit-card', 'bank', 'piggy-bank',
  'dots-horizontal',
] as const;

export type IconName = typeof PICKABLE_ICONS[number];
```

- [ ] **Step 2: CategoryIcon**

`src/components/CategoryIcon.tsx`:

```tsx
import { View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export function CategoryIcon({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, justifyContent: 'center', alignItems: 'center',
    }}>
      <MaterialCommunityIcons name={icon as any} size={size * 0.55} color="#fff" />
    </View>
  );
}
```

- [ ] **Step 3: AmountInput**

`src/components/AmountInput.tsx`:

```tsx
import { TextInput, View, Text } from 'react-native';
import { theme } from '../theme';
import { useSettings } from '../stores/settings';

export function AmountInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const currency = useSettings(s => s.currency);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.md }}>
      <Text style={{ color: theme.colors.textMuted, fontSize: 28, marginRight: 8 }}>{currency}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="0.00"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="decimal-pad"
        style={{ flex: 1, color: theme.colors.text, fontSize: 32, paddingVertical: 16 }}
      />
    </View>
  );
}
```

- [ ] **Step 4: DateField (with backdating support)**

`src/components/DateField.tsx`:

```tsx
import { useState } from 'react';
import { Pressable, Text, View, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { theme } from '../theme';

export function DateField({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen(true)} style={{
        backgroundColor: theme.colors.surface, padding: theme.spacing.md,
        borderRadius: theme.radius.md,
      }}>
        <Text style={{ color: theme.colors.text, fontSize: 16 }}>{format(value, 'PPP')}</Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={value}
          mode="date"
          maximumDate={new Date()}
          onChange={(_, d) => {
            setOpen(Platform.OS === 'ios');
            if (d) onChange(d);
          }}
        />
      )}
    </View>
  );
}
```

`maximumDate={new Date()}` blocks future dates; past dates work freely (backdating requirement).

- [ ] **Step 5: EmptyState**

`src/components/EmptyState.tsx`:

```tsx
import { View, Text } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '../theme';

export function EmptyState({ icon = 'inbox', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl }}>
      <MaterialCommunityIcons name={icon as any} size={64} color={theme.colors.textMuted} />
      <Text style={{ color: theme.colors.text, fontSize: 18, marginTop: theme.spacing.md }}>{title}</Text>
      {hint && <Text style={{ color: theme.colors.textMuted, marginTop: 4, textAlign: 'center' }}>{hint}</Text>}
    </View>
  );
}
```

- [ ] **Step 6: Commit**

```powershell
git add src/components src/lib/icons.ts
git commit -m "feat(ui): shared input components and category icon"
```

---

## Task 10: Bottom Tabs

**Files:**
- Create: `app/(tabs)/_layout.tsx`, `app/(tabs)/stats.tsx`, `app/(tabs)/settings.tsx`
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Tab layout**

`app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '../../src/theme';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: theme.colors.textMuted,
      tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
      headerStyle: { backgroundColor: theme.colors.bg },
      headerTitleStyle: { color: theme.colors.text },
    }}>
      <Tabs.Screen name="index"    options={{ title: 'Home',     tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home"        size={size} color={color} /> }} />
      <Tabs.Screen name="stats"    options={{ title: 'Stats',    tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="chart-bar"   size={size} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog"         size={size} color={color} /> }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: Stub the new screens**

`app/(tabs)/stats.tsx`:

```tsx
import { View, Text } from 'react-native';
import { theme } from '../../src/theme';
export default function Stats() {
  return <View style={{ flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing.lg }}>
    <Text style={{ color: theme.colors.text }}>Stats (placeholder)</Text>
  </View>;
}
```

`app/(tabs)/settings.tsx`:

```tsx
import { View, Text } from 'react-native';
import { theme } from '../../src/theme';
export default function Settings() {
  return <View style={{ flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing.lg }}>
    <Text style={{ color: theme.colors.text }}>Settings (placeholder)</Text>
  </View>;
}
```

- [ ] **Step 3: Verify tabs render**

```powershell
npx expo start --android --clear
```

Expected: three tabs at the bottom — Home, Stats, Settings — each navigates to its placeholder.

- [ ] **Step 4: Commit**

```powershell
git add app/
git commit -m "feat(nav): bottom tab navigation"
```

---

## Task 11: Add Expense Modal

**Files:**
- Create: `app/expense/new.tsx`, `src/components/CategoryPickerSheet.tsx`
- Modify: `app/_layout.tsx` (register modal route)

- [ ] **Step 1: Category picker (grid sheet)**

`src/components/CategoryPickerSheet.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, FlatList } from 'react-native';
import { listCategories } from '../repositories/categories';
import type { Category } from '../db/schema';
import { CategoryIcon } from './CategoryIcon';
import { theme } from '../theme';

export function CategoryPickerSheet({ visible, onClose, onSelect }: {
  visible: boolean; onClose: () => void; onSelect: (c: Category) => void;
}) {
  const [items, setItems] = useState<Category[]>([]);
  useEffect(() => { if (visible) listCategories().then(setItems); }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      <View style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.lg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, marginBottom: theme.spacing.md }}>Choose category</Text>
        <FlatList
          data={items}
          numColumns={4}
          keyExtractor={(c) => String(c.id)}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { onSelect(item); onClose(); }}
              style={{ flex: 1, alignItems: 'center', padding: theme.spacing.sm }}
            >
              <CategoryIcon icon={item.icon} color={item.color} />
              <Text style={{ color: theme.colors.text, marginTop: 4, fontSize: 12, textAlign: 'center' }} numberOfLines={1}>{item.name}</Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Add expense screen**

`app/expense/new.tsx`:

```tsx
import { useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { AmountInput } from '../../src/components/AmountInput';
import { DateField } from '../../src/components/DateField';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { CategoryPickerSheet } from '../../src/components/CategoryPickerSheet';
import { parseAmountToCents } from '../../src/lib/currency';
import { createExpense } from '../../src/repositories/expenses';
import type { Category } from '../../src/db/schema';
import { theme } from '../../src/theme';

export default function NewExpense() {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);

  async function save() {
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) return Alert.alert('Invalid amount');
    if (!category) return Alert.alert('Pick a category');
    await createExpense({ amountCents: cents, categoryId: category.id, note: note || null, occurredAt: date });
    router.back();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <AmountInput value={amount} onChange={setAmount} />

      <Pressable onPress={() => setPickerOpen(true)} style={{
        backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md,
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      }}>
        {category
          ? <><CategoryIcon icon={category.icon} color={category.color} size={32} /><Text style={{ color: theme.colors.text, fontSize: 16 }}>{category.name}</Text></>
          : <Text style={{ color: theme.colors.textMuted, fontSize: 16 }}>Choose category</Text>}
      </Pressable>

      <DateField value={date} onChange={setDate} />

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional)"
        placeholderTextColor={theme.colors.textMuted}
        style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md, color: theme.colors.text }}
      />

      <Pressable onPress={save} style={{ backgroundColor: theme.colors.primary, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Save expense</Text>
      </Pressable>

      <CategoryPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={setCategory} />
    </ScrollView>
  );
}
```

- [ ] **Step 3: Register the modal route**

Modify `app/_layout.tsx` — replace the `<Stack screenOptions={...} />` line with:

```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="(tabs)" />
  <Stack.Screen name="expense/new"  options={{ presentation: 'modal', headerShown: true, title: 'New expense' }} />
  <Stack.Screen name="expense/[id]" options={{ presentation: 'modal', headerShown: true, title: 'Edit expense' }} />
  <Stack.Screen name="category/index" options={{ headerShown: true, title: 'Categories' }} />
  <Stack.Screen name="category/edit"  options={{ presentation: 'modal', headerShown: true, title: 'Edit category' }} />
</Stack>
```

- [ ] **Step 4: Verify the flow manually**

```powershell
npx expo start --android --clear
```

Open the app — we'll wire the "+" button in Task 12. For now navigate via the URL bar in the dev menu by entering `/expense/new`, or temporarily add a button on Home (and remove it after this task). Confirm an expense saves without errors and the modal dismisses.

- [ ] **Step 5: Commit**

```powershell
git add app/expense src/components/CategoryPickerSheet.tsx app/_layout.tsx
git commit -m "feat(expense): add expense modal with category picker and backdating"
```

---

## Task 12: Home Screen (Recent Expenses + Totals + FAB)

**Files:**
- Create: `src/components/ExpenseRow.tsx`
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: ExpenseRow component**

`src/components/ExpenseRow.tsx`:

```tsx
import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { format } from 'date-fns';
import { CategoryIcon } from './CategoryIcon';
import { formatAmount } from '../lib/currency';
import { useSettings } from '../stores/settings';
import type { ExpenseWithCategory } from '../repositories/expenses';
import { theme } from '../theme';

export function ExpenseRow({ e }: { e: ExpenseWithCategory }) {
  const currency = useSettings(s => s.currency);
  return (
    <Link href={`/expense/${e.id}`} asChild>
      <Pressable style={{
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
        padding: theme.spacing.md, backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md, marginBottom: theme.spacing.sm,
      }}>
        <CategoryIcon icon={e.categoryIcon} color={e.categoryColor} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontSize: 16 }}>{e.categoryName}</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={1}>
            {format(e.occurredAt, 'PP')}{e.note ? ` · ${e.note}` : ''}
          </Text>
        </View>
        <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>
          {formatAmount(e.amountCents, currency)}
        </Text>
      </Pressable>
    </Link>
  );
}
```

- [ ] **Step 2: Home screen**

Replace `app/(tabs)/index.tsx`:

```tsx
import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { listExpenses, sumExpenses, type ExpenseWithCategory } from '../../src/repositories/expenses';
import { ExpenseRow } from '../../src/components/ExpenseRow';
import { EmptyState } from '../../src/components/EmptyState';
import { formatAmount } from '../../src/lib/currency';
import { useSettings } from '../../src/stores/settings';
import { startOfMonth, endOfMonth } from 'date-fns';
import { theme } from '../../src/theme';

export default function Home() {
  const currency = useSettings(s => s.currency);
  const [items, setItems] = useState<ExpenseWithCategory[]>([]);
  const [monthTotal, setMonthTotal] = useState(0);

  useFocusEffect(useCallback(() => {
    const now = new Date();
    listExpenses({ limit: 50 }).then(setItems);
    sumExpenses(startOfMonth(now), endOfMonth(now)).then(setMonthTotal);
  }, []));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.textMuted }}>This month</Text>
        <Text style={{ color: theme.colors.text, fontSize: 32, fontWeight: '700' }}>
          {formatAmount(monthTotal, currency)}
        </Text>
      </View>

      {items.length === 0 ? (
        <EmptyState icon="cash-remove" title="No expenses yet" hint="Tap + to add your first one." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(e) => String(e.id)}
          renderItem={({ item }) => <ExpenseRow e={item} />}
          contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0 }}
        />
      )}

      <Link href="/expense/new" asChild>
        <Pressable style={{
          position: 'absolute', right: 24, bottom: 24,
          width: 60, height: 60, borderRadius: 30,
          backgroundColor: theme.colors.primary,
          justifyContent: 'center', alignItems: 'center',
          elevation: 4,
        }}>
          <MaterialCommunityIcons name="plus" size={32} color="#fff" />
        </Pressable>
      </Link>
    </View>
  );
}
```

- [ ] **Step 3: Verify end-to-end**

```powershell
npx expo start --android --clear
```

Expected:
1. App opens to empty Home with "No expenses yet" empty state and a green "+" FAB.
2. Tap FAB → modal opens.
3. Enter amount `12.50`, pick a category, leave date as today, save.
4. Back on Home: month total reads `€12.50` and the row shows the category + amount.
5. Repeat with a **past date** to confirm backdating works.

- [ ] **Step 4: Commit**

```powershell
git add src/components/ExpenseRow.tsx app/(tabs)/index.tsx
git commit -m "feat(home): recent expenses list, month total, and FAB"
```

---

## Task 13: Edit / Delete Expense

**Files:**
- Create: `app/expense/[id].tsx`

- [ ] **Step 1: Write the edit screen**

`app/expense/[id].tsx`:

```tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { AmountInput } from '../../src/components/AmountInput';
import { DateField } from '../../src/components/DateField';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { CategoryPickerSheet } from '../../src/components/CategoryPickerSheet';
import { parseAmountToCents } from '../../src/lib/currency';
import { listExpenses, updateExpense, deleteExpense } from '../../src/repositories/expenses';
import { getCategory } from '../../src/repositories/categories';
import type { Category } from '../../src/db/schema';
import { theme } from '../../src/theme';

export default function EditExpense() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenseId = Number(id);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const rows = await listExpenses({ limit: 1000 });
      const found = rows.find(r => r.id === expenseId);
      if (!found) return router.back();
      setAmount((found.amountCents / 100).toFixed(2));
      setNote(found.note ?? '');
      setDate(new Date(found.occurredAt));
      const cat = await getCategory(found.categoryId);
      if (cat) setCategory(cat);
    })();
  }, [expenseId]);

  async function save() {
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) return Alert.alert('Invalid amount');
    if (!category) return Alert.alert('Pick a category');
    await updateExpense(expenseId, { amountCents: cents, categoryId: category.id, note: note || null, occurredAt: date });
    router.back();
  }

  function confirmDelete() {
    Alert.alert('Delete expense?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteExpense(expenseId); router.back(); } },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <AmountInput value={amount} onChange={setAmount} />

      <Pressable onPress={() => setPickerOpen(true)} style={{
        backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md,
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      }}>
        {category
          ? <><CategoryIcon icon={category.icon} color={category.color} size={32} /><Text style={{ color: theme.colors.text, fontSize: 16 }}>{category.name}</Text></>
          : <Text style={{ color: theme.colors.textMuted }}>Choose category</Text>}
      </Pressable>

      <DateField value={date} onChange={setDate} />

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional)"
        placeholderTextColor={theme.colors.textMuted}
        style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md, color: theme.colors.text }}
      />

      <Pressable onPress={save} style={{ backgroundColor: theme.colors.primary, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Save changes</Text>
      </Pressable>

      <Pressable onPress={confirmDelete} style={{ padding: theme.spacing.md, alignItems: 'center' }}>
        <Text style={{ color: theme.colors.danger, fontSize: 16 }}>Delete</Text>
      </Pressable>

      <CategoryPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={setCategory} />
    </ScrollView>
  );
}
```

- [ ] **Step 2: Verify edit + delete**

```powershell
npx expo start --android --clear
```

Expected: tap an expense row on Home → modal opens prefilled → edit amount → save → list updates. Reopen → tap Delete → confirm → row disappears, totals update.

- [ ] **Step 3: Commit**

```powershell
git add app/expense/[id].tsx
git commit -m "feat(expense): edit and delete expense"
```

---

## Task 14: Category Management (List + Create/Edit + Icon/Color Pickers)

**Files:**
- Create: `app/category/index.tsx`, `app/category/edit.tsx`, `src/components/IconPicker.tsx`, `src/components/ColorPicker.tsx`

- [ ] **Step 1: ColorPicker**

`src/components/ColorPicker.tsx`:

```tsx
import { View, Pressable } from 'react-native';
import { theme } from '../theme';

const SWATCHES = ['#10b981','#3b82f6','#8b5cf6','#ec4899','#ef4444','#f59e0b','#eab308','#14b8a6','#06b6d4','#6b7280'];

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {SWATCHES.map(c => (
        <Pressable key={c} onPress={() => onChange(c)} style={{
          width: 36, height: 36, borderRadius: 18, backgroundColor: c,
          borderWidth: value === c ? 3 : 0, borderColor: theme.colors.text,
        }} />
      ))}
    </View>
  );
}
```

- [ ] **Step 2: IconPicker**

`src/components/IconPicker.tsx`:

```tsx
import { FlatList, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { PICKABLE_ICONS } from '../lib/icons';
import { theme } from '../theme';

export function IconPicker({ value, color, onChange }: { value: string; color: string; onChange: (icon: string) => void }) {
  return (
    <FlatList
      data={PICKABLE_ICONS as readonly string[]}
      numColumns={6}
      keyExtractor={(i) => i}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onChange(item)}
          style={{
            flex: 1, aspectRatio: 1, justifyContent: 'center', alignItems: 'center',
            margin: 4, borderRadius: theme.radius.md,
            backgroundColor: value === item ? color : theme.colors.surface2,
          }}>
          <MaterialCommunityIcons name={item as any} size={26} color="#fff" />
        </Pressable>
      )}
    />
  );
}
```

- [ ] **Step 3: Category list screen**

`app/category/index.tsx`:

```tsx
import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert } from 'react-native';
import { Link, useFocusEffect, router } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { listCategories, deleteCategory } from '../../src/repositories/categories';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import type { Category } from '../../src/db/schema';
import { theme } from '../../src/theme';

export default function Categories() {
  const [items, setItems] = useState<Category[]>([]);
  useFocusEffect(useCallback(() => { listCategories().then(setItems); }, []));

  function onLongPress(c: Category) {
    if (c.isSeed) return Alert.alert('Seed categories cannot be deleted');
    Alert.alert(`Delete "${c.name}"?`, 'Expenses in this category will be orphaned.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteCategory(c.id);
        setItems(await listCategories());
      } },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/category/edit', params: { id: String(item.id) } })}
            onLongPress={() => onLongPress(item)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
              padding: theme.spacing.md, backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md, marginBottom: theme.spacing.sm,
            }}>
            <CategoryIcon icon={item.icon} color={item.color} size={36} />
            <Text style={{ flex: 1, color: theme.colors.text, fontSize: 16 }}>{item.name}</Text>
            {item.isSeed && <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>seed</Text>}
          </Pressable>
        )}
      />

      <Link href="/category/edit" asChild>
        <Pressable style={{
          position: 'absolute', right: 24, bottom: 24,
          width: 60, height: 60, borderRadius: 30,
          backgroundColor: theme.colors.primary,
          justifyContent: 'center', alignItems: 'center', elevation: 4,
        }}>
          <MaterialCommunityIcons name="plus" size={32} color="#fff" />
        </Pressable>
      </Link>
    </View>
  );
}
```

- [ ] **Step 4: Category edit screen**

`app/category/edit.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { ColorPicker } from '../../src/components/ColorPicker';
import { IconPicker } from '../../src/components/IconPicker';
import { createCategory, updateCategory, getCategory } from '../../src/repositories/categories';
import { theme } from '../../src/theme';

export default function CategoryEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = id != null;
  const [name, setName] = useState('');
  const [color, setColor] = useState('#10b981');
  const [icon, setIcon] = useState('cart');

  useEffect(() => {
    if (!editing) return;
    getCategory(Number(id)).then(c => {
      if (!c) return router.back();
      setName(c.name); setColor(c.color); setIcon(c.icon);
    });
  }, [id]);

  async function save() {
    if (!name.trim()) return Alert.alert('Name is required');
    if (editing) await updateCategory(Number(id), { name: name.trim(), color, icon });
    else await createCategory({ name: name.trim(), color, icon });
    router.back();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <View style={{ alignItems: 'center' }}>
        <CategoryIcon icon={icon} color={color} size={72} />
      </View>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Category name"
        placeholderTextColor={theme.colors.textMuted}
        style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md, color: theme.colors.text, fontSize: 16 }}
      />

      <Text style={{ color: theme.colors.textMuted }}>Color</Text>
      <ColorPicker value={color} onChange={setColor} />

      <Text style={{ color: theme.colors.textMuted }}>Icon</Text>
      <IconPicker value={icon} color={color} onChange={setIcon} />

      <Pressable onPress={save} style={{ backgroundColor: theme.colors.primary, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{editing ? 'Save changes' : 'Create category'}</Text>
      </Pressable>
    </ScrollView>
  );
}
```

- [ ] **Step 5: Verify flow**

```powershell
npx expo start --android --clear
```

Navigate to `/category` from the dev menu URL bar (a settings link is added in Task 16). Expected:
1. Seed categories list shows 10 items, each labeled "seed".
2. Tap "+" → enter name "Coffee", change color to amber, pick the `coffee` icon, save → appears at bottom.
3. Long-press the new one → delete → it disappears.
4. Long-press a seed → "Seed categories cannot be deleted".

- [ ] **Step 6: Commit**

```powershell
git add app/category src/components/IconPicker.tsx src/components/ColorPicker.tsx
git commit -m "feat(category): list, create, edit, delete with icon/color picker"
```

---

## Task 15: Charts — Period Bar Chart + Category Pie

**Files:**
- Create: `src/components/charts/PeriodBarChart.tsx`, `src/components/charts/CategoryPieChart.tsx`
- Modify: `app/(tabs)/stats.tsx`

- [ ] **Step 1: Period bar chart**

`src/components/charts/PeriodBarChart.tsx`:

```tsx
import { View, Text } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { theme } from '../../theme';
import { formatAmount } from '../../lib/currency';
import { useSettings } from '../../stores/settings';

export type Bar = { label: string; valueCents: number };

export function PeriodBarChart({ bars, title }: { bars: Bar[]; title: string }) {
  const currency = useSettings(s => s.currency);
  const maxC = Math.max(1, ...bars.map(b => b.valueCents));
  const data = bars.map(b => ({
    value: b.valueCents / 100,
    label: b.label,
    frontColor: theme.colors.primary,
    topLabelComponent: () => b.valueCents > 0
      ? <Text style={{ color: theme.colors.text, fontSize: 10 }}>{formatAmount(b.valueCents, currency)}</Text>
      : null,
  }));

  return (
    <View style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md }}>
      <Text style={{ color: theme.colors.text, fontSize: 16, marginBottom: theme.spacing.sm }}>{title}</Text>
      <BarChart
        data={data}
        barWidth={Math.max(8, 220 / bars.length)}
        spacing={Math.max(4, 80 / bars.length)}
        yAxisTextStyle={{ color: theme.colors.textMuted }}
        xAxisLabelTextStyle={{ color: theme.colors.textMuted, fontSize: 10 }}
        yAxisColor={theme.colors.border}
        xAxisColor={theme.colors.border}
        noOfSections={4}
        maxValue={Math.ceil(maxC / 100 / 10) * 10 || 10}
        isAnimated
      />
    </View>
  );
}
```

- [ ] **Step 2: Category pie chart**

`src/components/charts/CategoryPieChart.tsx`:

```tsx
import { View, Text } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { theme } from '../../theme';
import { formatAmount } from '../../lib/currency';
import { useSettings } from '../../stores/settings';

export type Slice = { categoryId: number; categoryName: string; categoryColor: string; total: number };

export function CategoryPieChart({ slices }: { slices: Slice[] }) {
  const currency = useSettings(s => s.currency);
  const total = slices.reduce((s, x) => s + x.total, 0);
  if (total === 0) {
    return <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: theme.spacing.lg }}>No data in this range.</Text>;
  }
  const data = slices.map(s => ({ value: s.total, color: s.categoryColor, text: '' }));

  return (
    <View style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md }}>
      <Text style={{ color: theme.colors.text, fontSize: 16, marginBottom: theme.spacing.sm }}>By category</Text>
      <View style={{ alignItems: 'center', marginVertical: theme.spacing.md }}>
        <PieChart data={data} donut radius={90} innerRadius={55}
          centerLabelComponent={() => (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Total</Text>
              <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>{formatAmount(total, currency)}</Text>
            </View>
          )}
        />
      </View>
      <View style={{ gap: 6 }}>
        {slices.map(s => (
          <View key={s.categoryId} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: s.categoryColor, marginRight: 8 }} />
            <Text style={{ flex: 1, color: theme.colors.text }}>{s.categoryName}</Text>
            <Text style={{ color: theme.colors.text }}>{formatAmount(s.total, currency)}</Text>
            <Text style={{ color: theme.colors.textMuted, width: 48, textAlign: 'right' }}>
              {Math.round((s.total / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Stats screen**

Replace `app/(tabs)/stats.tsx`:

```tsx
import { useCallback, useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { listExpenses, sumByCategory } from '../../src/repositories/expenses';
import { PeriodBarChart, type Bar } from '../../src/components/charts/PeriodBarChart';
import { CategoryPieChart, type Slice } from '../../src/components/charts/CategoryPieChart';
import { bucketsFor, bucketKeyFor, rangeFor, type Period } from '../../src/lib/dates';
import { formatAmount } from '../../src/lib/currency';
import { useSettings } from '../../src/stores/settings';
import { theme } from '../../src/theme';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Daily' }, { key: 'month', label: 'Monthly' }, { key: 'year', label: 'Yearly' },
];

export default function Stats() {
  const currency = useSettings(s => s.currency);
  const [period, setPeriod] = useState<Period>('month');
  const [bars, setBars] = useState<Bar[]>([]);
  const [slices, setSlices] = useState<Slice[]>([]);
  const [total, setTotal] = useState(0);

  useFocusEffect(useCallback(() => {
    (async () => {
      const { start, end } = rangeFor(period);
      const buckets = bucketsFor(period);
      const expenses = await listExpenses({ start, end });
      const totals = new Map<string, number>();
      for (const e of expenses) {
        const key = bucketKeyFor(period, new Date(e.occurredAt));
        totals.set(key, (totals.get(key) ?? 0) + e.amountCents);
      }
      setBars(buckets.map(b => ({ label: b.label, valueCents: totals.get(b.key) ?? 0 })));
      setTotal(expenses.reduce((s, e) => s + e.amountCents, 0));
      const cats = await sumByCategory(start, end);
      setSlices(cats.filter(c => c.total > 0).sort((a, b) => b.total - a.total).map(c => ({
        categoryId: c.categoryId, categoryName: c.categoryName, categoryColor: c.categoryColor, total: Number(c.total),
      })));
    })();
  }, [period]));

  const avg = bars.length ? total / bars.length : 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {PERIODS.map(p => (
          <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={{
            flex: 1, padding: theme.spacing.sm, borderRadius: theme.radius.pill, alignItems: 'center',
            backgroundColor: period === p.key ? theme.colors.primary : theme.colors.surface,
          }}>
            <Text style={{ color: '#fff' }}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1, padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Total</Text>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '600' }}>{formatAmount(total, currency)}</Text>
        </View>
        <View style={{ flex: 1, padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Avg / {period}</Text>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '600' }}>{formatAmount(Math.round(avg), currency)}</Text>
        </View>
      </View>

      <PeriodBarChart bars={bars} title={period === 'day' ? 'Last 7 days' : period === 'month' ? 'Last 12 months' : 'Last 5 years'} />
      <CategoryPieChart slices={slices} />
    </ScrollView>
  );
}
```

- [ ] **Step 4: Verify the charts**

```powershell
npx expo start --android --clear
```

Add ~5 expenses across different dates and categories (mix today + a few backdated). Switch through Daily / Monthly / Yearly. Expected:
- Bar heights match the totals you entered.
- Switching tabs re-fetches (use `useFocusEffect`).
- Pie chart sums to "Total" and percentages add to ~100%.
- Empty range shows the "No data in this range." message.

- [ ] **Step 5: Commit**

```powershell
git add src/components/charts app/(tabs)/stats.tsx
git commit -m "feat(stats): daily/monthly/yearly bars + category pie"
```

---

## Task 16: Settings (Currency + Manage Categories Link)

**Files:**
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Replace the placeholder**

```tsx
import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSettings } from '../../src/stores/settings';
import type { CurrencySymbol } from '../../src/lib/currency';
import { theme } from '../../src/theme';

const SYMBOLS: CurrencySymbol[] = ['€', '$', '£', 'лв'];

export default function Settings() {
  const { currency, setCurrency } = useSettings();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <View>
        <Text style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>Currency</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {SYMBOLS.map(s => (
            <Pressable key={s} onPress={() => setCurrency(s)} style={{
              flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center',
              backgroundColor: currency === s ? theme.colors.primary : theme.colors.surface,
            }}>
              <Text style={{ color: '#fff', fontSize: 18 }}>{s}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Link href="/category" asChild>
        <Pressable style={{
          flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
          padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
        }}>
          <MaterialCommunityIcons name="shape" size={24} color={theme.colors.text} />
          <Text style={{ flex: 1, color: theme.colors.text, fontSize: 16 }}>Manage categories</Text>
          <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.textMuted} />
        </Pressable>
      </Link>
    </View>
  );
}
```

- [ ] **Step 2: Verify**

```powershell
npx expo start --android --clear
```

Expected: Settings tab shows four currency buttons (€ active by default) and a "Manage categories" row. Tap a currency — Home and Stats totals re-render with the new symbol. Tap "Manage categories" → category list screen.

- [ ] **Step 3: Commit**

```powershell
git add app/(tabs)/settings.tsx
git commit -m "feat(settings): currency picker and category management link"
```

---

## Task 17: Polish + Build a Signed Release APK Locally

> **Why local build, not EAS / not hosted:** This app is for personal use, fully offline, no backend. Building locally means no cloud account, no upload, no service that can deprecate or paywall you. The APK is yours forever — install on as many of your devices as you like.

**Prerequisites:**
- Java JDK 17 installed (`java -version` should print 17.x). If missing: install Microsoft OpenJDK 17 from https://learn.microsoft.com/en-us/java/openjdk/download — pick the Windows `.msi` for x64.
- Android SDK already installed via Android Studio (done in the Tooling section).

**Files:**
- Generate: `android/` (entire native project, via `expo prebuild`)
- Create: `android/keystores/expense-tracker.keystore`, `android/gradle.properties` additions
- Modify: `android/app/build.gradle` (signing config)
- Add to `.gitignore`: `android/keystores/`, `android/gradle.properties` secrets

- [ ] **Step 1: Sanity check the full app**

```powershell
npx expo start --android --clear
```

Walk through the whole flow on the emulator:
1. Fresh install (uninstall from emulator first if needed) → seed runs → 10 categories visible under Settings → Manage categories.
2. Add 3 expenses: one today, one backdated 2 weeks, one a year ago.
3. Home shows this-month total correctly.
4. Stats Daily → only entries within the last 7 days show. Monthly → last 12 months. Yearly → all 3 visible.
5. Switch currency to `$` → all amounts re-render with new symbol.
6. Create a new category "Coffee" with the coffee icon and amber color → it appears in the picker on the add-expense modal.
7. Edit an expense → change amount → totals update.
8. Delete it → it disappears.

If anything fails, file it as a Task 17.x sub-fix before moving on.

- [ ] **Step 2: Type-check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Generate the native Android project**

```powershell
npx expo prebuild --platform android --clean
```

Expected: an `android/` directory appears at the repo root with a full Gradle project. This is a one-time conversion from the managed workflow's metadata to a real Android project — from now on, builds happen here.

- [ ] **Step 4: Generate a personal keystore (one-time)**

The keystore signs your APK. Android requires every APK to be signed. For personal use a self-signed key is fine — just don't lose it (you'd need the same key to install updates over the existing app).

```powershell
mkdir android\keystores
keytool -genkeypair -v `
  -keystore android\keystores\expense-tracker.keystore `
  -alias expense-tracker `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -storepass changeme -keypass changeme `
  -dname "CN=Expense Tracker, OU=Personal, O=Personal, L=Sofia, S=Sofia, C=BG"
```

Replace `changeme` with a real password (any string — write it down, you'll need it for future updates). The `dname` fields are cosmetic for a personal build.

Expected: `android/keystores/expense-tracker.keystore` exists (~2 KB binary file).

- [ ] **Step 5: Wire the keystore into Gradle**

Append to `android/gradle.properties`:

```properties
EXPENSE_UPLOAD_STORE_FILE=keystores/expense-tracker.keystore
EXPENSE_UPLOAD_KEY_ALIAS=expense-tracker
EXPENSE_UPLOAD_STORE_PASSWORD=changeme
EXPENSE_UPLOAD_KEY_PASSWORD=changeme
```

(Replace `changeme` with whatever you used in Step 4.)

In `android/app/build.gradle`, find the existing `signingConfigs { release { ... } }` block (it was generated with placeholder values pointing to a debug key). Replace it with:

```groovy
signingConfigs {
    release {
        if (project.hasProperty('EXPENSE_UPLOAD_STORE_FILE')) {
            storeFile file(EXPENSE_UPLOAD_STORE_FILE)
            storePassword EXPENSE_UPLOAD_STORE_PASSWORD
            keyAlias EXPENSE_UPLOAD_KEY_ALIAS
            keyPassword EXPENSE_UPLOAD_KEY_PASSWORD
        }
    }
}
```

In the same file, find `buildTypes { release { ... } }` and confirm it contains `signingConfig signingConfigs.release` (Expo's prebuild template already sets this).

- [ ] **Step 6: Protect secrets from git**

Append to `.gitignore` at the repo root:

```
# Native android (regenerable via `expo prebuild`)
/android

# Local-only signing material — never commit
/android/keystores/
/android/gradle.properties
```

The whole `android/` folder is fine to gitignore because `expo prebuild` regenerates it deterministically from `app.json`. **Back up `expense-tracker.keystore` separately** (e.g., copy to a USB stick or password manager attachment) — losing it means you can't ship updates that replace the installed app.

- [ ] **Step 7: Build the release APK**

```powershell
cd android
.\gradlew.bat assembleRelease
cd ..
```

First build takes 5–15 minutes (Gradle downloads dependencies). Subsequent builds are ~30s.

Expected output: `android/app/build/outputs/apk/release/app-release.apk` (~30–50 MB).

- [ ] **Step 8: Install on your phone**

**Option A — over USB (recommended):**
1. Enable Developer Options on the phone (Settings → About → tap "Build number" 7 times).
2. In Developer Options, enable USB debugging.
3. Plug phone into PC, accept the trust prompt.
4. Run:

```powershell
adb install -r android\app\build\outputs\apk\release\app-release.apk
```

Expected: `Success` printed. Open the "Expense Tracker" app icon on your phone.

**Option B — over the air:**
Copy the APK to your phone (USB transfer, Google Drive, etc.), tap it in the file manager, allow "Install unknown apps" for that file manager once, install.

- [ ] **Step 9: Verify the installed app works fully offline**

On the phone:
1. Turn on airplane mode.
2. Launch the app — seed runs, you see the 10 categories under Settings → Manage categories.
3. Add an expense, view stats, switch currency.
4. Force-close the app and reopen — data persists.

Expected: every feature works with no internet. This is the proof that nothing leaves your phone.

- [ ] **Step 10: Commit**

```powershell
git add .gitignore
git commit -m "chore: ignore native android and local signing material"
```

(No build artifacts or keystores are committed — they're in `.gitignore`.)

---

## Updating the App Later

When you want to add a feature (e.g., from the "nice-to-haves" list):

1. Code the change with `npx expo start --android` against the emulator.
2. Re-run Steps 3, 7, 8 above. Step 3 (`expo prebuild --clean`) is only needed if you changed `app.json`, native deps, or icons; otherwise just rebuild from inside `android/`.
3. `adb install -r ...` replaces the installed app while keeping your SQLite data intact (Android preserves app data across reinstalls signed with the same key).

This is why the keystore matters: same key → updates merge, data preserved. Different key → Android refuses the install and you'd have to uninstall (losing data) first.

---

## Self-Review

Walked the plan against the user's brief:

| Requirement | Covered by |
|---|---|
| React Native app | Task 1 (Expo scaffold) |
| Track expenses only (no income) | Schema (Task 4) has no income table |
| Daily / Monthly / Yearly views | Task 15 (PeriodBarChart + tab switcher) |
| Default currency EUR | Task 7 (`useSettings` default), Task 16 picker |
| Categories | Task 4 schema, Task 14 management |
| Graph from expenses | Task 15 bar + pie |
| Create expenses any time, backward date | Task 9 `DateField` with `maximumDate={today}`, Task 11 form |
| User-created categories | Task 14 |
| Pick from different icons | Task 14 IconPicker + Task 9 curated list |
| Predefined categories | Task 6 seeder |
| Fully functional Android | Task 17 local Gradle release APK, AVD setup in tooling section |
| Entirely free, no hosting | Task 17 builds locally with open-source tooling; runtime is fully offline (SQLite only) |
| Brainstorm functionalities | "Brainstormed Functionality" section at top, MVP vs. nice-to-haves |
| Suggest emulator tooling | "Tooling to Emulate" section |

No placeholders found. Type names consistent (`Period`, `ExpenseWithCategory`, `Bar`, `Slice` used the same way across tasks). `formatAmount`, `parseAmountToCents`, `bucketKeyFor`, `rangeFor`, `bucketsFor` all defined in Task 7 before first use in Task 11+.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-17-expense-tracker.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
