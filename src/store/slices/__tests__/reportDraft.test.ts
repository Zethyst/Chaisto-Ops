// reportSlice pulls in the API service, which reaches for native modules at
// import time — stub it and drive the thunks through the mocked service.
jest.mock('../../../services/reportService', () => ({
  reportService: {
    getDraft: jest.fn(),
    saveDraft: jest.fn(),
    addReportPhoto: jest.fn(),
    submitReport: jest.fn(),
    queueOfflineReport: jest.fn(),
  },
}));
jest.mock('../../../services/stallConfigService', () => ({ stallConfigService: {} }));

import reducer, {
  startNewReport, clearDraft, updateDraftSection,
  saveDraftRemote, resumeOrStartReport, attachReportPhoto, fetchReports,
} from '../reportSlice';
import { reportService } from '../../../services/reportService';

const svc = reportService as jest.Mocked<any>;
const today = () => new Date().toISOString().split('T')[0];

const withDraft = () => reducer(
  undefined,
  startNewReport({ staffId: 's1', stallId: 'st1', stallName: 'Stall' }),
);

const dispatchThunk = async (thunk: any, state: any) => {
  const actions: any[] = [];
  const dispatch = (a: any) => (typeof a === 'function' ? a(dispatch, () => state, undefined) : (actions.push(a), a));
  await thunk(dispatch, () => state, undefined);
  return actions;
};

beforeEach(() => jest.clearAllMocks());

describe('draft autosave state', () => {
  it('starts idle and reports a successful save', () => {
    let s = withDraft();
    expect(s.draftSaveState).toBe('idle');

    s = reducer(s, { type: saveDraftRemote.pending.type });
    expect(s.draftSaveState).toBe('saving');

    s = reducer(s, { type: saveDraftRemote.fulfilled.type, payload: '2026-09-03T10:00:00.000Z' });
    expect(s.draftSaveState).toBe('saved');
    expect(s.draftSavedAt).toBe('2026-09-03T10:00:00.000Z');
  });

  it('flags a failed save without discarding the local draft', () => {
    let s = reducer(withDraft(), { type: saveDraftRemote.rejected.type, payload: 'offline' });
    expect(s.draftSaveState).toBe('error');
    expect(s.currentDraft).not.toBeNull();
  });

  it('clears save state when the draft is cleared', () => {
    let s = reducer(withDraft(), { type: saveDraftRemote.fulfilled.type, payload: 'x' });
    s = reducer(s, clearDraft());
    expect(s.draftSaveState).toBe('idle');
    expect(s.draftSavedAt).toBeNull();
  });

  it('sends the whole current draft, including photo URLs', async () => {
    let s = withDraft();
    s = reducer(s, updateDraftSection({ section: 'sales', data: { regularCups: 12 } }));
    svc.saveDraft.mockResolvedValue('2026-09-03T10:00:00.000Z');

    await dispatchThunk(saveDraftRemote(), { reports: s });

    expect(svc.saveDraft).toHaveBeenCalledTimes(1);
    const sent = svc.saveDraft.mock.calls[0][0];
    expect(sent.sales.regularCups).toBe(12);
    expect(sent.photos).toEqual({ cash: '', stock: '', milkPacket: '', cartClosing: '' });
    expect(sent.date).toBe(today());
  });
});

describe('resumeOrStartReport', () => {
  it("keeps today's local draft and does not hit the server", async () => {
    const s = reducer(withDraft(), updateDraftSection({ section: 'sales', data: { regularCups: 7 } }));

    const actions = await dispatchThunk(
      resumeOrStartReport({ staffId: 's1', stallId: 'st1', stallName: 'Stall' }),
      { reports: s },
    );

    expect(svc.getDraft).not.toHaveBeenCalled();
    const done = actions.find(a => a.type === resumeOrStartReport.fulfilled.type);
    expect(done.payload.resumed).toBe(false);
    expect(done.payload.draft.sales.regularCups).toBe(7);
  });

  it('restores the autosaved server draft when there is no local one', async () => {
    const remote = { date: today(), sales: { regularCups: 40 }, photos: { cash: 'https://x/1.jpg' } };
    svc.getDraft.mockResolvedValue(remote);
    const empty = reducer(undefined, { type: '@@INIT' });

    const actions = await dispatchThunk(
      resumeOrStartReport({ staffId: 's1', stallId: 'st1', stallName: 'Stall' }),
      { reports: empty },
    );

    const done = actions.find(a => a.type === resumeOrStartReport.fulfilled.type);
    expect(done.payload.resumed).toBe(true);

    const s = reducer(empty, done);
    expect(s.currentDraft!.sales!.regularCups).toBe(40);
    expect(s.draftSaveState).toBe('saved');
  });

  it('starts a fresh report when the server has no draft', async () => {
    svc.getDraft.mockResolvedValue(null);
    const empty = reducer(undefined, { type: '@@INIT' });

    const actions = await dispatchThunk(
      resumeOrStartReport({ staffId: 's1', stallId: 'st1', stallName: 'Stall' }),
      { reports: empty },
    );

    const done = actions.find(a => a.type === resumeOrStartReport.fulfilled.type);
    expect(done.payload.resumed).toBe(false);
    expect(done.payload.draft.sales.regularCups).toBe(0);
    expect(done.payload.draft.date).toBe(today());
  });

  it('falls back to a fresh report when offline', async () => {
    svc.getDraft.mockRejectedValue(new Error('offline'));
    const empty = reducer(undefined, { type: '@@INIT' });

    const actions = await dispatchThunk(
      resumeOrStartReport({ staffId: 's1', stallId: 'st1', stallName: 'Stall' }),
      { reports: empty },
    );

    const done = actions.find(a => a.type === resumeOrStartReport.fulfilled.type);
    expect(done.payload.draft.staffId).toBe('s1');
  });

  it('replaces a stale draft left over from a previous day', async () => {
    const stale = withDraft();
    stale.currentDraft!.date = '2026-09-01';
    svc.getDraft.mockResolvedValue(null);

    const actions = await dispatchThunk(
      resumeOrStartReport({ staffId: 's1', stallId: 'st1', stallName: 'Stall' }),
      { reports: stale },
    );

    const done = actions.find(a => a.type === resumeOrStartReport.fulfilled.type);
    expect(done.payload.draft.date).toBe(today());
  });
});

describe('attachReportPhoto', () => {
  it('replaces the submitted report with the version carrying the new photo', () => {
    const updated = { _id: 'r1', photos: { cartClosing: 'https://x/cart.jpg' } } as any;
    let s = reducer(undefined, {
      type: fetchReports.fulfilled.type,
      payload: [{ _id: 'r1', photos: {} }],
    });

    s = reducer(s, { type: attachReportPhoto.fulfilled.type, payload: updated });

    expect(s.todayReport!.photos.cartClosing).toBe('https://x/cart.jpg');
    expect((s.reports[0] as any).photos.cartClosing).toBe('https://x/cart.jpg');
  });
});
