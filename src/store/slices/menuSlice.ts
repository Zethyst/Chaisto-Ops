import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { MenuItem } from '../../types';
import { stallConfigService } from '../../services/stallConfigService';

export const DEFAULT_MENU_ITEMS: MenuItem[] = [
  { key: 'regularChai', name: 'Regular Chai', price: 15, active: true, sortOrder: 0, isDefault: true },
  { key: 'specialChai', name: 'Special Chai', price: 25, active: true, sortOrder: 1, isDefault: true },
  { key: 'kulhadChai', name: 'Kulhad Chai', price: 20, active: true, sortOrder: 2, isDefault: true },
];

// Map default item keys to DailyReport sales fields
export const ITEM_KEY_TO_SALES_FIELD: Record<string, string> = {
  regularChai: 'regularCups',
  specialChai: 'specialCups',
  kulhadChai: 'kulhadCups',
};

export interface TallyData {
  counters: Record<string, number>; // menuItem.key -> count
  milkPackets: number;              // 500ml per packet, ₹30 expense each
  upi: number;
  cash: number;
  notes: string;
  date: string; // YYYY-MM-DD; used to auto-reset on new day
}

interface MenuState {
  items: MenuItem[];
  isLoaded: boolean;
  isSaving: boolean;
  tally: TallyData;
}

const todayStr = () => new Date().toISOString().split('T')[0];

const freshTally = (): TallyData => ({
  counters: {},
  milkPackets: 0,
  upi: 0,
  cash: 0,
  notes: '',
  date: todayStr(),
});

const initialState: MenuState = {
  items: DEFAULT_MENU_ITEMS,
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
  async ({ stallId, items }: { stallId: string; items: MenuItem[] }, { rejectWithValue }) => {
    try {
      return await stallConfigService.updateConfig(stallId, { menuItems: items } as any);
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

const menuSlice = createSlice({
  name: 'menu',
  initialState,
  reducers: {
    ensureFreshTally: (state) => {
      if (state.tally.date !== todayStr()) {
        state.tally = freshTally();
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
    addMenuItem: (state, action: PayloadAction<{ name: string; price: number }>) => {
      const key = `custom_${Date.now()}`;
      state.items.push({
        key,
        name: action.payload.name,
        price: action.payload.price,
        active: true,
        sortOrder: state.items.length,
        isDefault: false,
      });
    },
    updateMenuItem: (state, action: PayloadAction<{ key: string; name?: string; price?: number; active?: boolean }>) => {
      const item = state.items.find(i => i.key === action.payload.key);
      if (item) {
        if (action.payload.name !== undefined) item.name = action.payload.name;
        if (action.payload.price !== undefined) item.price = action.payload.price;
        if (action.payload.active !== undefined) item.active = action.payload.active;
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
      state.items = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMenuConfig.fulfilled, (state, action) => {
        const cfg = action.payload as any;
        if (cfg?.menuItems?.length > 0) {
          state.items = cfg.menuItems;
        }
        state.isLoaded = true;
      })
      .addCase(saveMenuItems.pending, (state) => { state.isSaving = true; })
      .addCase(saveMenuItems.fulfilled, (state, action) => {
        state.isSaving = false;
        const cfg = action.payload as any;
        if (cfg?.menuItems?.length > 0) state.items = cfg.menuItems;
      })
      .addCase(saveMenuItems.rejected, (state) => { state.isSaving = false; });
  },
});

export const {
  ensureFreshTally, incrementTally, decrementTally,
  incrementMilkPackets, decrementMilkPackets,
  setTallyUpi, setTallyCash, setTallyNotes, resetTally,
  addMenuItem, updateMenuItem, removeMenuItem, setMenuItems,
} = menuSlice.actions;
export default menuSlice.reducer;
