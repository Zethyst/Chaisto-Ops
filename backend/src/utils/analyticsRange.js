const mongoose = require('mongoose');

// Which reports an analytics query covers.
//
// Two ways of asking, and they mean different things. A rolling window (`days`)
// asks "what has come in lately" and is measured from when a report was
// submitted. A calendar month (`month`) asks "how did September do" and is
// measured on the day each report covers — a report an admin backfills in
// October for a day in September belongs to September, which is also how the
// expense and wastage months are counted, so the P&L lines up.

const MONTH = /^\d{4}-\d{2}$/;

/**
 * @param {{ stallId?: string, days?: number|string, month?: string }} query
 * @param {Date} [now]
 * @returns {object} a Mongo match for the Report collection
 */
function analyticsMatch({ stallId, days = 30, month } = {}, now = new Date()) {
  const match = {};

  if (MONTH.test(month || '')) {
    // Dates are YYYY-MM-DD strings, so a prefix range compares lexically and
    // keeps the {stallId, date} index usable. "-31" covers every month's end.
    match.date = { $gte: `${month}-01`, $lte: `${month}-31` };
  } else {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - (parseInt(days, 10) || 30));
    match.submittedAt = { $gte: cutoff };
  }

  // Mongoose 8 refuses ObjectId without `new`
  if (stallId) match.stallId = new mongoose.Types.ObjectId(stallId);

  return match;
}

module.exports = { analyticsMatch };
