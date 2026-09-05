// Whether a staff phone is actually recording payments, as opposed to having
// been told to.
//
// The two come apart on aggressive Android builds — MIUI on Redmi phones above
// all — where the permission stays granted while the system kills the listener
// service. A phone in that state reports a clean, quiet day that looks exactly
// like an honest one, which is the worst possible failure for this feature. So
// the phone reports both what it was granted and whether the service is bound,
// and a phone that has simply stopped checking in is treated as not reporting
// either.

// Staff open the app at least once a shift, so a phone silent for longer than
// this has stopped syncing rather than merely being idle.
const STALE_AFTER_HOURS = 18;

/**
 * @param {{ enabled?: boolean, listenerConnected?: boolean, lastSyncAt?: Date|string|null }} state
 * @param {Date} [now]
 * @returns {'reporting'|'blocked'|'killed'|'stale'|'never'}
 */
function captureHealth(state, now = new Date()) {
  if (!state || !state.lastSyncAt) return 'never';
  if (!state.enabled) return 'blocked';

  const hoursSince = (now.getTime() - new Date(state.lastSyncAt).getTime()) / 36e5;
  if (hoursSince > STALE_AFTER_HOURS) return 'stale';

  // Granted, checking in, but Android is not running the service
  if (state.listenerConnected === false) return 'killed';

  return 'reporting';
}

/** Whether captures from this phone can be trusted to be complete. */
const isReporting = (state, now) => captureHealth(state, now) === 'reporting';

const HEALTH_LABELS = {
  reporting: 'Recording',
  blocked: 'Switched off',
  killed: 'Stopped by the phone',
  stale: 'Not checked in',
  never: 'Never set up',
};

module.exports = { captureHealth, isReporting, HEALTH_LABELS, STALE_AFTER_HOURS };
