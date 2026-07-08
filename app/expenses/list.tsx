import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { startOfDay, endOfDay } from 'date-fns';
import { listExpenses, type ExpenseWithCategory } from '../../src/repositories/expenses';
import { getCategory } from '../../src/repositories/categories';
import { ExpenseRow } from '../../src/components/ExpenseRow';
import { EmptyState } from '../../src/components/EmptyState';
import { PeriodScope } from '../../src/components/PeriodScope';
import { FilterChips } from '../../src/components/FilterChips';
import { CategoryPickerSheet } from '../../src/components/CategoryPickerSheet';
import { TagPickerSheet } from '../../src/components/TagPickerSheet';
import { SortSheet } from '../../src/components/SortSheet';
import { filterAndSortExpenses, type SortKey } from '../../src/lib/expense-filter';
import { useSettings } from '../../src/stores/settings';
import { useFxRates } from '../../src/stores/fxRates';
import { rateLookup, RATE_SCALE, amountInBaseCents } from '../../src/lib/fx';
import { scopeRange, type Scope } from '../../src/lib/dates';
import { formatAmount } from '../../src/lib/currency';
import type { Category, Tag } from '../../src/db/schema';
import { theme } from '../../src/theme';

const SORT_LABELS: Record<SortKey, string> = {
  'date-desc': 'Newest',
  'date-asc': 'Oldest',
  'amount-desc': 'Highest',
  'amount-asc': 'Lowest',
};

export default function ExpenseListScreen() {
  const params = useLocalSearchParams<{
    categoryId?: string; scope?: string; anchor?: string; customStart?: string; customEnd?: string;
  }>();

  const displayCurrency = useSettings(s => s.displayCurrency);
  const weekStart = useSettings(s => s.weekStart);
  const rates = useFxRates(s => s.rates);

  const [scope, setScope] = useState<Scope>((params.scope as Scope) ?? 'month');
  const [anchor, setAnchor] = useState<Date>(params.anchor ? new Date(Number(params.anchor)) : new Date());
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | null>(
    params.customStart && params.customEnd
      ? { start: new Date(Number(params.customStart)), end: new Date(Number(params.customEnd)) }
      : null,
  );

  const [items, setItems] = useState<ExpenseWithCategory[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('date-desc');

  const [catOpen, setCatOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  // Seed the category filter from the route param (the Stats drill-down).
  useEffect(() => {
    if (!params.categoryId) return;
    getCategory(Number(params.categoryId)).then((c) => { if (c) setSelectedCategory(c); });
  }, [params.categoryId]);

  const customStartMs = customRange?.start.getTime();
  const customEndMs = customRange?.end.getTime();

  useFocusEffect(useCallback(() => {
    let start: Date;
    let end: Date;
    if (scope === 'custom') {
      if (!customRange) return;
      start = startOfDay(customRange.start);
      end = endOfDay(customRange.end);
    } else {
      ({ start, end } = scopeRange(scope, anchor, weekStart));
    }
    listExpenses({ start, end }).then(setItems);
  // anchor and customRange object identities aren't stable; we depend on their
  // getTime() values and ms primitives instead.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, anchor.getTime(), weekStart, customStartMs, customEndMs]));

  const filtered = useMemo(
    () => filterAndSortExpenses(items, {
      categoryId: selectedCategory?.id ?? null,
      tagId: selectedTag?.id ?? null,
      search,
      sort,
    }),
    [items, selectedCategory?.id, selectedTag?.id, search, sort],
  );

  const eurToDisplay = rateLookup(rates, displayCurrency);
  const totalBase = filtered.reduce((sum, e) => sum + amountInBaseCents(e), 0);
  const totalDisplay = Math.round((totalBase * eurToDisplay) / RATE_SCALE);

  const hasActiveFilters = selectedCategory != null || selectedTag != null || search.trim() !== '';
  function clearFilters() {
    setSelectedCategory(null);
    setSelectedTag(null);
    setSearch('');
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <FlatList
        data={filtered}
        keyExtractor={(e) => String(e.id)}
        renderItem={({ item }) => <ExpenseRow e={item} />}
        contentContainerStyle={{ padding: theme.spacing.lg, gap: 10, paddingBottom: 96 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
            <PeriodScope
              scope={scope}
              anchor={anchor}
              onScopeChange={setScope}
              onAnchorChange={setAnchor}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search notes & categories"
              placeholderTextColor={theme.colors.textMuted}
              style={{
                backgroundColor: theme.colors.surface,
                padding: theme.spacing.md,
                borderRadius: theme.radius.md,
                color: theme.colors.text,
              }}
            />
            <FilterChips
              categoryLabel={selectedCategory?.name ?? null}
              tagLabel={selectedTag?.name ?? null}
              sortLabel={SORT_LABELS[sort]}
              onCategoryPress={() => setCatOpen(true)}
              onTagPress={() => setTagOpen(true)}
              onSortPress={() => setSortOpen(true)}
              onClearCategory={() => setSelectedCategory(null)}
              onClearTag={() => setSelectedTag(null)}
            />
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
              {filtered.length} {filtered.length === 1 ? 'expense' : 'expenses'} · {formatAmount(totalDisplay, displayCurrency)}
            </Text>
          </View>
        }
        ListEmptyComponent={
          hasActiveFilters
            ? (
              <EmptyState
                icon="filter-remove"
                title="No matches"
                hint="No expenses match your filters."
                action={{ label: 'Clear filters', onPress: clearFilters }}
              />
            )
            : <EmptyState icon="cash-remove" title="No expenses" hint="No records in this period." />
        }
      />

      <CategoryPickerSheet visible={catOpen} onClose={() => setCatOpen(false)} onSelect={setSelectedCategory} />
      <TagPickerSheet visible={tagOpen} onClose={() => setTagOpen(false)} onSelect={setSelectedTag} />
      <SortSheet visible={sortOpen} selected={sort} onClose={() => setSortOpen(false)} onSelect={setSort} />
    </View>
  );
}
