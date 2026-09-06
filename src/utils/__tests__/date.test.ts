import { toISODate, todayISO, toISOMonth, currentMonthISO, daysAgoISO, friendlyDate } from '../date';

describe('local-calendar dates', () => {
  it('formats a local midnight as that same day, not the day before', () => {
    // The UTC-based idiom returns 2026-09-02 for this in any positive offset
    expect(toISODate(new Date(2026, 8, 3))).toBe('2026-09-03');
  });

  it('zero-pads months and days', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('formats the last day of a month', () => {
    expect(toISODate(new Date(2026, 7, 31))).toBe('2026-08-31');
  });

  it('gives the month as YYYY-MM', () => {
    expect(toISOMonth(new Date(2026, 8, 3))).toBe('2026-09');
    expect(toISOMonth(new Date(2026, 0, 31))).toBe('2026-01');
  });
});

describe('relative to now', () => {
  const FIXED_NOW = new Date(2026, 8, 3, 2, 30); // 2:30 AM — the hour that broke

  beforeAll(() => { jest.useFakeTimers().setSystemTime(FIXED_NOW); });
  afterAll(() => { jest.useRealTimers(); });

  it('reports the calendar day the user is having at 2:30 AM', () => {
    expect(todayISO()).toBe('2026-09-03');
  });

  it('reports the current month', () => {
    expect(currentMonthISO()).toBe('2026-09');
  });

  it('counts days back across a month boundary', () => {
    expect(daysAgoISO(0)).toBe('2026-09-03');
    expect(daysAgoISO(3)).toBe('2026-08-31');
  });
});

describe('friendlyDate', () => {
  const today = new Date(2026, 8, 6); // 6 Sep 2026

  it('says Today and Yesterday rather than a date', () => {
    expect(friendlyDate('2026-09-06', today)).toBe('Today');
    expect(friendlyDate('2026-09-05', today)).toBe('Yesterday');
  });

  it('names the weekday for anything earlier this year', () => {
    expect(friendlyDate('2026-08-30', today)).toBe('Sun, 30 Aug');
  });

  it('adds the year only when it is not this one', () => {
    expect(friendlyDate('2025-12-25', today)).toContain('2025');
    expect(friendlyDate('2026-08-30', today)).not.toContain('2026');
  });

  it('does not roll onto the wrong day in a timezone behind UTC', () => {
    // Parsed at local midday, so no offset can shift the calendar day
    expect(friendlyDate('2026-08-30', today)).toContain('30');
  });

  it('passes through anything that is not a date', () => {
    expect(friendlyDate('')).toBe('');
    expect(friendlyDate('not-a-date')).toBe('not-a-date');
  });
});
