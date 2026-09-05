import {
  emptyFigures, figuresFrom, changedFigureFields as changedFields, ReportFigures,
} from '../ReportFiguresForm';

const seeded = (): ReportFigures => ({
  ...emptyFigures(),
  sales: { regularCups: 15, vegMomoPackets: 1.6, snacks: 0 },
  payments: { upi: 385, cash: 280 },
});

describe('report edit diffing', () => {
  it('reports nothing changed when the figures are untouched', () => {
    expect(changedFields(seeded(), seeded())).toEqual([]);
  });

  it('names each changed figure by section and field', () => {
    const edited = seeded();
    edited.sales = { ...edited.sales, regularCups: 11 };
    edited.payments = { ...edited.payments, cash: 300 };

    expect(changedFields(seeded(), edited).sort())
      .toEqual(['payments.cash', 'sales.regularCups']);
  });

  it('treats a field newly set from absent-as-zero as unchanged at zero', () => {
    const edited = seeded();
    edited.sales = { ...edited.sales, cigarettes: 0 };
    expect(changedFields(seeded(), edited)).toEqual([]);
  });

  it('catches a field going from absent to a real value', () => {
    const edited = seeded();
    edited.sales = { ...edited.sales, cigarettes: 240 };
    expect(changedFields(seeded(), edited)).toEqual(['sales.cigarettes']);
  });

  it('catches a fractional plate figure being corrected', () => {
    const edited = seeded();
    edited.sales = { ...edited.sales, vegMomoPackets: 4 };
    expect(changedFields(seeded(), edited)).toEqual(['sales.vegMomoPackets']);
  });
});
