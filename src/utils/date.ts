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

/**
 * A date as a person would say it: "Today", "Yesterday", or "Sat, 6 Sep" —
 * with the year only when it is not the current one, since a year on every
 * label is noise for a list that is almost always about this week.
 *
 * @param iso - a YYYY-MM-DD date, as stored on reports, expenses and wastage
 */
export function friendlyDate(iso: string, today: Date = new Date()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return iso || '';

  if (iso === toISODate(today)) return 'Today';

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === toISODate(yesterday)) return 'Yesterday';

  // Parsed as local midday so a timezone offset cannot roll it onto another day
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);

  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(y === today.getFullYear() ? {} : { year: 'numeric' }),
  });
}
