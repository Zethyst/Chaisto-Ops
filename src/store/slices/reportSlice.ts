import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { DailyReport } from '../../types';
import { reportService } from '../../services/reportService';
import { TallyData, ITEM_KEY_TO_SALES_FIELD } from './menuSlice';
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
}

const initialState: ReportState = {
  currentDraft: null,
  currentStep: 0,
  reports: [],
  todayReport: null,
  isLoading: false,
  isSubmitting: false,
  error: null,
  syncPending: false,
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
      state.currentDraft = {
        id: `draft_${Date.now()}`,
        staffId: action.payload.staffId,
        stallId: action.payload.stallId,
        staffName: '',
        date: new Date().toISOString().split('T')[0],
        status: 'draft',
        flags: [],
        photos: { cash: '', stock: '', milkPacket: '' },
        openingStock: { milk: 0, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
        purchases: { milk: 0, snacks: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
        sales: { regularCups: 0, specialCups: 0, kulhadCups: 0, vegMomoPackets: 0, paneerMomoPackets: 0, snacks: 0 },
        payments: { upi: 0, cash: 0 },
        closingStock: { milk: 0, sugar: 0, teaLeaves: 0, cups: 0, kulhadCups: 0, vegMomoPackets: 0, paneerMomoPackets: 0 },
      };
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
    },
    setSyncPending: (state, action: PayloadAction<boolean>) => {
      state.syncPending = action.payload;
    },
    preFillFromTally: (state, action: PayloadAction<TallyData>) => {
      if (!state.currentDraft) return;
      const tally = action.payload;
      // Map tally counters to known sales fields
      const salesPatch: Record<string, number> = {};
      Object.entries(tally.counters).forEach(([key, count]) => {
        const field = ITEM_KEY_TO_SALES_FIELD[key];
        if (field) salesPatch[field] = count;
      });
      state.currentDraft.sales = {
        ...(state.currentDraft.sales || {}),
        ...salesPatch,
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
      });
  },
});

export const {
  startNewReport, updateDraftSection, addPhoto,
  setStep, clearDraft, setSyncPending, preFillFromTally,
} = reportSlice.actions;
export default reportSlice.reducer;
