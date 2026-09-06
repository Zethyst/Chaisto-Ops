/**
 * Formats a counted quantity for display.
 *
 * Momos are stored in plate-equivalents and milk in litres, so a third of a
 * packet is 0.8333333333333334 and five sixths is 4.166666666666667. Printing
 * those raw filled a stat tile with digits and pushed the layout apart, which
 * is what this exists to stop. Two decimals is finer than anyone counts, and a
 * whole number stays whole rather than gaining a ".00".
 */
export function qty(value: number | null | undefined, decimals = 2): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';

  const factor = 10 ** decimals;
  const rounded = Math.round(n * factor) / factor;

  // Integers print bare; the rest drop any trailing zeros ("2.50" → "2.5")
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/** The same, with thousands separators — for money and large counts. */
export function qtyWithCommas(value: number | null | undefined, decimals = 2): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';

  const factor = 10 ** decimals;
  const rounded = Math.round(n * factor) / factor;
  return rounded.toLocaleString('en-IN', { maximumFractionDigits: decimals });
}
