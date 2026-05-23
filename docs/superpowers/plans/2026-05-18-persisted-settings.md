# Persisted Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist user settings (currency, last-used category) in a SQLite `app_settings` table, hydrate on app boot, and write-through on change — so settings survive cold start. This is Phase 2 feature #1 from `docs/superpowers/brainstorms/2026-05-17-v2-features.md` and is the foundation for later Phase 2 features.

**Architecture:** Generic key-value table `app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)` — stringly-typed at the storage layer, parsed/serialized by the Zustand store. The store gains a `hydrate()` action that reads all rows once at app boot; mutators write through to the DB. Root layout gates render on a `loaded` flag (mirrors the existing migrations + seed gate).

**Tech Stack:** Drizzle ORM (expo-sqlite driver), drizzle-kit for migrations, Zustand, expo-router.

**Scope decisions (locked in for this plan):**
- Settings persisted in this iteration: `currency` (existing) and `lastUsedCategoryId` (new — sets initial category on NewExpense form).
- `theme` and `locale` are deferred — they are Phase 3 follow-ups per the brainstorm. The K-V table this plan introduces will absorb them later with zero schema change.
- No test framework exists in this project (no Jest/Vitest). Each task uses **manual verification on the running dev device** instead of automated tests. Steps document the exact reproduction.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `src/db/schema.ts` | Modify | Add `appSettings` table definition. |
| `drizzle/0001_*.sql` | Create (via `drizzle-kit generate`) | SQL migration for new table. |
| `drizzle/meta/0001_snapshot.json` | Create (via `drizzle-kit generate`) | Drizzle internal snapshot. |
| `drizzle/meta/_journal.json` | Modify (via `drizzle-kit generate`) | Migration manifest. |
| `drizzle/migrations.js` | Modify (via `drizzle-kit generate`) | Bundled migrations import. |
| `src/repositories/settings.ts` | Create | K-V get/set helpers on `app_settings`. |
| `src/stores/settings.ts` | Modify | Hydration action + write-through mutators; add `lastUsedCategoryId` + `loaded` flag. |
| `app/_layout.tsx` | Modify | Gate render on `settings.loaded`. |
| `app/expense/new.tsx` | Modify | Initialize `category` state from `lastUsedCategoryId`; persist on save. |

---

### Task 1: Add `app_settings` table to schema and generate migration

**Files:**
- Modify: `src/db/schema.ts` (append to end)
- Create: `drizzle/0001_*.sql` (via drizzle-kit)
- Modify: `drizzle/migrations.js`, `drizzle/meta/_journal.json`, `drizzle/meta/0001_snapshot.json`

- [ ] **Step 1: Add the table to the schema**

In `src/db/schema.ts`, append after the existing `expenses` table block (after line 19, before the `Category` type exports):

```ts
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
```

And at the end of the file, append matching type exports next to the existing ones:

```ts
export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
```

- [ ] **Step 2: Generate the migration**

Run from project root:

```powershell
npx drizzle-kit generate
```

Expected output: a new file `drizzle/0001_<random-name>.sql` containing:

```sql
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
```

Also: `drizzle/meta/_journal.json` and `drizzle/migrations.js` should be updated to include the new migration. Open `drizzle/migrations.js` and confirm there are now two imports (the original `0000_needy_thing.sql` plus the new file).

- [ ] **Step 3: Verify migration runs on device**

Force-stop and relaunch the app on the device so the migration runs:

```powershell
adb shell am force-stop com.expensetracker.app
adb shell am start -W -a android.intent.action.VIEW -d "expensetracker://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" com.expensetracker.app
```

Expected: app loads past the "Loading…" screen normally (no migration error). Confirm with:

```powershell
adb logcat -d -t 200 *:E | findstr -i "migration\|sqlite"
```

Expected: no migration errors. If you see "table app_settings already exists" or similar, run `adb uninstall com.expensetracker.app` and rebuild — your dev DB is stale from a previous schema attempt.

- [ ] **Step 4: Commit**

```powershell
git add src/db/schema.ts drizzle/
git commit -m "feat(db): add app_settings key-value table"
```

---

### Task 2: Create the settings repository

**Files:**
- Create: `src/repositories/settings.ts`

- [ ] **Step 1: Write the repository**

Create `src/repositories/settings.ts` with:

```ts
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { appSettings } from '../db/schema';

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(appSettings);
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value } });
}
```

- [ ] **Step 2: Manual smoke check via the dev menu**

There's no test runner. Verify by editing `app/_layout.tsx` temporarily to log on startup. Add after the existing imports:

```ts
import { setSetting, getAllSettings } from '../src/repositories/settings';
```

And inside `RootLayout`, right after `if (success) seedIfEmpty().then(() => setSeeded(true));`, temporarily add:

```ts
useEffect(() => {
  if (!seeded) return;
  (async () => {
    await setSetting('smoke', 'ok-' + Date.now());
    console.log('[settings smoke]', await getAllSettings());
  })();
}, [seeded]);
```

Save (Metro hot-reloads). Watch the Metro task output:

```powershell
# replace <taskid> with the active background Metro task id
Get-Content "$env:LOCALAPPDATA\Temp\claude\D--code-android-app\*\tasks\<taskid>.output" -Tail 20
```

Expected: a line like `LOG  [settings smoke] { smoke: 'ok-1715...' }`.

- [ ] **Step 3: Revert the smoke check**

Remove the temporary `useEffect` and the temporary `import` you added in Step 2. The file should match its pre-Step-2 state.

- [ ] **Step 4: Commit**

```powershell
git add src/repositories/settings.ts
git commit -m "feat(repo): add settings key-value repository"
```

---

### Task 3: Refactor `useSettings` store for hydration + write-through

**Files:**
- Modify: `src/stores/settings.ts`

- [ ] **Step 1: Rewrite the store**

Replace the entire contents of `src/stores/settings.ts` with:

```ts
import { create } from 'zustand';
import type { CurrencySymbol } from '../lib/currency';
import { getAllSettings, setSetting } from '../repositories/settings';

const CURRENCIES: readonly CurrencySymbol[] = ['€', '$', '£', 'лв'] as const;
function parseCurrency(raw: string | undefined): CurrencySymbol {
  return (CURRENCIES as readonly string[]).includes(raw ?? '') ? (raw as CurrencySymbol) : '€';
}

function parseCategoryId(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type State = {
  loaded: boolean;
  currency: CurrencySymbol;
  lastUsedCategoryId: number | null;
  hydrate: () => Promise<void>;
  setCurrency: (c: CurrencySymbol) => Promise<void>;
  setLastUsedCategoryId: (id: number) => Promise<void>;
};

export const useSettings = create<State>((set) => ({
  loaded: false,
  currency: '€',
  lastUsedCategoryId: null,
  hydrate: async () => {
    const all = await getAllSettings();
    set({
      currency: parseCurrency(all.currency),
      lastUsedCategoryId: parseCategoryId(all.lastUsedCategoryId),
      loaded: true,
    });
  },
  setCurrency: async (c) => {
    set({ currency: c });
    await setSetting('currency', c);
  },
  setLastUsedCategoryId: async (id) => {
    set({ lastUsedCategoryId: id });
    await setSetting('lastUsedCategoryId', String(id));
  },
}));
```

Why this shape:
- `loaded` starts false; nothing else changes (currency defaults to `€` so existing UI doesn't crash before hydration).
- `hydrate` reads once, parses strings into typed values, flips `loaded` true.
- Mutators are async and write-through. Callers (settings screen, new-expense screen) `await` or fire-and-forget — both are safe; the in-memory state is already updated synchronously before the DB write.
- `parseCurrency` defensively falls back to `€` if the stored value is corrupt (e.g. a future version stored a code we don't recognize). Defensive parsing belongs in the store, not the repository, since the repository is generic.

- [ ] **Step 2: Run the type check**

The settings tab consumes `setCurrency` as a sync function and ignores the return value. TypeScript will now flag the call site only if it relies on the return type — it doesn't. Verify by running:

```powershell
npx tsc --noEmit
```

Expected: no errors. If `app/(tabs)/settings.tsx` errors on `setCurrency`, it's because the call uses `await` in a non-async function — unlikely given the current code, but if so, the fix is to drop the `await` (fire-and-forget is fine; the in-memory update is synchronous).

- [ ] **Step 3: Commit**

```powershell
git add src/stores/settings.ts
git commit -m "refactor(settings): make store hydration-aware with DB write-through"
```

---

### Task 4: Gate root layout on settings hydration

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add the hydration gate**

Replace the entire contents of `app/_layout.tsx` with:

```tsx
import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useRunMigrations } from '../src/db/migrate';
import { seedIfEmpty } from '../src/db/seed';
import { useSettings } from '../src/stores/settings';

export default function RootLayout() {
  const { success, error } = useRunMigrations();
  const [seeded, setSeeded] = useState(false);
  const settingsLoaded = useSettings(s => s.loaded);
  const hydrate = useSettings(s => s.hydrate);

  useEffect(() => {
    if (success) seedIfEmpty().then(() => setSeeded(true));
  }, [success]);

  useEffect(() => {
    if (seeded) hydrate();
  }, [seeded, hydrate]);

  if (error) return <View><Text>Migration error: {error.message}</Text></View>;
  if (!success || !seeded || !settingsLoaded) return <View><Text>Loading…</Text></View>;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="expense/new" options={{ presentation: 'modal', headerShown: true, title: 'New expense' }} />
      <Stack.Screen name="expense/[id]" options={{ presentation: 'modal', headerShown: true, title: 'Edit expense' }} />
      <Stack.Screen name="category/index" options={{ headerShown: true, title: 'Categories' }} />
      <Stack.Screen name="category/edit"  options={{ presentation: 'modal', headerShown: true, title: 'Edit category' }} />
    </Stack>
  );
}
```

Order matters: hydrate only runs **after** seed completes, so the DB is guaranteed-ready when the K-V repository reads.

- [ ] **Step 2: Manually verify the gate works**

Hot-reload should pick this up automatically. On the phone:
1. Open the app — should briefly show "Loading…" then land on the home tab. Cold-start scenario: force-stop then relaunch.
2. Go to Settings tab → tap `$` currency.
3. Confirm the `$` chip becomes the selected (green) one.
4. Force-stop and relaunch the app:
   ```powershell
   adb shell am force-stop com.expensetracker.app
   adb shell am start -W -a android.intent.action.VIEW -d "expensetracker://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" com.expensetracker.app
   ```
5. Go to Settings tab — currency should still be `$`. (Before this task, it always reset to `€`.)

If currency resets to `€` after relaunch, hydration is not reading the value the mutator wrote — open `src/stores/settings.ts` and confirm `setCurrency` calls `setSetting('currency', c)` with the exact same key (`'currency'`) that `parseCurrency` reads from `all.currency`.

- [ ] **Step 3: Commit**

```powershell
git add app/_layout.tsx
git commit -m "feat(boot): hydrate persisted settings before render"
```

---

### Task 5: Wire `lastUsedCategoryId` into the New Expense form

**Files:**
- Modify: `app/expense/new.tsx`

- [ ] **Step 1: Initialize category from the stored setting and persist on save**

Replace the entire contents of `app/expense/new.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { eq } from 'drizzle-orm';
import { AmountInput } from '../../src/components/AmountInput';
import { DateField } from '../../src/components/DateField';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { CategoryPickerSheet } from '../../src/components/CategoryPickerSheet';
import { parseAmountToCents } from '../../src/lib/currency';
import { createExpense } from '../../src/repositories/expenses';
import { db } from '../../src/db/client';
import { categories as categoriesTable, type Category } from '../../src/db/schema';
import { useSettings } from '../../src/stores/settings';
import { theme } from '../../src/theme';

export default function NewExpense() {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);

  const lastUsedCategoryId = useSettings(s => s.lastUsedCategoryId);
  const setLastUsedCategoryId = useSettings(s => s.setLastUsedCategoryId);

  useEffect(() => {
    if (!lastUsedCategoryId || category) return;
    (async () => {
      const rows = await db.select().from(categoriesTable).where(eq(categoriesTable.id, lastUsedCategoryId)).limit(1);
      if (rows[0]) setCategory(rows[0]);
    })();
  }, [lastUsedCategoryId, category]);

  async function save() {
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) return Alert.alert('Invalid amount');
    if (!category) return Alert.alert('Pick a category');
    await createExpense({ amountCents: cents, categoryId: category.id, note: note || null, occurredAt: date });
    setLastUsedCategoryId(category.id);
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

Why the `useEffect` guards on `!category`: the user might tap "Choose category" and pick something else *before* the lookup resolves. We don't want a late DB resolve to clobber their pick. The guard ensures we only auto-set when the user hasn't already chosen.

Why we look up the full row instead of just storing `categoryId`: the rest of the form's UI (icon, color, name) needs the full `Category` object — the picker sheet returns it too, so storing `Category | null` keeps both code paths uniform.

- [ ] **Step 2: Manually verify**

Hot-reload picks this up. On the phone:
1. From the home tab, tap the FAB → "New expense". On first run after this task, `category` is `null` (no `lastUsedCategoryId` yet) — the "Choose category" placeholder shows. Pick e.g. "Groceries", set amount `1.00`, save.
2. Tap the FAB again. Now "Groceries" should be pre-selected with its icon visible.
3. Force-stop + relaunch the app (commands from Task 4 Step 2). Open New Expense again — "Groceries" should still pre-select. (Proves it's persisted, not just in memory.)
4. Pick a different category (e.g. "Transport"), save another expense. Reopen — "Transport" pre-selects.

If category does not pre-select on cold start, check:
- `adb logcat -d -t 200 *:E | findstr -i sqlite` for query errors.
- Verify `useSettings(s => s.lastUsedCategoryId)` returns a number after relaunch (add a temporary `console.log` in the component if needed; remove before commit).

- [ ] **Step 3: Commit**

```powershell
git add app/expense/new.tsx
git commit -m "feat(expense): pre-fill last-used category on new expense"
```

---

## Self-Review

**Spec coverage (brainstorm §1 Persisted Settings):**
- "Currency, theme, locale, default category survive app restart." → covered: currency + lastUsedCategoryId. Theme + locale explicitly deferred and noted at top of plan.
- "One small table or AsyncStorage namespace" → SQLite K-V table (per brainstorm Q7 recommendation).
- "Hydrate on app boot" → Task 4 gate.
- "Tiny useSettings Zustand store with a write-through to disk" → Task 3.
- "Race condition mitigation: gate root layout on a settingsLoaded flag, show splash until true" → Task 4.

**Placeholder scan:** no TBDs, no "implement later", every code step has full source. ✓

**Type consistency:**
- `setSetting(key, value)` signature: `(string, string) => Promise<void>` — used identically in Task 2 (definition), Task 3 (`setSetting('currency', c)`, `setSetting('lastUsedCategoryId', String(id))`). ✓
- `getAllSettings()` returns `Record<string, string>` — consumed in Task 3's `hydrate`. ✓
- `useSettings` state: `loaded`, `currency`, `lastUsedCategoryId`, `hydrate`, `setCurrency`, `setLastUsedCategoryId` — Task 4 reads `loaded` and `hydrate`; Task 5 reads `lastUsedCategoryId` and `setLastUsedCategoryId`; existing `app/(tabs)/settings.tsx` reads `currency` and `setCurrency` (no edit needed there because the public read/write shape didn't change, only the implementation). ✓
- `Category` type imported from `src/db/schema` in Task 5 — matches the existing import in pre-edit `app/expense/new.tsx`. ✓

**Known follow-ups (out of scope for this plan):**
- Persist `theme` (light/dark/system) — adds two new keys; trivial against this K-V infrastructure.
- Persist `locale` for number formatting — same shape.
- Migrate `app/(tabs)/settings.tsx` to use `async setCurrency` properly if we want toast/error UX on write failure. Currently it's fire-and-forget, which is fine for v1 of this feature.
