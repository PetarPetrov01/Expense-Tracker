import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../theme';
import { CategoryIcon } from './CategoryIcon';
import { Sparkline } from './Sparkline';
import { formatAmount, type CurrencyCode } from '../lib/currency';
import type { Scope } from '../lib/dates';

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
  scope,
  anchor,
}: {
  movers: Mover[];
  displayCurrency: CurrencyCode;
  hasPrevious: boolean;
  toDisplay: (cents: number) => number;
  scope: Scope;
  anchor: Date;
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
      <View style={{ gap: 2 }}>
        <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>
          What&apos;s changing
        </Text>
        {(() => {
          const topGainer = gainers[0];
          const topDecliner = decliners[0];
          const top = topGainer && topDecliner
            ? (Math.abs(topGainer.delta) >= Math.abs(topDecliner.delta) ? topGainer : topDecliner)
            : (topGainer ?? topDecliner);
          if (!top) return null;
          const isUp = top.delta > 0;
          let summary: string;
          if (top.previousCents === 0) {
            summary = `${top.categoryName} is new`;
          } else if (top.currentCents === 0) {
            summary = `${top.categoryName} stopped`;
          } else {
            const absPct = Math.abs((top.delta / top.previousCents) * 100);
            const pctText = absPct < 1 ? '<1%' : `${absPct.toFixed(0)}%`;
            summary = `${top.categoryName} ${isUp ? 'up' : 'down'} ${pctText} vs previous`;
          }
          return (
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
              {summary}
            </Text>
          );
        })()}
      </View>
      {gainers.length > 0 && (
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Up</Text>
          {gainers.map(m => (
            <CategoryMoverRow
              key={m.categoryId}
              mover={m}
              displayCurrency={displayCurrency}
              toDisplay={toDisplay}
              scope={scope}
              anchor={anchor}
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
              scope={scope}
              anchor={anchor}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function CategoryMoverRow({
  mover, displayCurrency, toDisplay, scope, anchor,
}: {
  mover: Mover & { delta: number };
  displayCurrency: CurrencyCode;
  toDisplay: (cents: number) => number;
  scope: Scope;
  anchor: Date;
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
    <Pressable
      onPress={() => router.push({
        pathname: '/expenses/list',
        params: {
          categoryId: String(mover.categoryId),
          scope,
          anchor: String(anchor.getTime()),
        },
      })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
    >
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
    </Pressable>
  );
}
