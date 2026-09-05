// Diffing of a report's editable figures, shared by the submitted-report edit
// and the draft edit so the two cannot drift apart on which fields an admin is
// allowed to touch or on what counts as a change.

// Only the numbers are editable. Who reported it, when, the photos and the GPS
// are the evidence trail and stay fixed.
const EDITABLE_SECTIONS = ['openingStock', 'purchases', 'sales', 'payments', 'closingStock'];

/**
 * @param {object} body - request body, shaped { sales: { regularCups: 12 }, ... }
 * @param {(section: string, field: string) => number|undefined} getCurrent - reads the stored value
 * @param {string[]} [sections] - sections to consider
 * @returns {{ section: string, field: string, from: number, to: number }[]} only real changes
 */
function diffFigures(body, getCurrent, sections = EDITABLE_SECTIONS) {
  const changes = [];

  sections.forEach((section) => {
    const incoming = body?.[section];
    if (!incoming || typeof incoming !== 'object') return;

    Object.entries(incoming).forEach(([field, rawValue]) => {
      const value = Number(rawValue);
      // Anything unparseable or negative is a client bug, not an edit — ignore
      // it rather than writing nonsense over a figure the staff entered
      if (!Number.isFinite(value) || value < 0) return;

      const previous = getCurrent(section, field) ?? 0;
      if (previous === value) return;

      changes.push({ section, field, from: previous, to: value });
    });
  });

  return changes;
}

/** Formats changes for the `editHistory` trail kept on a report or draft. */
function asEditHistory(changes) {
  return changes.map(({ section, field, from, to }) => ({ field: `${section}.${field}`, from, to }));
}

module.exports = { EDITABLE_SECTIONS, diffFigures, asEditHistory };
