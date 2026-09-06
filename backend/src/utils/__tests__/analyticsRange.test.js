const { analyticsMatch } = require('../analyticsRange');

const now = new Date('2026-09-06T12:00:00.000Z');

describe('a calendar month', () => {
  it('covers the whole month, on the day each report is about', () => {
    expect(analyticsMatch({ month: '2026-09' }, now).date).toEqual({
      $gte: '2026-09-01', $lte: '2026-09-31',
    });
  });

  it('does not measure from when the report was submitted', () => {
    // A report backfilled in October for a day in September is September's
    expect(analyticsMatch({ month: '2026-09' }, now).submittedAt).toBeUndefined();
  });

  it('covers the last day of a short month', () => {
    const { date } = analyticsMatch({ month: '2026-02' }, now);
    expect('2026-02-28' >= date.$gte && '2026-02-28' <= date.$lte).toBe(true);
  });

  it('keeps the neighbouring months out', () => {
    const { date } = analyticsMatch({ month: '2026-09' }, now);
    expect('2026-08-31' >= date.$gte).toBe(false);
    expect('2026-10-01' <= date.$lte).toBe(false);
  });

  it('separates months that would otherwise share a rolling window', () => {
    // The bug this fixes: every month showed the same figures
    const september = analyticsMatch({ month: '2026-09' }, now);
    const august = analyticsMatch({ month: '2026-08' }, now);
    expect(september.date).not.toEqual(august.date);
  });
});

describe('a rolling window', () => {
  it('measures back from now, on submission time', () => {
    const { submittedAt } = analyticsMatch({ days: 7 }, now);
    expect(submittedAt.$gte.toISOString()).toBe('2026-08-30T12:00:00.000Z');
  });

  it('defaults to 30 days when nothing is asked for', () => {
    const { submittedAt } = analyticsMatch({}, now);
    expect(submittedAt.$gte.toISOString()).toBe('2026-08-07T12:00:00.000Z');
  });

  it('accepts the days a query string delivers as text', () => {
    const { submittedAt } = analyticsMatch({ days: '7' }, now);
    expect(submittedAt.$gte.toISOString()).toBe('2026-08-30T12:00:00.000Z');
  });

  it('falls back to the window when the month is malformed', () => {
    const match = analyticsMatch({ month: 'September', days: 7 }, now);
    expect(match.date).toBeUndefined();
    expect(match.submittedAt).toBeDefined();
  });

  it('does not let a bad days value collapse the window to nothing', () => {
    const { submittedAt } = analyticsMatch({ days: 'lots' }, now);
    expect(submittedAt.$gte.toISOString()).toBe('2026-08-07T12:00:00.000Z');
  });
});

describe('stall filter', () => {
  it('casts the stall id, which Mongoose 8 refuses without `new`', () => {
    const match = analyticsMatch({ stallId: '6a10e030227c35a317709f8a', month: '2026-09' }, now);
    expect(match.stallId.toString()).toBe('6a10e030227c35a317709f8a');
  });

  it('leaves the filter off when no stall is named', () => {
    expect(analyticsMatch({ month: '2026-09' }, now).stallId).toBeUndefined();
  });
});
