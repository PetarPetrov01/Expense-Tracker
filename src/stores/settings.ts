import { create } from 'zustand';
import type { CurrencyCode } from '../lib/currency';
import { isCurrencyCode } from '../lib/currency';
import type { WeekStart } from '../lib/dates';
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

function parseWeekStart(raw: string | undefined): WeekStart {
  return raw === 'sun' ? 'sun' : 'mon';
}

type State = {
  loaded: boolean;
  displayCurrency: CurrencyCode;
  lastUsedCategoryId: number | null;
  weekStart: WeekStart;
  hydrate: () => Promise<void>;
  setDisplayCurrency: (c: CurrencyCode) => Promise<void>;
  setLastUsedCategoryId: (id: number) => Promise<void>;
  setWeekStart: (w: WeekStart) => Promise<void>;
};

export const useSettings = create<State>((set) => ({
  loaded: false,
  displayCurrency: 'EUR',
  lastUsedCategoryId: null,
  weekStart: 'mon',
  hydrate: async () => {
    const all = await getAllSettings();
    set({
      displayCurrency: parseDisplayCurrency(all.displayCurrency),
      lastUsedCategoryId: parseCategoryId(all.lastUsedCategoryId),
      weekStart: parseWeekStart(all.weekStart),
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
  setWeekStart: async (w) => {
    set({ weekStart: w });
    try { await setSetting('weekStart', w); }
    catch (e) { console.warn('[settings] persist weekStart failed', e); }
  },
}));
