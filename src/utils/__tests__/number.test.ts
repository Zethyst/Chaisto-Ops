import { qty, qtyWithCommas } from '../number';

describe('qty', () => {
  it('trims the float noise that plate-equivalents produce', () => {
    // Five sixths of a plate, as stored — this was printed in full on a stat tile
    expect(qty(4.166666666666667)).toBe('4.17');
    expect(qty(8.333333333333334)).toBe('8.33');
    expect(qty(0.8333333333333334)).toBe('0.83');
  });

  it('leaves whole numbers whole', () => {
    expect(qty(25)).toBe('25');
    expect(qty(0)).toBe('0');
  });

  it('does not pad a short decimal with zeros', () => {
    expect(qty(2.5)).toBe('2.5');
    expect(qty(10.5)).toBe('10.5');
  });

  it('drops a decimal that rounds away', () => {
    expect(qty(2.999999)).toBe('3');
    expect(qty(0.001)).toBe('0');
  });

  it('takes a different precision when asked', () => {
    expect(qty(4.166666666666667, 1)).toBe('4.2');
    expect(qty(4.166666666666667, 0)).toBe('4');
  });

  it('keeps negatives intact', () => {
    expect(qty(-1.005)).toBe('-1');
    expect(qty(-4.166666666666667)).toBe('-4.17');
  });

  it('reads a missing or unusable value as zero rather than NaN', () => {
    expect(qty(undefined)).toBe('0');
    expect(qty(null)).toBe('0');
    expect(qty(NaN)).toBe('0');
    expect(qty(Infinity)).toBe('0');
  });
});

describe('qtyWithCommas', () => {
  it('groups large numbers the Indian way', () => {
    expect(qtyWithCommas(125000)).toBe('1,25,000');
  });

  it('still rounds the float noise', () => {
    expect(qtyWithCommas(4.166666666666667)).toBe('4.17');
  });
});
