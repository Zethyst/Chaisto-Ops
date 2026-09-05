import { shiftMonth, monthLabel } from '../MonthNavigator';

describe('shiftMonth', () => {
  it('steps back within a year', () => {
    expect(shiftMonth('2026-09', -1)).toBe('2026-08');
  });

  it('rolls back across the year boundary', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('rolls forward across the year boundary', () => {
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
  });

  it('zero-pads single-digit months', () => {
    expect(shiftMonth('2026-10', -1)).toBe('2026-09');
    expect(shiftMonth('2026-02', -1)).toBe('2026-01');
  });

  it('steps multiple months at once', () => {
    expect(shiftMonth('2026-03', -6)).toBe('2025-09');
  });
});

describe('monthLabel', () => {
  it('renders a readable month and year', () => {
    expect(monthLabel('2026-09')).toBe('September 2026');
    expect(monthLabel('2025-12')).toBe('December 2025');
  });
});
