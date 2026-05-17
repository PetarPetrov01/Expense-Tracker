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
