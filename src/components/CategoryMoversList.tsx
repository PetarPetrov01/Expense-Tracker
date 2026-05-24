import { View, Text } from 'react-native';
import { theme } from '../theme';
import { CategoryIcon } from './CategoryIcon';
import { Sparkline } from './Sparkline';
import { formatAmount, type CurrencyCode } from '../lib/currency';

export type Mover = {
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  currentCents: number;
  previousCents: number;
  historyCents: number[];
};

export function CategoryMoversList({
  movers,
  displayCurrency,
  hasPrevious,
  toDisplay,
}: {
  movers: Mover[];
  displayCurrency: CurrencyCode;
  hasPrevious: boolean;
  toDisplay: (cents: number) => number;
}) {
  if (!hasPrevious) return null;

  const annotated = movers
    .map(m => ({ ...m, delta: m.currentCents - m.previousCents }))
    .filter(m => m.delta !== 0);

  const gainers = annotated
    .filter(m => m.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);

  const decliners = annotated
    .filter(m => m.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3);

  if (gainers.length === 0 && decliners.length === 0) return null;

  return (
    <View style={{
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      gap: theme.spacing.md,
    }}>
      <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>
        What's changing
      </Text>
      {gainers.length > 0 && (
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Up</Text>
          {gainers.map(m => (
            <CategoryMoverRow
              key={m.categoryId}
              mover={m}
              displayCurrency={displayCurrency}
              toDisplay={toDisplay}
            />
          ))}
        </View>
      )}
      {decliners.length > 0 && (
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Down</Text>
          {decliners.map(m => (
            <CategoryMoverRow
              key={m.categoryId}
              mover={m}
              displayCurrency={displayCurrency}
              toDisplay={toDisplay}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function CategoryMoverRow({
  mover, displayCurrency, toDisplay,
}: {
  mover: Mover & { delta: number };
  displayCurrency: CurrencyCode;
  toDisplay: (cents: number) => number;
}) {
  const up = mover.delta > 0;
  const isNew = mover.previousCents === 0;
  const isStopped = mover.currentCents === 0;
  const pct = mover.previousCents === 0
    ? null
    : (mover.delta / mover.previousCents) * 100;
  const deltaColor = up ? theme.colors.danger : theme.colors.primary;

  let badge: string;
  if (isNew) badge = 'new';
  else if (isStopped) badge = 'stopped';
  else {
    const absPct = Math.abs(pct!);
    badge = absPct < 1
      ? (up ? '<+1%' : '<−1%')
      : `${up ? '+' : '−'}${absPct.toFixed(0)}%`;
  }

  const currentDisplay = toDisplay(mover.currentCents);
  const previousDisplay = toDisplay(mover.previousCents);
  const historyDisplay = mover.historyCents.map(toDisplay);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <CategoryIcon icon={mover.categoryIcon} color={mover.categoryColor} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.text, fontSize: 14 }}>{mover.categoryName}</Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
          {formatAmount(currentDisplay, displayCurrency)}
          {' · was '}
          {formatAmount(previousDisplay, displayCurrency)}
        </Text>
      </View>
      <Sparkline values={historyDisplay} color={mover.categoryColor} />
      <Text style={{ color: deltaColor, fontSize: 13, fontWeight: '600', minWidth: 56, textAlign: 'right' }}>
        {badge}
      </Text>
    </View>
  );
}
