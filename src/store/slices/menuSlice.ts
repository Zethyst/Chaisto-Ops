import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';
import { MenuItem, MenuPortion } from '../../types';
import { stallConfigService } from '../../services/stallConfigService';
import { todayISO } from '../../utils/date';

// Half / full plate serving sizes offered on plate-served items. `stockFactor`
// converts servings back into the packet unit used by stock reconciliation.
export const DEFAULT_PORTIONS: MenuPortion[] = [
  { key: 'half', name: 'Half Plate', price: 25, stockFactor: 0.5 },
  { key: 'full', name: 'Full Plate', price: 40, stockFactor: 1 },
];

export const defaultPortionsForPrice = (fullPrice: number): MenuPortion[] => [
  { key: 'half', name: 'Half Plate', price: Math.round(fullPrice / 2 / 5) * 5 || Math.round(fullPrice / 2), stockFactor: 0.5 },
  { key: 'full', name: 'Full Plate', price: fullPrice, stockFactor: 1 },
];

export const DEFAULT_MENU_ITEMS: MenuItem[] = [
  { key: 'regularChai', name: 'Regular Chai', price: 15, active: true, sortOrder: 0, isDefault: true },
  { key: 'specialChai', name: 'Special Chai', price: 25, active: true, sortOrder: 1, isDefault: true },
  { key: 'kulhadChai', name: 'Kulhad Chai', price: 20, active: true, sortOrder: 2, isDefault: true },
  { key: 'vegMomo', name: 'Veg Momo', price: 40, active: true, sortOrder: 3, isDefault: true, portions: defaultPortionsForPrice(40) },
  { key: 'paneerMomo', name: 'Paneer Momo', price: 60, active: true, sortOrder: 4, isDefault: true, portions: defaultPortionsForPrice(60) },
];

// Momo menu item keys are sold by the packet, not the cup
export const MOMO_ITEM_KEYS = ['vegMomo', 'paneerMomo'];

// Milk is bought in packets; both values are admin-configurable per stall.
export const DEFAULT_MILK_COST_PER_PACKET = 30;
export const DEFAULT_MILK_ML_PER_PACKET = 500;

// Momos are bought loose and counted in pieces, but sold by the plate. Reports
// store momo quantities in plate-equivalents (a half plate is 0.5), so this is
// the conversion staff-facing piece counts go through.
export const DEFAULT_MOMO_PIECES_PER_PLATE = 10;

// Tally counters are keyed per sellable unit. Portioned items get one counter
// per portion (`vegMomo::half`); single-price items keep their plain item key
// so tallies saved before portions existed still resolve.
export const UNIT_KEY_SEPARATOR = '::';

export const unitKey = (itemKey: string, portionKey?: string) =>
  portionKey ? `${itemKey}${UNIT_KEY_SEPARATOR}${portionKey}` : itemKey;

export const splitUnitKey = (key: string): { itemKey: string; portionKey?: string } => {
  const idx = key.indexOf(UNIT_KEY_SEPARATOR);
  if (idx === -1) return { itemKey: key };
  return { itemKey: key.slice(0, idx), portionKey: key.slice(idx + UNIT_KEY_SEPARATOR.length) };
};

export interface SellableUnit {
  unitKey: string;
  itemKey: string;
  portionKey?: string;
  /** Portion name ("Half Plate") or undefined for single-price items */
  portionName?: string;
  price: number;
  stockFactor: number;
}

/** Every counter an item contributes to the tally — one per portion, else one. */
export const getSellableUnits = (item: MenuItem): SellableUnit[] => {
  if (item.portions?.length) {
    return item.portions.map(p => ({
      unitKey: unitKey(item.key, p.key),
      itemKey: item.key,
      portionKey: p.key,
      portionName: p.name,
      price: p.price,
      stockFactor: p.stockFactor ?? 1,
    }));
  }
  return [{ unitKey: item.key, itemKey: item.key, price: item.price, stockFactor: 1 }];
};

// Map default item keys to DailyReport sales fields
export const ITEM_KEY_TO_SALES_FIELD: Record<string, string> = {
  regularChai: 'regularCups',
  specialChai: 'specialCups',
  kulhadChai: 'kulhadCups',
  vegMomo: 'vegMomoPackets',
  paneerMomo: 'paneerMomoPackets',
};

export interface TallyData {
  counters: Record<string, number>; // sellable unit key -> count
  milkPackets: number;              // milk expense, priced per packet in stall config
  cigarettes?: number;              // ₹ of cigarettes sold — no unit count, just value
  upi: number;
  cash: number;
  notes: string;
  date: string; // YYYY-MM-DD; used to auto-reset on new day
}

interface MenuState {
  items: MenuItem[];
  milkCostPerPacket: number;
  milkMlPerPacket: number;
  momoPiecesPerPlate: number;
  isLoaded: boolean;
  isSaving: boolean;
  tally: TallyData;
}

/**
 * Gives plate-served items their default portions when the stored config
 * predates portions — stall configs saved before this feature, and menus
 * rehydrated from an older persisted state, arrive without them and would
 * otherwise render as a single "per packet" counter. An item the admin
 * deliberately switched to a single price (`portioned: false`) is left alone.
 */
export const normalizeMenuItems = (items: MenuItem[]): MenuItem[] =>
  items.map(item => {
    if (!MOMO_ITEM_KEYS.includes(item.key)) return item;
    if (item.portioned === false || item.portions?.length) return item;
    return { ...item, portions: defaultPortionsForPrice(item.price) };
  });

/**
 * Price of one stock unit (packet / cup) of an item. For plate-served items
 * this is the full-plate rate, which is what report sales — recorded in stock
 * units — are valued at.
 */
export const pricePerStockUnit = (item: MenuItem): number => {
  if (!item.portions?.length) return item.price;
  const full = item.portions.find(p => p.stockFactor === 1)
    ?? [...item.portions].sort((a, b) => Math.abs(a.stockFactor - 1) - Math.abs(b.stockFactor - 1))[0];
  return full.stockFactor > 0 ? full.price / full.stockFactor : full.price;
};

/** Total servings tallied for an item across all of its portions. */
export const servingsForItem = (item: MenuItem, counters: Record<string, number>) =>
  getSellableUnits(item).reduce((sum, u) => sum + (counters[u.unitKey] || 0), 0);

/** Servings converted back to the item's stock unit (packets). */
export const stockUnitsForItem = (item: MenuItem, counters: Record<string, number>) =>
  getSellableUnits(item).reduce((sum, u) => sum + (counters[u.unitKey] || 0) * u.stockFactor, 0);

/** Rupee value tallied for an item across all of its portions. */
export const revenueForItem = (item: MenuItem, counters: Record<string, number>) =>
  getSellableUnits(item).reduce((sum, u) => sum + (counters[u.unitKey] || 0) * u.price, 0);

const todayStr = () => todayISO();

const freshTally = (): TallyData => ({
  counters: {},
  milkPackets: 0,
  cigarettes: 0,
  upi: 0,
  cash: 0,
  notes: '',
  date: todayStr(),
});

const initialState: MenuState = {
  items: DEFAULT_MENU_ITEMS,
  milkCostPerPacket: DEFAULT_MILK_COST_PER_PACKET,
  milkMlPerPacket: DEFAULT_MILK_ML_PER_PACKET,
  momoPiecesPerPlate: DEFAULT_MOMO_PIECES_PER_PLATE,
  isLoaded: false,
  isSaving: false,
  tally: freshTally(),
};

export const fetchMenuConfig = createAsyncThunk(
  'menu/fetchConfig',
  async (stallId: string, { rejectWithValue }) => {
    try {
      return await stallConfigService.getConfig(stallId);
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

export const saveMenuItems = createAsyncThunk(
  'menu/saveItems',
  async (
    { stallId, items, milkCostPerPacket, milkMlPerPacket, momoPiecesPerPlate }: {
      stallId: string;
      items: MenuItem[];
      milkCostPerPacket?: number;
      milkMlPerPacket?: number;
      momoPiecesPerPlate?: number;
    },
    { rejectWithValue },
  ) => {
    try {
      return await stallConfigService.updateConfig(stallId, {
        menuItems: items,
        ...(milkCostPerPacket !== undefined ? { milkCostPerPacket } : {}),
        ...(milkMlPerPacket !== undefined ? { milkMlPerPacket } : {}),
        ...(momoPiecesPerPlate !== undefined ? { momoPiecesPerPlate } : {}),
      } as any);
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

const applySupplyUnits = (state: MenuState, cfg: any) => {
  if (typeof cfg?.milkCostPerPacket === 'number') state.milkCostPerPacket = cfg.milkCostPerPacket;
  if (typeof cfg?.milkMlPerPacket === 'number') state.milkMlPerPacket = cfg.milkMlPerPacket;
  if (typeof cfg?.momoPiecesPerPlate === 'number') state.momoPiecesPerPlate = cfg.momoPiecesPerPlate;
};

const menuSlice = createSlice({
  name: 'menu',
  initialState,
  reducers: {
    ensureFreshTally: (state) => {
      if (state.tally.date !== todayStr()) {
        state.tally = freshTally();
      } else if (state.tally.cigarettes === undefined) {
        // Tally persisted before cigarette sales existed
        state.tally.cigarettes = 0;
      }
    },
    incrementTally: (state, action: PayloadAction<{ key: string; by?: number }>) => {
      const { key, by = 1 } = action.payload;
      state.tally.counters[key] = (state.tally.counters[key] || 0) + by;
    },
    decrementTally: (state, action: PayloadAction<{ key: string; by?: number }>) => {
      const { key, by = 1 } = action.payload;
      state.tally.counters[key] = Math.max(0, (state.tally.counters[key] || 0) - by);
    },
    setTallyCigarettes: (state, action: PayloadAction<number>) => {
      state.tally.cigarettes = Math.max(0, action.payload);
    },
    setTallyUpi: (state, action: PayloadAction<number>) => {
      state.tally.upi = action.payload;
    },
    setTallyCash: (state, action: PayloadAction<number>) => {
      state.tally.cash = action.payload;
    },
    setTallyNotes: (state, action: PayloadAction<string>) => {
      state.tally.notes = action.payload;
    },
    resetTally: (state) => {
      state.tally = freshTally();
    },
    incrementMilkPackets: (state, action: PayloadAction<number | undefined>) => {
      state.tally.milkPackets = Math.max(0, state.tally.milkPackets + (action.payload ?? 1));
    },
    decrementMilkPackets: (state, action: PayloadAction<number | undefined>) => {
      state.tally.milkPackets = Math.max(0, state.tally.milkPackets - (action.payload ?? 1));
    },
    addMenuItem: (state, action: PayloadAction<{ name: string; price: number; recipe?: string }>) => {
      const key = `custom_${Date.now()}`;
      state.items.push({
        key,
        name: action.payload.name,
        price: action.payload.price,
        active: true,
        sortOrder: state.items.length,
        isDefault: false,
        recipe: action.payload.recipe ?? '',
      });
    },
    updateMenuPortion: (state, action: PayloadAction<{ itemKey: string; portionKey: string; name?: string; price?: number; stockFactor?: number }>) => {
      const item = state.items.find(i => i.key === action.payload.itemKey);
      const portion = item?.portions?.find(p => p.key === action.payload.portionKey);
      if (!portion) return;
      if (action.payload.name !== undefined) portion.name = action.payload.name;
      if (action.payload.price !== undefined) portion.price = action.payload.price;
      if (action.payload.stockFactor !== undefined) portion.stockFactor = action.payload.stockFactor;
    },
    // Switches an item between a single price and half/full plate pricing.
    setItemPortioned: (state, action: PayloadAction<{ key: string; portioned: boolean }>) => {
      const item = state.items.find(i => i.key === action.payload.key);
      if (!item) return;
      item.portioned = action.payload.portioned;
      if (action.payload.portioned) {
        if (!item.portions?.length) item.portions = defaultPortionsForPrice(item.price);
      } else {
        // Collapse back to the full-plate price so revenue stays sensible
        const full = item.portions?.find(p => p.stockFactor >= 1) ?? item.portions?.[item.portions.length - 1];
        if (full) item.price = full.price;
        delete item.portions;
      }
    },
    setSupplyUnits: (state, action: PayloadAction<{ milkCostPerPacket?: number; milkMlPerPacket?: number; momoPiecesPerPlate?: number }>) => {
      if (action.payload.milkCostPerPacket !== undefined) state.milkCostPerPacket = action.payload.milkCostPerPacket;
      if (action.payload.milkMlPerPacket !== undefined) state.milkMlPerPacket = action.payload.milkMlPerPacket;
      if (action.payload.momoPiecesPerPlate !== undefined) state.momoPiecesPerPlate = action.payload.momoPiecesPerPlate;
    },
    updateMenuItem: (state, action: PayloadAction<{ key: string; name?: string; price?: number; active?: boolean; recipe?: string }>) => {
      const item = state.items.find(i => i.key === action.payload.key);
      if (item) {
        if (action.payload.name !== undefined) item.name = action.payload.name;
        if (action.payload.price !== undefined) item.price = action.payload.price;
        if (action.payload.active !== undefined) item.active = action.payload.active;
        if (action.payload.recipe !== undefined) item.recipe = action.payload.recipe;
      }
    },
    removeMenuItem: (state, action: PayloadAction<string>) => {
      // Default items can be toggled off but not deleted; custom items fully removed
      const item = state.items.find(i => i.key === action.payload);
      if (item?.isDefault) {
        item.active = false;
      } else {
        state.items = state.items.filter(i => i.key !== action.payload);
      }
    },
    setMenuItems: (state, action: PayloadAction<MenuItem[]>) => {
      state.items = normalizeMenuItems(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // redux-persist restores this slice without passing it through any
      // reducer, so a menu persisted before portions existed would render as a
      // single "per packet" counter until the next successful config fetch.
      // Because autoMergeLevel1 skips any key a reducer touched, this has to
      // restore the whole menu substate itself, not just `items`.
      .addCase(REHYDRATE, (state, action: any) => {
        const persisted = action.payload?.menu;
        if (!persisted) return state;
        return {
          ...state,
          ...persisted,
          isSaving: false, // never resume mid-save after a restart
          items: persisted.items?.length ? normalizeMenuItems(persisted.items) : state.items,
        };
      })
      .addCase(fetchMenuConfig.fulfilled, (state, action) => {
        const cfg = action.payload as any;
        if (cfg?.menuItems?.length > 0) {
          state.items = normalizeMenuItems(cfg.menuItems);
        }
        applySupplyUnits(state, cfg);
        state.isLoaded = true;
      })
      .addCase(saveMenuItems.pending, (state) => { state.isSaving = true; })
      .addCase(saveMenuItems.fulfilled, (state, action) => {
        state.isSaving = false;
        const cfg = action.payload as any;
        if (cfg?.menuItems?.length > 0) state.items = normalizeMenuItems(cfg.menuItems);
        applySupplyUnits(state, cfg);
      })
      .addCase(saveMenuItems.rejected, (state) => { state.isSaving = false; });
  },
});

export const {
  ensureFreshTally, incrementTally, decrementTally,
  incrementMilkPackets, decrementMilkPackets,
  setTallyUpi, setTallyCash, setTallyNotes, setTallyCigarettes, resetTally,
  addMenuItem, updateMenuItem, updateMenuPortion, setItemPortioned,
  setSupplyUnits, removeMenuItem, setMenuItems,
} = menuSlice.actions;
export default menuSlice.reducer;
