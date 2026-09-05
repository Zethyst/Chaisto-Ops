const { mergeFlags, statusForFlags, replaceFlag } = require('../reportFlags');

const gpsFlag = { type: 'location_mismatch', severity: 'high', message: '400m from stall' };
const upiFlag = { type: 'upi_undeclared', severity: 'high', message: '₹400 unaccounted for' };
const milkFlag = { type: 'milk_mismatch', severity: 'medium', message: 'cups vs milk' };

describe('mergeFlags', () => {
  it('keeps the GPS flag across a recompute of the figures', () => {
    expect(mergeFlags([gpsFlag], [milkFlag])).toEqual([gpsFlag, milkFlag]);
  });

  it('keeps the UPI flag across a recompute of the figures', () => {
    expect(mergeFlags([upiFlag], [])).toEqual([upiFlag]);
  });

  it('drops the figure-derived flags the recompute no longer raises', () => {
    expect(mergeFlags([milkFlag], [])).toEqual([]);
  });

  it('takes the recompute as the truth for figure-derived flags', () => {
    const recomputed = { ...milkFlag, message: 'updated' };
    expect(mergeFlags([milkFlag], [recomputed])).toEqual([recomputed]);
  });

  it('copes with a report that has no flags yet', () => {
    expect(mergeFlags(undefined, [milkFlag])).toEqual([milkFlag]);
    expect(mergeFlags([gpsFlag], undefined)).toEqual([gpsFlag]);
  });
});

describe('statusForFlags', () => {
  it('flags a report carrying a high-severity flag, whatever the figures said', () => {
    expect(statusForFlags([gpsFlag], 'submitted')).toBe('flagged');
  });

  it('leaves the computed status alone when nothing is severe', () => {
    expect(statusForFlags([milkFlag], 'submitted')).toBe('submitted');
    expect(statusForFlags([], 'flagged')).toBe('flagged');
  });
});

describe('replaceFlag', () => {
  it('replaces an earlier flag of the same type rather than stacking them', () => {
    const updated = { ...upiFlag, message: '₹900 unaccounted for' };
    expect(replaceFlag([milkFlag, upiFlag], 'upi_undeclared', updated)).toEqual([milkFlag, updated]);
  });

  it('clears the type when the re-check finds nothing', () => {
    expect(replaceFlag([milkFlag, upiFlag], 'upi_undeclared')).toEqual([milkFlag]);
  });

  it('adds the flag when the report did not have one', () => {
    expect(replaceFlag([milkFlag], 'upi_undeclared', upiFlag)).toEqual([milkFlag, upiFlag]);
  });
});
