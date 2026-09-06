import { Expense } from '../types';

/**
 * The categories an expense can be filed under, with the icon and wording used
 * wherever one is shown — the log form, the month's chips and the P&L
 * breakdown. Kept beside the backend's own list in
 * `backend/src/utils/expenseCategories.js`; the two must agree.
 */
export const EXPENSE_CATEGORIES: { key: Expense['category']; label: string; icon: string }[] = [
  { key: 'gas', label: 'Gas / Fuel', icon: '🔥' },
  { key: 'milk', label: 'Milk', icon: '🥛' },
  { key: 'momos', label: 'Momos', icon: '🥟' },
  { key: 'rolls', label: 'Rolls', icon: '🌯' },
  { key: 'water', label: 'Water', icon: '💧' },
  { key: 'supplies', label: 'Supplies', icon: '🧻' },
  { key: 'maintenance', label: 'Maintenance', icon: '🔧' },
  { key: 'equipment', label: 'Equipment', icon: '⚙️' },
  { key: 'other', label: 'Other', icon: '📦' },
];

/** The label for a stored category, falling back to the key itself. */
export function expenseCategoryLabel(key: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.label
    ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export function expenseCategoryIcon(key: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.icon ?? '📦';
}
