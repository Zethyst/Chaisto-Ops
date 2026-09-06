import {
  EXPENSE_CATEGORIES, expenseCategoryLabel, expenseCategoryIcon,
} from '../expenseCategories';

// Mirrors backend/src/utils/expenseCategories.js — the model enum rejects
// anything else, so a key here the server does not know would fail to save
const SERVER_CATEGORIES = [
  'gas', 'supplies', 'maintenance', 'equipment',
  'momos', 'milk', 'rolls', 'water', 'other',
];

describe('EXPENSE_CATEGORIES', () => {
  it('matches the categories the server accepts', () => {
    expect(EXPENSE_CATEGORIES.map((c) => c.key).sort()).toEqual([...SERVER_CATEGORIES].sort());
  });

  it('gives every category a label and an icon', () => {
    EXPENSE_CATEGORIES.forEach((c) => {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.icon.length).toBeGreaterThan(0);
    });
  });

  it('has no duplicate keys', () => {
    const keys = EXPENSE_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('expenseCategoryLabel', () => {
  it('gives the wording used on the log form', () => {
    expect(expenseCategoryLabel('gas')).toBe('Gas / Fuel');
    expect(expenseCategoryLabel('momos')).toBe('Momos');
  });

  it('still reads as a word for a category it does not know', () => {
    // An expense logged under a category added later must not show as blank
    expect(expenseCategoryLabel('firewood')).toBe('Firewood');
  });
});

describe('expenseCategoryIcon', () => {
  it('falls back to a box rather than nothing', () => {
    expect(expenseCategoryIcon('firewood')).toBe('📦');
    expect(expenseCategoryIcon('milk')).toBe('🥛');
  });
});
