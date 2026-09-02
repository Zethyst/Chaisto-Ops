// menuSlice / reportSlice pull in API services that reach for native modules at
// import time, so stub them out — none of the reducers under test touch them.
jest.mock('../../../services/stallConfigService', () => ({ stallConfigService: {} }));
jest.mock('../../../services/reportService', () => ({ reportService: {} }));

import { REHYDRATE } from 'redux-persist';
import reducer, {
  DEFAULT_MENU_ITEMS, getSellableUnits, splitUnitKey, unitKey,
  normalizeMenuItems, fetchMenuConfig,
  servingsForItem, stockUnitsForItem, revenueForItem,
  incrementTally, setItemPortioned, updateMenuPortion, setSupplyUnits, setTallyCigarettes,
} from '../menuSlice';
import reportReducer, { startNewReport, preFillFromTally } from '../reportSlice';
import { MenuItem } from '../../../types';

const vegMomo = DEFAULT_MENU_ITEMS.find(i => i.key === 'vegMomo')!;
const regularChai = DEFAULT_MENU_ITEMS.find(i => i.key === 'regularChai')!;

describe('sellable units', () => {
  it('gives a single-price item one unit keyed by the item key', () => {
    const units = getSellableUnits(regularChai);
    expect(units).toHaveLength(1);
    expect(units[0].unitKey).toBe('regularChai');
    expect(units[0].stockFactor).toBe(1);
  });

  it('gives a plate-served item one unit per portion', () => {
    const units = getSellableUnits(vegMomo);
    expect(units.map(u => u.unitKey)).toEqual(['vegMomo::half', 'vegMomo::full']);
    expect(units.map(u => u.stockFactor)).toEqual([0.5, 1]);
  });

  it('round-trips unit keys', () => {
    expect(splitUnitKey(unitKey('vegMomo', 'half'))).toEqual({ itemKey: 'vegMomo', portionKey: 'half' });
    expect(splitUnitKey('regularChai')).toEqual({ itemKey: 'regularChai' });
  });
});

describe('tally aggregation across portions', () => {
  const counters = { 'vegMomo::half': 3, 'vegMomo::full': 2, regularChai: 10 };

  it('counts servings, not stock units', () => {
    expect(servingsForItem(vegMomo, counters)).toBe(5);
  });

  it('converts servings to packets for stock reconciliation', () => {
    expect(stockUnitsForItem(vegMomo, counters)).toBe(3.5); // 3 × 0.5 + 2 × 1
  });

  it('prices each portion separately', () => {
    // defaults: half ₹20, full ₹40
    expect(revenueForItem(vegMomo, counters)).toBe(3 * 20 + 2 * 40);
    expect(revenueForItem(regularChai, counters)).toBe(150);
  });
});

describe('menu reducers', () => {
  const state = () => reducer(undefined, { type: '@@INIT' });

  it('tallies each portion independently', () => {
    let s = state();
    s = reducer(s, incrementTally({ key: 'vegMomo::half', by: 2 }));
    s = reducer(s, incrementTally({ key: 'vegMomo::full' }));
    expect(s.tally.counters).toEqual({ 'vegMomo::half': 2, 'vegMomo::full': 1 });
  });

  it('edits a single portion price', () => {
    const s = reducer(state(), updateMenuPortion({ itemKey: 'vegMomo', portionKey: 'half', price: 30 }));
    const item = s.items.find(i => i.key === 'vegMomo')!;
    expect(item.portions!.find(p => p.key === 'half')!.price).toBe(30);
    expect(item.portions!.find(p => p.key === 'full')!.price).toBe(40);
  });

  it('adds plate pricing to a single-price item and collapses it back', () => {
    let s = reducer(state(), setItemPortioned({ key: 'regularChai', portioned: true }));
    let item = s.items.find(i => i.key === 'regularChai')!;
    expect(item.portions).toHaveLength(2);
    expect(item.portions!.map(p => p.price)).toEqual([Math.round(15 / 2 / 5) * 5, 15]);

    s = reducer(s, updateMenuPortion({ itemKey: 'regularChai', portionKey: 'full', price: 18 }));
    s = reducer(s, setItemPortioned({ key: 'regularChai', portioned: false }));
    item = s.items.find(i => i.key === 'regularChai')!;
    expect(item.portions).toBeUndefined();
    expect(item.price).toBe(18); // keeps the full-plate price
  });

  it('stores admin-configured supply units', () => {
    const s = reducer(state(), setSupplyUnits({
      milkCostPerPacket: 34, milkMlPerPacket: 450, momoPiecesPerPlate: 8,
    }));
    expect(s.milkCostPerPacket).toBe(34);
    expect(s.milkMlPerPacket).toBe(450);
    expect(s.momoPiecesPerPlate).toBe(8);
  });
});

describe('preFillFromTally', () => {
  const draft = (items: MenuItem[], counters: Record<string, number>) => {
    let s = reportReducer(undefined, startNewReport({ staffId: 's1', stallId: 'st1', stallName: 'Stall' }));
    s = reportReducer(s, preFillFromTally({
      tally: { counters, milkPackets: 0, upi: 100, cash: 50, notes: '', date: '2026-09-02' },
      items,
    }));
    return s.currentDraft!;
  };

  it('folds half and full plates into one packet-based sales field', () => {
    const d = draft(DEFAULT_MENU_ITEMS, { 'vegMomo::half': 3, 'vegMomo::full': 2 });
    expect(d.sales!.vegMomoPackets).toBe(3.5);
  });

  it('still maps plain counters from single-price items', () => {
    const d = draft(DEFAULT_MENU_ITEMS, { regularChai: 40, specialChai: 5 });
    expect(d.sales!.regularCups).toBe(40);
    expect(d.sales!.specialCups).toBe(5);
    expect(d.payments).toEqual({ upi: 100, cash: 50 });
  });

  it('ignores counters for menu items that no longer exist', () => {
    const d = draft(DEFAULT_MENU_ITEMS, { 'custom_123::half': 4, 'vegMomo::full': 1 });
    expect(d.sales!.vegMomoPackets).toBe(1);
  });
});

describe('cigarette sales', () => {
  const state = () => reducer(undefined, { type: '@@INIT' });

  it('tracks cigarettes by rupee value on the tally', () => {
    let s = reducer(state(), setTallyCigarettes(240));
    expect(s.tally.cigarettes).toBe(240);
    s = reducer(s, setTallyCigarettes(-5));
    expect(s.tally.cigarettes).toBe(0);
  });

  it('carries the tally value into the report sales', () => {
    let r = reportReducer(undefined, startNewReport({ staffId: 's1', stallId: 'st1', stallName: 'Stall' }));
    r = reportReducer(r, preFillFromTally({
      tally: {
        counters: { regularChai: 20 }, milkPackets: 0, cigarettes: 240,
        upi: 100, cash: 200, notes: '', date: '2026-09-03',
      },
      items: DEFAULT_MENU_ITEMS,
    }));
    expect(r.currentDraft!.sales!.cigarettes).toBe(240);
    expect(r.currentDraft!.sales!.regularCups).toBe(20);
  });
})

describe('legacy menus without portions', () => {
  const state = () => reducer(undefined, { type: '@@INIT' });

  // Exactly the shape a stall config saved before plate pricing sends back
  const legacyItems = [
    { key: 'regularChai', name: 'Regular Chai', price: 15, active: true, sortOrder: 0, isDefault: true },
    { key: 'vegMomo', name: 'Veg Momo', price: 40, active: true, sortOrder: 3, isDefault: true },
    { key: 'paneerMomo', name: 'Paneer Momo', price: 60, active: true, sortOrder: 4, isDefault: true },
  ] as MenuItem[];

  it('gives momo items half/full plates, leaving cup items alone', () => {
    const normalized = normalizeMenuItems(legacyItems);
    const veg = normalized.find(i => i.key === 'vegMomo')!;
    const chai = normalized.find(i => i.key === 'regularChai')!;

    expect(veg.portions!.map(p => p.name)).toEqual(['Half Plate', 'Full Plate']);
    expect(veg.portions!.map(p => p.price)).toEqual([20, 40]);
    expect(chai.portions).toBeUndefined();
  });

  it('does not override an item an admin set to a single price', () => {
    const chosen = [{ ...legacyItems[1], portioned: false }] as MenuItem[];
    expect(normalizeMenuItems(chosen)[0].portions).toBeUndefined();
  });

  it('leaves already-portioned items untouched', () => {
    const custom = [{
      ...legacyItems[1],
      portions: [{ key: 'full', name: 'Plate', price: 55, stockFactor: 1 }],
    }] as MenuItem[];
    expect(normalizeMenuItems(custom)[0].portions).toHaveLength(1);
  });

  it('backfills a legacy menu arriving from the server', () => {
    const s = reducer(state(), {
      type: fetchMenuConfig.fulfilled.type,
      payload: { menuItems: legacyItems },
    });
    expect(getSellableUnits(s.items.find(i => i.key === 'vegMomo')!)).toHaveLength(2);
  });

  it('backfills a legacy menu restored from persisted state', () => {
    const s = reducer(state(), {
      type: REHYDRATE,
      key: 'chaisto-root',
      payload: { menu: { items: legacyItems, milkCostPerPacket: 34, tally: { counters: { regularChai: 9 } } } },
    });

    expect(getSellableUnits(s.items.find(i => i.key === 'paneerMomo')!)).toHaveLength(2);
    // ...without dropping the rest of the persisted slice
    expect(s.milkCostPerPacket).toBe(34);
    expect(s.tally.counters.regularChai).toBe(9);
  });

  it('records the choice when an admin turns plate pricing off', () => {
    const s = reducer(state(), setItemPortioned({ key: 'vegMomo', portioned: false }));
    const veg = s.items.find(i => i.key === 'vegMomo')!;
    expect(veg.portioned).toBe(false);
    // and that choice survives the next config fetch
    const refetched = reducer(s, {
      type: fetchMenuConfig.fulfilled.type,
      payload: { menuItems: s.items },
    });
    expect(refetched.items.find(i => i.key === 'vegMomo')!.portions).toBeUndefined();
  });
});
