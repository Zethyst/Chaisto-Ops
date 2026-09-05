import { datesInMonth, defaultDayFor, recentDates } from '../DateStrip';

// Pin "today" so the current-month capping is deterministic
const FIXED_NOW = new Date(2026, 8, 3, 12, 0, 0); // 3 September 2026

beforeAll(() => { jest.useFakeTimers().setSystemTime(FIXED_NOW); });
afterAll(() => { jest.useRealTimers(); });

describe('datesInMonth', () => {
  it('offers every day of a past month, newest first', () => {
    const days = datesInMonth('2026-08');
    expect(days).toHaveLength(31);
    expect(days[0].value).toBe('2026-08-31');
    expect(days[days.length - 1].value).toBe('2026-08-01');
  });

  it('stops at today for the current month — you cannot log ahead', () => {
    const days = datesInMonth('2026-09');
    expect(days).toHaveLength(3);
    expect(days[0].value).toBe('2026-09-03');
    expect(days[0].isToday).toBe(true);
    expect(days[days.length - 1].value).toBe('2026-09-01');
  });

  it('handles a short month', () => {
    expect(datesInMonth('2026-02')).toHaveLength(28);
    expect(datesInMonth('2026-04')).toHaveLength(30);
  });

  it('handles a leap February', () => {
    expect(datesInMonth('2024-02')).toHaveLength(29);
  });

  it('marks only today as today', () => {
    expect(datesInMonth('2026-08').some(d => d.isToday)).toBe(false);
  });
});

describe('defaultDayFor', () => {
  it('defaults a past month to its last day', () => {
    expect(defaultDayFor('2026-08')).toBe('2026-08-31');
  });

  it('defaults the current month to today, not the 30th', () => {
    expect(defaultDayFor('2026-09')).toBe('2026-09-03');
  });
});

describe('recentDates', () => {
  it('counts back from today, newest first', () => {
    const days = recentDates(5);
    expect(days.map(d => d.value)).toEqual([
      '2026-09-03', '2026-09-02', '2026-09-01', '2026-08-31', '2026-08-30',
    ]);
  });
});
