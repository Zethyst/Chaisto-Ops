import { fieldLabel } from '../reportFields';

describe('fieldLabel', () => {
  it('names a figure the way the entry form does', () => {
    expect(fieldLabel('sales.vegMomoPackets')).toEqual({ label: 'Veg momos sold', unit: 'plates' });
    expect(fieldLabel('purchases.milk')).toEqual({ label: 'Milk purchased', unit: 'L' });
    expect(fieldLabel('payments.upi')).toEqual({ label: 'UPI collected', unit: '₹' });
  });

  it('distinguishes the same item across sections', () => {
    expect(fieldLabel('openingStock.vegMomoPackets').label).toBe('Opening veg momos');
    expect(fieldLabel('closingStock.vegMomoPackets').label).toBe('Closing veg momos');
    expect(fieldLabel('purchases.vegMomoPackets').label).toBe('Veg momos purchased');
  });

  it('gives a countable item no unit of its own', () => {
    expect(fieldLabel('openingStock.cups').unit).toBe('');
  });

  it('still reads as words for a figure added since', () => {
    // A new field must not surface as a raw schema path
    expect(fieldLabel('sales.filterCoffee').label).toBe('Sales · filter coffee');
  });

  it('falls back to the key when there is nothing to split', () => {
    expect(fieldLabel('mystery').label).toBe('mystery');
  });
});
