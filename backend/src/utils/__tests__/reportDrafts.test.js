const { draftAsReport, figureSections, recomputeDraft } = require('../reportDrafts');

const draftDoc = (overrides = {}) => ({
  _id: 'draft123',
  date: '2026-09-04',
  staffId: { _id: 'staff1', name: 'Ravi' },
  stallId: { _id: 'stall1', name: 'Sector 17' },
  createdAt: '2026-09-04T15:06:04.491Z',
  updatedAt: '2026-09-04T18:01:41.307Z',
  data: {
    id: 'draft_1788534361026',
    staffId: 'staff1',
    stallId: 'stall1',
    staffName: '',
    date: '2026-09-04',
    status: 'draft',
    sales: { regularCups: 30 },
    payments: { upi: 300, cash: 150 },
  },
  ...overrides,
});

describe('draftAsReport', () => {
  it('addresses the draft by its own id, not the client-generated one', () => {
    const shaped = draftAsReport(draftDoc());
    expect(shaped._id).toBe('draft123');
    expect(shaped.id).toBe('draft123');
  });

  it('marks it as an unfinished report with no submission time', () => {
    const shaped = draftAsReport(draftDoc());
    expect(shaped.isDraft).toBe(true);
    expect(shaped.status).toBe('draft');
    expect(shaped.submittedAt).toBeNull();
    expect(shaped.updatedAt).toBe('2026-09-04T18:01:41.307Z');
  });

  it('falls back to the populated user when the draft carries no staff name', () => {
    expect(draftAsReport(draftDoc()).staffName).toBe('Ravi');
  });

  it('keeps a staff name the draft did record', () => {
    const doc = draftDoc();
    doc.data.staffName = 'Ravi Kumar';
    expect(draftAsReport(doc).staffName).toBe('Ravi Kumar');
  });

  it('says so when neither the draft nor the reference names the staff member', () => {
    expect(draftAsReport(draftDoc({ staffId: 'staff1' })).staffName).toBe('Unknown');
  });

  it('reads ids and names off unpopulated refs without inventing names', () => {
    const shaped = draftAsReport(draftDoc({ staffId: 'staff1', stallId: 'stall1' }));
    expect(shaped.staffId).toBe('staff1');
    expect(shaped.stallId).toBe('stall1');
    expect(shaped.stallName).toBeUndefined();
  });

  it('carries the figures through untouched', () => {
    expect(draftAsReport(draftDoc()).sales).toEqual({ regularCups: 30 });
  });

  it('falls back to the stall recorded inside the draft when the ref is missing', () => {
    expect(draftAsReport(draftDoc({ stallId: undefined })).stallId).toBe('stall1');
  });
});

describe('figureSections', () => {
  it('defaults every editable section, so a half-filled draft still computes', () => {
    expect(figureSections({ sales: { regularCups: 30 } })).toEqual({
      openingStock: {}, purchases: {}, sales: { regularCups: 30 }, payments: {}, closingStock: {},
    });
  });
});

describe('recomputeDraft', () => {
  const filled = {
    staffName: 'Ravi',
    openingStock: { milk: 5, vegMomoPackets: 10, paneerMomoPackets: 10 },
    purchases: { milk: 0 },
    closingStock: { milk: 1, vegMomoPackets: 4, paneerMomoPackets: 4 },
    sales: { regularCups: 30, vegMomoPackets: 6, paneerMomoPackets: 6 },
    payments: { upi: 300, cash: 150 },
  };

  it('recomputes the metrics from the draft figures', () => {
    const result = recomputeDraft(filled);
    expect(result.computed.totalRevenue).toBe(450);
    expect(result.flags).toEqual([]);
  });

  it('stays a draft even when the figures would flag a submitted report', () => {
    const result = recomputeDraft({ ...filled, sales: { ...filled.sales, regularCups: 90 } });
    expect(result.flags.length).toBeGreaterThan(0);
    expect(result.status).toBe('draft');
  });

  it('leaves everything outside the figures alone', () => {
    expect(recomputeDraft(filled).staffName).toBe('Ravi');
  });
});
