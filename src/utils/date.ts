/**
 * Local-calendar date helpers.
 *
 * `new Date().toISOString().split('T')[0]` looks like "today" but is the date
 * in UTC. East of Greenwich that is yesterday for the first hours of the day —
 * in IST (+05:30), anything logged before 05:30 was being stamped with the
 * previous day. A chai stall closing out at 2 AM hit this every night.
 *
 * These format from local calendar fields instead, so the date always matches
 * the day the user is actually having.
 */

/** YYYY-MM-DD for a Date, in the device's own timezone. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today's date, YYYY-MM-DD, in the device's own timezone. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** YYYY-MM for a Date, in the device's own timezone. */
export function toISOMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** The current month, YYYY-MM, in the device's own timezone. */
export function currentMonthISO(): string {
  return toISOMonth(new Date());
}

/** `n` days before today, YYYY-MM-DD. */
export function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}
