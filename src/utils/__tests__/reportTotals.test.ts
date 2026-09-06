import { momoPlatesSold, snackPlatesSold, cupsSold } from '../reportTotals';

describe('momoPlatesSold', () => {
  it('counts fried plates alongside steamed ones', () => {
    // They come out of the same stock, so the stock check has to see both
    expect(momoPlatesSold({
      vegMomoPackets: 2, paneerMomoPackets: 1,
      friedVegMomoPackets: 1.5, friedPaneerMomoPackets: 0.5,
    } as any)).toBe(5);
  });

  it('reads a report filed before fried momos existed', () => {
    expect(momoPlatesSold({ vegMomoPackets: 2, paneerMomoPackets: 1 } as any)).toBe(3);
  });

  it('is zero for a day with no momos, and for no sales at all', () => {
    expect(momoPlatesSold({ regularCups: 10 } as any)).toBe(0);
    expect(momoPlatesSold(undefined)).toBe(0);
  });

  it('keeps half plates fractional', () => {
    expect(momoPlatesSold({ vegMomoPackets: 0.5, friedVegMomoPackets: 0.5 } as any)).toBe(1);
  });
});

describe('snackPlatesSold', () => {
  it('counts spring rolls and maggi together', () => {
    expect(snackPlatesSold({ springRolls: 3, maggi: 2 } as any)).toBe(5);
  });

  it('stays out of the momo total, since it has no stock behind it', () => {
    const sales = { springRolls: 3, maggi: 2, vegMomoPackets: 1 } as any;
    expect(momoPlatesSold(sales)).toBe(1);
    expect(snackPlatesSold(sales)).toBe(5);
  });

  it('is zero on an older report', () => {
    expect(snackPlatesSold({ vegMomoPackets: 1 } as any)).toBe(0);
  });
});

describe('cupsSold', () => {
  it('adds the three kinds of chai', () => {
    expect(cupsSold({ regularCups: 10, specialCups: 5, kulhadCups: 2 } as any)).toBe(17);
  });

  it('does not count a plate as a cup', () => {
    expect(cupsSold({ regularCups: 10, springRolls: 4, vegMomoPackets: 2 } as any)).toBe(10);
  });
});
