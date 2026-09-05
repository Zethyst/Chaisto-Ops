const { diffFigures, asEditHistory } = require('../reportEdits');

// Stands in for a stored report or draft
const stored = {
  sales: { regularCups: 30, snacks: 0 },
  payments: { upi: 300, cash: 150 },
  closingStock: { milk: 1 },
};
const get = (section, field) => stored[section]?.[field];

describe('diffFigures', () => {
  it('returns nothing when the incoming figures match what is stored', () => {
    expect(diffFigures({ sales: { regularCups: 30 }, payments: { upi: 300 } }, get)).toEqual([]);
  });

  it('names each change by section and field, with the previous value', () => {
    const changes = diffFigures({ sales: { regularCups: 24 }, payments: { cash: 200 } }, get);
    expect(changes).toEqual([
      { section: 'sales', field: 'regularCups', from: 30, to: 24 },
      { section: 'payments', field: 'cash', from: 150, to: 200 },
    ]);
  });

  it('treats a figure that was never stored as coming from zero', () => {
    expect(diffFigures({ sales: { cigarettes: 120 } }, get))
      .toEqual([{ section: 'sales', field: 'cigarettes', from: 0, to: 120 }]);
  });

  it('accepts numeric strings, since form inputs send text', () => {
    expect(diffFigures({ payments: { upi: '450' } }, get))
      .toEqual([{ section: 'payments', field: 'upi', from: 300, to: 450 }]);
  });

  it('ignores unparseable and negative values rather than writing them', () => {
    expect(diffFigures({ sales: { regularCups: 'abc', specialCups: -5 } }, get)).toEqual([]);
  });

  it('ignores sections that are not editable or not objects', () => {
    expect(diffFigures({ computed: { totalRevenue: 999 }, status: 'reviewed', sales: 42 }, get)).toEqual([]);
  });

  it('formats changes for the edit history trail', () => {
    expect(asEditHistory(diffFigures({ sales: { regularCups: 24 } }, get)))
      .toEqual([{ field: 'sales.regularCups', from: 30, to: 24 }]);
  });
});
