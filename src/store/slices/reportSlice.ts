import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { DailyReport } from '../../types';
import { reportService } from '../../services/reportService';
import { TallyData, ITEM_KEY_TO_SALES_FIELD, splitUnitKey, getSellableUnits } from './menuSlice';
import { MenuItem } from '../../types';
import { computeReportMetrics } from './antiCheatCalc';

// Re-exported for backward compatibility with existing imports.
export { computeReportMetrics };

interface ReportState {
  currentDraft: Partial<DailyReport> | null;
  currentStep: number;
  reports: DailyReport[];
  todayReport: DailyReport | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  syncPending: boolean;
  /** Server-side autosave status for the in-progress report */
  draftSaveState: 'idle' | 'saving' | 'saved' | 'error';
  draftSavedAt: string | null;
}

const blankDraft = ({ staffId, stallId }: { staffId: string; stallId: string; stallName?: string }): Partial<DailyReport> => ({
  id: `draft_${Date.now()}`,
  staffId,
  stallId,
  staffName: '',
  date: new Date().toISOString().split('T')[0],
  status: 'draft',
  flags: [],
  photos: { cash: '', stock: '', milkPacket: '', cartClosing: '' },
  openingStock: { milk: 0, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
  purchases: { milk: 0, snacks: 0, cigarettes: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
  sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 0, paneerMomoPackets: 0, snacks: 0, cigarettes: 0 },
  payments: { upi: 0, cash: 0 },
  closingStock: { milk: 0, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
});

const initialState: ReportState = {
  currentDraft: null,
  currentStep: 0,
  reports: [],
  todayReport: null,
  isLoading: false,
  isSubmitting: false,
  error: null,
  syncPending: false,
  draftSaveState: 'idle',
  draftSavedAt: null,
};

export const submitDailyReport = createAsyncThunk(
  'reports/submit',
  async (report: DailyReport, { rejectWithValue }) => {
    try {
      const submitted = await reportService.submitReport(report);
      return submitted;
    } catch (error: any) {
      // Queue for offline sync
      await reportService.queueOfflineReport(report);
      return rejectWithValue('Saved offline — will sync when connected');
    }
  }
);

export const fetchReports = createAsyncThunk(
  'reports/fetch',
  async ({ stallId, days = 30 }: { stallId?: string; days?: number }, { rejectWithValue }) => {
    try {
      return await reportService.getReports({ stallId, days });
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Pushes the in-progress report to the server. Called debounced as fields and
// photo URLs change, so an interrupted report can be picked up where it left off.
export const saveDraftRemote = createAsyncThunk(
  'reports/saveDraft',
  async (_: void, { getState, rejectWithValue }) => {
    const draft = (getState() as any).reports.currentDraft as Partial<DailyReport> | null;
    if (!draft?.date) return rejectWithValue('No draft to save');
    try {
      return await reportService.saveDraft(draft);
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || err.message);
    }
  }
);

/**
 * Continues today's report: an unfinished local draft wins (it is the most
 * recent), otherwise the server's autosaved draft is restored, otherwise a
 * fresh one is started.
 */
export const resumeOrStartReport = createAsyncThunk(
  'reports/resumeOrStart',
  async (
    { staffId, stallId, stallName }: { staffId: string; stallId: string; stallName: string },
    { getState },
  ) => {
    const local = (getState() as any).reports.currentDraft as Partial<DailyReport> | null;
    const today = new Date().toISOString().split('T')[0];
    if (local && local.date === today) return { draft: local, resumed: false };

    try {
      const remote = await reportService.getDraft(today);
      if (remote) return { draft: remote, resumed: true };
    } catch {
      // Offline or no draft on the server — fall through to a fresh report
    }
    return { draft: blankDraft({ staffId, stallId, stallName }), resumed: false };
  }
);

/** Adds an optional photo (cart closing) to an already-submitted report. */
export const attachReportPhoto = createAsyncThunk(
  'reports/attachPhoto',
  async (
    { reportId, category, url }: { reportId: string; category: string; url: string },
    { rejectWithValue },
  ) => {
    try {
      return await reportService.addReportPhoto(reportId, category, url);
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Could not attach photo');
    }
  }
);

export const fetchTodayReport = createAsyncThunk(
  'reports/fetchToday',
  async (staffId: string, { rejectWithValue }) => {
    try {
      return await reportService.getTodayReport(staffId);
    } catch {
      return null;
    }
  }
);

const reportSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    startNewReport: (state, action: PayloadAction<{ staffId: string; stallId: string; stallName: string }>) => {
      state.currentDraft = blankDraft(action.payload);
      state.currentStep = 0;
    },
    updateDraftSection: (state, action: PayloadAction<{ section: string; data: any }>) => {
      if (state.currentDraft) {
        (state.currentDraft as any)[action.payload.section] = action.payload.data;
        // Recompute metrics on every update
        const { computed, flags } = computeReportMetrics(state.currentDraft);
        state.currentDraft.computed = computed;
        state.currentDraft.flags = flags;
      }
    },
    addPhoto: (state, action: PayloadAction<{ category: string; uri: string }>) => {
      if (state.currentDraft?.photos) {
        (state.currentDraft.photos as any)[action.payload.category] = action.payload.uri;
      }
    },
    setStep: (state, action: PayloadAction<number>) => {
      state.currentStep = action.payload;
    },
    clearDraft: (state) => {
      state.currentDraft = null;
      state.currentStep = 0;
      state.draftSaveState = 'idle';
      state.draftSavedAt = null;
    },
    setSyncPending: (state, action: PayloadAction<boolean>) => {
      state.syncPending = action.payload;
    },
    preFillFromTally: (state, action: PayloadAction<{ tally: TallyData; items: MenuItem[] }>) => {
      if (!state.currentDraft) return;
      const { tally, items } = action.payload;
      // Map tally counters to known sales fields. Portioned items tally in
      // servings (half / full plate), so each serving is converted back to the
      // item's stock unit before it lands on the report — a half plate counts
      // as 0.5 packets, which is what opening/closing stock is measured in.
      const stockFactorFor = (unitKey: string) => {
        const { itemKey, portionKey } = splitUnitKey(unitKey);
        const item = items.find(i => i.key === itemKey);
        if (!item) return portionKey ? 0 : 1;
        return getSellableUnits(item).find(u => u.unitKey === unitKey)?.stockFactor ?? 1;
      };

      const salesPatch: Record<string, number> = {};
      Object.entries(tally.counters).forEach(([key, count]) => {
        const field = ITEM_KEY_TO_SALES_FIELD[splitUnitKey(key).itemKey];
        if (!field) return;
        salesPatch[field] = (salesPatch[field] || 0) + count * stockFactorFor(key);
      });
      state.currentDraft.sales = {
        ...(state.currentDraft.sales || {}),
        ...salesPatch,
        cigarettes: tally.cigarettes || 0,
      } as any;
      state.currentDraft.payments = {
        upi: tally.upi,
        cash: tally.cash,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitDailyReport.pending, (state) => { state.isSubmitting = true; })
      .addCase(submitDailyReport.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.todayReport = action.payload;
        state.currentDraft = null;
        state.currentStep = 0;
        state.draftSaveState = 'idle';
        state.draftSavedAt = null;
      })
      .addCase(submitDailyReport.rejected, (state, action) => {
        state.isSubmitting = false;
        state.syncPending = true;
        state.error = action.payload as string;
      })
      .addCase(fetchReports.fulfilled, (state, action) => {
        state.reports = action.payload;
        state.isLoading = false;
      })
      .addCase(fetchTodayReport.fulfilled, (state, action) => {
        state.todayReport = action.payload;
      })
      .addCase(saveDraftRemote.pending, (state) => { state.draftSaveState = 'saving'; })
      .addCase(saveDraftRemote.fulfilled, (state, action) => {
        state.draftSaveState = 'saved';
        state.draftSavedAt = (action.payload as string) || new Date().toISOString();
      })
      .addCase(saveDraftRemote.rejected, (state) => {
        // Entries stay in the persisted local draft; the next edit retries
        state.draftSaveState = 'error';
      })
      .addCase(resumeOrStartReport.fulfilled, (state, action) => {
        state.currentDraft = action.payload.draft;
        state.currentStep = 0;
        if (action.payload.resumed) {
          state.draftSaveState = 'saved';
          state.draftSavedAt = (action.payload.draft as any)?.updatedAt || null;
        }
      })
      .addCase(attachReportPhoto.fulfilled, (state, action) => {
        state.todayReport = action.payload;
        const idx = state.reports.findIndex(r => (r as any)._id === (action.payload as any)._id);
        if (idx >= 0) state.reports[idx] = action.payload;
      });
  },
});

export const {
  startNewReport, updateDraftSection, addPhoto,
  setStep, clearDraft, setSyncPending, preFillFromTally,
} = reportSlice.actions;
export default reportSlice.reducer;
