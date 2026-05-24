import { create } from 'zustand';
import { getAllRates, upsertRates, type RatesEurToQuote } from '../repositories/fxRates';
import { getAllSettings, setSetting } from '../repositories/settings';
import { fetchFrankfurterRates } from '../lib/fxClient';

const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

type State = {
  loaded: boolean;
  rates: RatesEurToQuote;
  fxLastFetchedAt: number; // unix ms; 0 == never
  refreshing: boolean;
  refreshError: string | null;
  hydrate: () => Promise<void>;
  refreshIfStale: () => Promise<void>;
  refreshNow: () => Promise<void>;
};

export const useFxRates = create<State>((set, get) => ({
  loaded: false,
  rates: {},
  fxLastFetchedAt: 0,
  refreshing: false,
  refreshError: null,
  hydrate: async () => {
    const [rates, settings] = await Promise.all([getAllRates(), getAllSettings()]);
    const ts = Number(settings.fxLastFetchedAt ?? '0');
    set({
      rates,
      fxLastFetchedAt: Number.isFinite(ts) ? ts : 0,
      loaded: true,
    });
  },
  refreshIfStale: async () => {
    const { fxLastFetchedAt, rates, refreshing } = get();
    if (refreshing) return;
    const isEmpty = Object.keys(rates).filter(k => k !== 'BGN').length === 0;
    const isStale = Date.now() - fxLastFetchedAt > STALE_AFTER_MS;
    if (!isEmpty && !isStale) return;
    await get().refreshNow();
  },
  refreshNow: async () => {
    if (get().refreshing) return;
    set({ refreshing: true, refreshError: null });
    try {
      const fetched = await fetchFrankfurterRates();
      const now = Date.now();
      await upsertRates(fetched, now);
      await setSetting('fxLastFetchedAt', String(now));
      const merged = await getAllRates();
      set({ rates: merged, fxLastFetchedAt: now, refreshing: false });
    } catch (e: any) {
      // Per spec: swallow silently. We surface for the manual Refresh action only.
      set({ refreshing: false, refreshError: e?.message ?? 'fetch failed' });
    }
  },
}));
