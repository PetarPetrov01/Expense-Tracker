# Inline Category Grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single "Choose category" row on the expense add/edit screens with an inline 4×2 grid (7 most-used categories + a "More" tile) backed by a recency-weighted query and a small display-promotion helper.

**Architecture:** One new repository query that ranks categories by 90-day usage via a LEFT JOIN (so zero-usage categories fill remaining slots). One pure helper that promotes an off-grid selection to position 0 for display only. One presentational grid component. The existing `CategoryPickerSheet` gets a "Manage" link to `/category`. The expense add and edit screens swap their single-row category control for the new grid; everything else on those screens is untouched.

**Tech Stack:** Expo SDK 54, React Native 0.81, expo-router, TypeScript, drizzle-orm + expo-sqlite, zustand. No test runner is configured in this project; verification is via `npx tsc --noEmit`, `npx expo lint`, and manual app checks.

**Spec:** `docs/superpowers/specs/2026-05-25-inline-category-grid-design.md`

---

## File Map

**Create:**
- `src/components/CategoryQuickGrid.tsx` — presentational 4×2 grid (7 categories + More tile).
- `src/lib/categoryGrid.ts` — pure `promoteSelectedToGrid` helper used by both the new and edit screens.

**Modify:**
- `src/repositories/categories.ts` — add `listTopCategoriesByUsage`.
- `src/components/CategoryPickerSheet.tsx` — header row with title + "Manage" link that navigates to `/category`.
- `app/expense/new.tsx` — swap category row for `CategoryQuickGrid`, wire promotion + More.
- `app/expense/[id].tsx` — same change as `new.tsx`.

**Untouched:** schema, `src/repositories/expenses.ts`, `src/components/CategoryIcon.tsx`, `src/components/AmountInput.tsx`, `src/components/DateField.tsx`, theme, settings store, FX store.

---

## Verification Conventions

- "Type-check passes" means `npx tsc --noEmit` exits 0.
- "Lint passes" means `npx expo lint` reports no new errors.
- "Manual: <thing>" means start the Expo dev server (`npx expo start --clear`) and observe the described behavior on a device or emulator. After the engineer has the app running once, subsequent tasks can rely on Fast Refresh — no need to restart unless a native dep changed.

---

### Task 1: Add `listTopCategoriesByUsage` to the categories repository

**Files:**
- Modify: `src/repositories/categories.ts`

- [ ] **Step 1: Add the new function**

The query LEFT-JOINs `expenses` to `categories` with the date cutoff in the ON clause (not WHERE) so that categories with zero recent expenses still come through with `count = 0` and `max(occurredAt) = NULL`, letting alphabetical name fill remaining slots.

Replace the entire file with:

```ts
import { db, schema } from '../db/client';
import { and, asc, eq, gte, sql } from 'drizzle-orm';
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

// Top categories ranked by usage in the last `sinceDays` days.
// Ordering: count desc, then most-recent occurredAt desc, then alphabetical name.
// Categories with no recent expenses appear at the tail (count = 0, max = NULL).
export async function listTopCategoriesByUsage(opts: {
  sinceDays: number;
  limit: number;
}): Promise<Category[]> {
  const cutoff = new Date(Date.now() - opts.sinceDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      id:        schema.categories.id,
      name:      schema.categories.name,
      icon:      schema.categories.icon,
      color:     schema.categories.color,
      isSeed:    schema.categories.isSeed,
      stableId:  schema.categories.stableId,
      createdAt: schema.categories.createdAt,
    })
    .from(schema.categories)
    .leftJoin(
      schema.expenses,
      and(
        eq(schema.expenses.categoryId, schema.categories.id),
        gte(schema.expenses.occurredAt, cutoff),
      ),
    )
    .groupBy(schema.categories.id)
    .orderBy(
      sql`COUNT(${schema.expenses.id}) DESC`,
      sql`MAX(${schema.expenses.occurredAt}) DESC`,
      asc(schema.categories.name),
    )
    .limit(opts.limit);
  return rows;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/repositories/categories.ts
git commit -m "feat(categories): add listTopCategoriesByUsage"
```

---

### Task 2: Add the `promoteSelectedToGrid` helper

**Files:**
- Create: `src/lib/categoryGrid.ts`

- [ ] **Step 1: Create the file**

This is a pure, side-effect-free helper. It is identical for the new and edit screens, so it lives in `src/lib`. The selected category is prepended to position 0 only when it is not already in `top`; the last element is dropped so the array length never grows.

```ts
import type { Category } from '../db/schema';

/**
 * Promotes the selected category to position 0 of the grid for display only,
 * when it isn't already in `top`. Drops the last element so the array length
 * is preserved. Does NOT mutate inputs.
 */
export function promoteSelectedToGrid(
  top: Category[],
  selected: Category | null,
): Category[] {
  if (!selected) return top;
  if (top.some(c => c.id === selected.id)) return top;
  return [selected, ...top.slice(0, Math.max(0, top.length - 1))];
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/categoryGrid.ts
git commit -m "feat(categories): add promoteSelectedToGrid helper"
```

---

### Task 3: Create the `CategoryQuickGrid` component

**Files:**
- Create: `src/components/CategoryQuickGrid.tsx`

- [ ] **Step 1: Write the component**

Presentational only. Renders up to 7 category tiles in a 4-column flex-wrap layout plus a fixed "More" tile in slot 8. Selected tile gets a 1.5px primary-colored border and a `surface` background; unselected tiles are transparent. The More tile uses `dots-horizontal` from `MaterialCommunityIcons`.

```tsx
import { View, Text, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CategoryIcon } from './CategoryIcon';
import type { Category } from '../db/schema';
import { theme } from '../theme';

export function CategoryQuickGrid({
  categories,
  selectedId,
  onSelect,
  onMore,
}: {
  categories: Category[];
  selectedId: number | null;
  onSelect: (c: Category) => void;
  onMore: () => void;
}) {
  const visible = categories.slice(0, 7);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {visible.map((c) => {
        const selected = c.id === selectedId;
        return (
          <View key={c.id} style={{ width: '25%', padding: theme.spacing.xs }}>
            <Pressable onPress={() => onSelect(c)} style={tileStyle(selected)}>
              <CategoryIcon icon={c.icon} color={c.color} size={40} />
              <Text style={tileLabel} numberOfLines={1}>{c.name}</Text>
            </Pressable>
          </View>
        );
      })}

      <View key="__more" style={{ width: '25%', padding: theme.spacing.xs }}>
        <Pressable onPress={onMore} style={tileStyle(false)}>
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: theme.colors.surface2,
            justifyContent: 'center', alignItems: 'center',
          }}>
            <MaterialCommunityIcons name="dots-horizontal" size={22} color={theme.colors.text} />
          </View>
          <Text style={tileLabel} numberOfLines={1}>More</Text>
        </Pressable>
      </View>
    </View>
  );
}

function tileStyle(selected: boolean) {
  return {
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: selected ? theme.colors.primary : 'transparent',
    backgroundColor: selected ? theme.colors.surface : 'transparent',
  };
}

const tileLabel = {
  color: theme.colors.text,
  marginTop: 4,
  fontSize: 12,
  textAlign: 'center' as const,
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/CategoryQuickGrid.tsx
git commit -m "feat(ui): add CategoryQuickGrid component"
```

---

### Task 4: Add "Manage" link to `CategoryPickerSheet`

**Files:**
- Modify: `src/components/CategoryPickerSheet.tsx`

- [ ] **Step 1: Replace the title-only header with a row that includes a "Manage" link**

Tapping "Manage" closes the sheet first (so the form state isn't left in an inconsistent picker-open state), then navigates to `/category` via `expo-router`. Replace the file contents with:

```tsx
import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, FlatList } from 'react-native';
import { router } from 'expo-router';
import { listCategories } from '../repositories/categories';
import type { Category } from '../db/schema';
import { CategoryIcon } from './CategoryIcon';
import { theme } from '../theme';

export function CategoryPickerSheet({ visible, onClose, onSelect }: {
  visible: boolean; onClose: () => void; onSelect: (c: Category) => void;
}) {
  const [items, setItems] = useState<Category[]>([]);
  useEffect(() => { if (visible) listCategories().then(setItems); }, [visible]);

  function openManage() {
    onClose();
    router.push('/category');
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      <View style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.lg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
          <Text style={{ color: theme.colors.text, fontSize: 18 }}>Choose category</Text>
          <Pressable onPress={openManage} hitSlop={8}>
            <Text style={{ color: theme.colors.primary, fontSize: 14 }}>Manage</Text>
          </Pressable>
        </View>
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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/CategoryPickerSheet.tsx
git commit -m "feat(ui): add Manage link to CategoryPickerSheet"
```

---

### Task 5: Wire `CategoryQuickGrid` into the new-expense screen

**Files:**
- Modify: `app/expense/new.tsx`

- [ ] **Step 1: Replace the category pressable with the grid**

The existing flow stays the same — `lastUsedCategoryId` still pre-selects, the sheet is still opened on "More", and `onSelect` still sets `category`. The grid receives a display-promoted list so the selected category is always visible and highlighted. Replace the file contents with:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, Pressable } from 'react-native';
import { router } from 'expo-router';
import { AmountInput } from '../../src/components/AmountInput';
import { DateField } from '../../src/components/DateField';
import { CategoryQuickGrid } from '../../src/components/CategoryQuickGrid';
import { CategoryPickerSheet } from '../../src/components/CategoryPickerSheet';
import { parseAmountToCents } from '../../src/lib/currency';
import { createExpense } from '../../src/repositories/expenses';
import { getCategory, listTopCategoriesByUsage } from '../../src/repositories/categories';
import { promoteSelectedToGrid } from '../../src/lib/categoryGrid';
import type { Category } from '../../src/db/schema';
import { useSettings } from '../../src/stores/settings';
import { useFxRates } from '../../src/stores/fxRates';
import { deriveRateToBaseX1e6 } from '../../src/lib/fx';
import type { CurrencyCode } from '../../src/lib/currency';
import { theme } from '../../src/theme';

export default function NewExpense() {
  const displayCurrency = useSettings(s => s.displayCurrency);
  const [amount, setAmount] = useState('');
  const [entryCurrency, setEntryCurrency] = useState<CurrencyCode>(displayCurrency);
  const [category, setCategory] = useState<Category | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [topCategories, setTopCategories] = useState<Category[]>([]);

  const lastUsedCategoryId = useSettings(s => s.lastUsedCategoryId);
  const setLastUsedCategoryId = useSettings(s => s.setLastUsedCategoryId);
  const rates = useFxRates(s => s.rates);

  useEffect(() => {
    listTopCategoriesByUsage({ sinceDays: 90, limit: 7 }).then(setTopCategories);
  }, []);

  useEffect(() => {
    if (!lastUsedCategoryId || category) return;
    (async () => {
      const row = await getCategory(lastUsedCategoryId);
      if (row) setCategory(row);
    })();
  }, [lastUsedCategoryId, category]);

  const gridCategories = useMemo(
    () => promoteSelectedToGrid(topCategories, category),
    [topCategories, category],
  );

  async function save() {
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) return Alert.alert('Invalid amount');
    if (!category) return Alert.alert('Pick a category');
    const rateToBaseX1e6 = deriveRateToBaseX1e6(rates, entryCurrency);
    await createExpense({
      amountCents: cents,
      currency: entryCurrency,
      rateToBaseX1e6,
      categoryId: category.id,
      note: note || null,
      occurredAt: date,
    });
    setLastUsedCategoryId(category.id);
    router.back();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <AmountInput
        value={amount}
        onChange={setAmount}
        currency={entryCurrency}
        onCurrencyChange={setEntryCurrency}
      />

      <CategoryQuickGrid
        categories={gridCategories}
        selectedId={category?.id ?? null}
        onSelect={setCategory}
        onMore={() => setPickerOpen(true)}
      />

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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Manual smoke test (new expense)**

Run: `npx expo start --clear`, open the app, tap the floating "+" / "New expense" entry.

Verify:
- The grid renders with up to 7 tiles + a "More" tile in the 8th slot, laid out 4 across, 2 down.
- The most recently used category (or `lastUsedCategoryId`) is pre-selected and visibly highlighted (primary-colored border, surface background).
- Tapping a different tile updates the highlight.
- Tapping "More" opens the existing sheet; the sheet now has a "Manage" link in its header.
- Tapping "Manage" closes the sheet and navigates to the category management screen.
- Picking a category from the sheet (one that isn't in the visible top-7) closes the sheet and: that category appears as tile 1 of the grid, highlighted, and the previously last tile is no longer shown.
- Saving the expense returns to the previous screen and writes the expense with the chosen category (verify on Home / Stats).

- [ ] **Step 4: Commit**

```bash
git add app/expense/new.tsx
git commit -m "feat(expense): inline category grid on new-expense screen"
```

---

### Task 6: Wire `CategoryQuickGrid` into the edit-expense screen

**Files:**
- Modify: `app/expense/[id].tsx`

- [ ] **Step 1: Replace the category pressable with the grid**

Same pattern as Task 5. The expense's own category is loaded into state in the existing `useEffect`; promotion handles the case where that category isn't in the 90-day top-7. Replace the file contents with:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { AmountInput } from '../../src/components/AmountInput';
import { DateField } from '../../src/components/DateField';
import { CategoryQuickGrid } from '../../src/components/CategoryQuickGrid';
import { CategoryPickerSheet } from '../../src/components/CategoryPickerSheet';
import { parseAmountToCents } from '../../src/lib/currency';
import { listExpenses, updateExpense, deleteExpense } from '../../src/repositories/expenses';
import { getCategory, listTopCategoriesByUsage } from '../../src/repositories/categories';
import { promoteSelectedToGrid } from '../../src/lib/categoryGrid';
import { useFxRates } from '../../src/stores/fxRates';
import { useSettings } from '../../src/stores/settings';
import { deriveRateToBaseX1e6 } from '../../src/lib/fx';
import type { Category } from '../../src/db/schema';
import type { CurrencyCode } from '../../src/lib/currency';
import { isCurrencyCode } from '../../src/lib/currency';
import { theme } from '../../src/theme';

export default function EditExpense() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenseId = Number(id);
  const displayCurrency = useSettings(s => s.displayCurrency);
  const [amount, setAmount] = useState('');
  const [entryCurrency, setEntryCurrency] = useState<CurrencyCode>(displayCurrency);
  const [category, setCategory] = useState<Category | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [topCategories, setTopCategories] = useState<Category[]>([]);
  const rates = useFxRates(s => s.rates);

  useEffect(() => {
    listTopCategoriesByUsage({ sinceDays: 90, limit: 7 }).then(setTopCategories);
  }, []);

  useEffect(() => {
    (async () => {
      const rows = await listExpenses({ limit: 1000 });
      const found = rows.find(r => r.id === expenseId);
      if (!found) return router.back();
      setAmount((found.amountCents / 100).toFixed(2));
      setNote(found.note ?? '');
      setDate(new Date(found.occurredAt));
      // currency column is NOT NULL — guard for hand-edited DBs only.
      setEntryCurrency(isCurrencyCode(found.currency) ? found.currency : 'EUR');
      const cat = await getCategory(found.categoryId);
      if (cat) setCategory(cat);
    })();
  }, [expenseId]);

  const gridCategories = useMemo(
    () => promoteSelectedToGrid(topCategories, category),
    [topCategories, category],
  );

  async function save() {
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) return Alert.alert('Invalid amount');
    if (!category) return Alert.alert('Pick a category');
    // Spec §1.5: ALWAYS re-snapshot rate on edit-save, regardless of which fields changed.
    const rateToBaseX1e6 = deriveRateToBaseX1e6(rates, entryCurrency);
    await updateExpense(expenseId, {
      amountCents: cents,
      currency: entryCurrency,
      rateToBaseX1e6,
      categoryId: category.id,
      note: note || null,
      occurredAt: date,
    });
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
      <AmountInput
        value={amount}
        onChange={setAmount}
        currency={entryCurrency}
        onCurrencyChange={setEntryCurrency}
      />

      <CategoryQuickGrid
        categories={gridCategories}
        selectedId={category?.id ?? null}
        onSelect={setCategory}
        onMore={() => setPickerOpen(true)}
      />

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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Manual smoke test (edit expense)**

With the dev server running, open the app, tap an existing expense to edit it.

Verify:
- The grid renders with the expense's current category highlighted.
- If the expense's category is not in the natural 90-day top-7, it appears in slot 1 of the grid (promoted for display) and is highlighted.
- Switching to a different category from the grid updates the highlight; saving persists the new category.
- "More" → sheet → "Manage" works the same as on the new-expense screen.

- [ ] **Step 4: Commit**

```bash
git add app/expense/[id].tsx
git commit -m "feat(expense): inline category grid on edit-expense screen"
```

---

### Task 7: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Lint**

Run: `npx expo lint`
Expected: no new errors compared to `main`.

- [ ] **Step 3: Cross-screen sanity check**

With the app running, perform this sequence and confirm nothing regresses:

1. Add a new expense using a tile from the grid. Confirm it appears on Home and Stats.
2. Add a new expense using a category picked through "More". Confirm the next time you open the new-expense screen, that category appears highlighted as tile 1 (because `lastUsedCategoryId` resolves to a non-top-7 entry → promoted to position 0).
3. Edit that expense, change the category back to a top-7 tile, save. Confirm the change persists.
4. From "More", tap "Manage" → confirm the category management screen opens and the picker is closed.
5. On a fresh / lightly-used DB (or after `expo start --clear` on a new device), confirm the grid still renders 7 tiles + More — alphabetical fill from `listTopCategoriesByUsage` covers categories with zero recent usage.

- [ ] **Step 4: No commit needed**

Final verification is a check, not a change. If steps 1–3 surfaced any issue, address it as a follow-up commit before merging.
