import { create } from 'zustand';
import type { CurrencyCode } from '../lib/currency';
import { isCurrencyCode } from '../lib/currency';
import { getAllSettings, setSetting } from '../repositories/settings';

function parseDisplayCurrency(raw: string | undefined): CurrencyCode {
  if (raw && isCurrencyCode(raw)) return raw;
  return 'EUR';
}

function parseCategoryId(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type State = {
  loaded: boolean;
  displayCurrency: CurrencyCode;
  lastUsedCategoryId: number | null;
  hydrate: () => Promise<void>;
  setDisplayCurrency: (c: CurrencyCode) => Promise<void>;
  setLastUsedCategoryId: (id: number) => Promise<void>;
};

export const useSettings = create<State>((set) => ({
  loaded: false,
  displayCurrency: 'EUR',
  lastUsedCategoryId: null,
  hydrate: async () => {
    const all = await getAllSettings();
    set({
      displayCurrency: parseDisplayCurrency(all.displayCurrency),
      lastUsedCategoryId: parseCategoryId(all.lastUsedCategoryId),
      loaded: true,
    });
  },
  setDisplayCurrency: async (c) => {
    set({ displayCurrency: c });
    try { await setSetting('displayCurrency', c); }
    catch (e) { console.warn('[settings] persist displayCurrency failed', e); }
  },
  setLastUsedCategoryId: async (id) => {
    set({ lastUsedCategoryId: id });
    try { await setSetting('lastUsedCategoryId', String(id)); }
    catch (e) { console.warn('[settings] persist lastUsedCategoryId failed', e); }
  },
}));
