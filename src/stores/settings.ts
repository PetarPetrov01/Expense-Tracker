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
    try { await setSetting('currency', c); }
    catch (e) { console.warn('[settings] persist currency failed', e); }
  },
  setLastUsedCategoryId: async (id) => {
    set({ lastUsedCategoryId: id });
    try { await setSetting('lastUsedCategoryId', String(id)); }
    catch (e) { console.warn('[settings] persist lastUsedCategoryId failed', e); }
  },
}));
