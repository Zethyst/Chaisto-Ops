// Chai brewing constants for anti-cheat.
// Kept in its own file (no React Native imports) so pure calculation logic
// that depends on it — see src/store/slices/antiCheatCalc.ts — stays unit
// testable without mocking native modules.
export const BREW_CONSTANTS = {
  ML_PER_CUP: 130,           // ml of milk per cup (cutting chai ~100-150ml)
  CUPS_PER_LITRE: 7.5,       // approx cups per litre of milk
  MIN_PRICE_REGULAR: 10,     // ₹ minimum per cup
  MAX_PRICE_REGULAR: 30,     // ₹ maximum per cup
  UPI_MIN_RATIO: 0.2,        // at least 20% via UPI expected
  SALES_DROP_THRESHOLD: 0.5, // 50% drop vs 7-day avg = suspicious
  LOCATION_RADIUS_METERS: 200, // allowed distance from stall GPS
};
