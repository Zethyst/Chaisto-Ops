jest.mock('../../../services/stallConfigService', () => ({ stallConfigService: {} }));

import { withNewDefaults, DEFAULT_MENU_ITEMS } from '../menuSlice';
import { MenuItem } from '../../../types';

const item = (key: string, over: Partial<MenuItem> = {}): MenuItem => ({
  key, name: key, price: 10, active: true, sortOrder: 0, isDefault: true, ...over,
} as MenuItem);

/** What a stall that saved its menu before fried momos existed looks like. */
const savedBeforeFriedMomos = (): MenuItem[] => [
  item('regularChai', { price: 18, sortOrder: 0 }),
  item('specialChai', { sortOrder: 1 }),
  item('kulhadChai', { sortOrder: 2 }),
  item('vegMomo', { sortOrder: 3 }),
  item('paneerMomo', { sortOrder: 4 }),
];

describe('withNewDefaults', () => {
  it('adds items the stall has never seen', () => {
    const keys = withNewDefaults(savedBeforeFriedMomos()).map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining([
      'friedVegMomo', 'friedPaneerMomo', 'springRoll', 'maggi',
    ]));
  });

  it("leaves the stall's own prices alone", () => {
    const merged = withNewDefaults(savedBeforeFriedMomos());
    expect(merged.find((i) => i.key === 'regularChai')?.price).toBe(18);
  });

  it('adds the new items after the existing ones', () => {
    const merged = withNewDefaults(savedBeforeFriedMomos());
    const added = merged.find((i) => i.key === 'springRoll');
    expect(added!.sortOrder).toBeGreaterThan(4);
  });

  it('does not bring back a default the admin switched off', () => {
    // Defaults are deactivated rather than deleted, so a stored inactive item
    // must stay inactive
    const stored = savedBeforeFriedMomos().map((i) =>
      i.key === 'kulhadChai' ? { ...i, active: false } : i);

    const merged = withNewDefaults(stored);

    expect(merged.filter((i) => i.key === 'kulhadChai')).toHaveLength(1);
    expect(merged.find((i) => i.key === 'kulhadChai')?.active).toBe(false);
  });

  it('changes nothing once the stall has every default', () => {
    const current = DEFAULT_MENU_ITEMS.map((i) => ({ ...i }));
    expect(withNewDefaults(current)).toBe(current);
  });

  it('keeps a stall\'s own custom item', () => {
    const stored = [...savedBeforeFriedMomos(), item('lemonTea', { isDefault: false, sortOrder: 9 })];
    expect(withNewDefaults(stored).map((i) => i.key)).toContain('lemonTea');
  });
});
