import { DailyReport } from '../types';

type Sales = Partial<DailyReport['sales']> | undefined;

/**
 * The day's totals, defined once.
 *
 * Which fields make up "momo plates" is a business fact that changed when fried
 * momos were added, and it is read in a dozen places — the stock check, the
 * incentive, every summary tile. Spread across those call sites, adding an item
 * means finding them all, and the one that gets missed silently under-reports.
 */

/**
 * Momo plates sold. Fried momos are the same momos fried to order: same stock,
 * same plate measure, so they belong in the same total.
 */
export function momoPlatesSold(sales: Sales): number {
  return (sales?.vegMomoPackets || 0)
    + (sales?.paneerMomoPackets || 0)
    + (sales?.friedVegMomoPackets || 0)
    + (sales?.friedPaneerMomoPackets || 0);
}

/**
 * Plate-served food that carries no stock of its own, so it stays out of the
 * momo reconciliation entirely.
 */
export function snackPlatesSold(sales: Sales): number {
  return (sales?.springRolls || 0) + (sales?.maggi || 0);
}

/** Chai, by the cup. */
export function cupsSold(sales: Sales): number {
  return (sales?.regularCups || 0) + (sales?.specialCups || 0) + (sales?.kulhadCups || 0);
}
