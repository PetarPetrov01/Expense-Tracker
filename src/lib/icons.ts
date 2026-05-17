export const PICKABLE_ICONS = [
  'cart', 'silverware-fork-knife', 'bus', 'car', 'train', 'bike', 'airplane',
  'home-city', 'home', 'lightning-bolt', 'water', 'fire', 'wifi',
  'movie-open', 'gamepad-variant', 'music', 'book-open-variant',
  'heart-pulse', 'pill', 'dumbbell',
  'shopping', 'tshirt-crew', 'hanger',
  'gift', 'cake-variant', 'coffee', 'glass-cocktail',
  'school', 'briefcase', 'cellphone', 'laptop',
  'paw', 'tree', 'flower',
  'cash', 'credit-card', 'bank', 'piggy-bank',
  'dots-horizontal',
] as const;

export type IconName = typeof PICKABLE_ICONS[number];
