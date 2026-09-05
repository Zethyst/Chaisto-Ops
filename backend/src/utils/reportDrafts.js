// A ReportDraft is a report a staff member started and never submitted. The
// admin screens list drafts alongside the day's real reports, so a draft is
// reshaped here to look like one — same field names, same nesting — with
// `isDraft` marking that nothing has been filed yet.

const { computeAntiCheatMetrics } = require('./antiCheat');

const FIGURE_SECTIONS = ['openingStock', 'purchases', 'sales', 'payments', 'closingStock'];

/** Populated refs come back as documents; unpopulated ones as plain ids. */
const idOf = (ref) => (ref && ref._id ? ref._id : ref);
const nameOf = (ref) => (ref && ref.name ? ref.name : undefined);

/**
 * @param {object} draft - a ReportDraft document, optionally populated on staffId/stallId
 * @returns {object} the draft shaped like a DailyReport
 */
function draftAsReport(draft) {
  const data = draft.data || {};

  return {
    ...data,
    // The draft's own id, not the client-generated `draft_…` one inside data —
    // this is what the admin screens fetch and edit by
    _id: draft._id,
    id: draft._id,
    isDraft: true,
    status: 'draft',
    date: draft.date,
    staffId: idOf(draft.staffId),
    // A draft saved before the staff member's name was known carries an empty
    // one; the populated user is the reliable source
    staffName: data.staffName || nameOf(draft.staffId) || 'Unknown',
    stallId: idOf(draft.stallId) || data.stallId,
    stallName: nameOf(draft.stallId),
    submittedAt: null,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

/** The figure sections, defaulted, in the shape the anti-cheat pass expects. */
function figureSections(data) {
  return FIGURE_SECTIONS.reduce((acc, section) => {
    acc[section] = { ...(data[section] || {}) };
    return acc;
  }, {});
}

/**
 * Re-runs the anti-cheat pass over a draft's figures. A draft is never given a
 * submitted/flagged status — it has not been filed — but the flags are useful
 * to show while the numbers are still being corrected.
 */
function recomputeDraft(data) {
  const { computed, flags } = computeAntiCheatMetrics(figureSections(data));
  return { ...data, computed, flags, status: 'draft' };
}

module.exports = { draftAsReport, figureSections, recomputeDraft, FIGURE_SECTIONS };
