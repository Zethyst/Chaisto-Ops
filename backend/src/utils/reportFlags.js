// Not every flag comes from the report's own figures. The GPS check happens at
// submission, and the UPI check compares the report against payments the staff
// phone recorded — both are decided outside the anti-cheat pass, which sees
// only the numbers. Since that pass runs on every save and rewrites `flags`,
// these have to be carried across a recompute explicitly or they vanish.
const EXTERNAL_FLAG_TYPES = ['location_mismatch', 'upi_undeclared'];

const isExternal = (flag) => EXTERNAL_FLAG_TYPES.includes(flag?.type);

/** Keeps the externally-decided flags, and takes the rest from the recompute. */
function mergeFlags(existing = [], computed = []) {
  return [
    ...(existing || []).filter(isExternal),
    ...(computed || []).filter((f) => !isExternal(f)),
  ];
}

/**
 * A high-severity flag means flagged, whatever the figures alone concluded —
 * a report can reconcile perfectly and still have been filed from the wrong
 * place, or leave out money the phone saw arrive.
 */
function statusForFlags(flags = [], computedStatus = 'submitted') {
  return flags.some((f) => f.severity === 'high') ? 'flagged' : computedStatus;
}

/**
 * Puts an external flag on a report, replacing any earlier one of the same
 * type — a re-check states the current position rather than adding to a pile.
 * Passing no flag clears the type.
 */
function replaceFlag(flags = [], type, flag = null) {
  const rest = (flags || []).filter((f) => f.type !== type);
  return flag ? [...rest, flag] : rest;
}

module.exports = { EXTERNAL_FLAG_TYPES, mergeFlags, statusForFlags, replaceFlag };
