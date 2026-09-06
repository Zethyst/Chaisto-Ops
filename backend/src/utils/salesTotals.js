// How a day's momo plates are counted, in one place.
//
// Fried momos are the same momos fried to order: same stock, same plate
// measure, different price. Every total that means "momo plates sold" has to
// include them, or the stall looks like it lost stock every time it fried some
// and the staff member is paid incentive on only half of what they served.
//
// `$ifNull` matters — reports written before fried momos existed have no such
// field, and `$add` with a missing value yields null rather than skipping it.

const MOMO_PLATE_FIELDS = [
  '$sales.vegMomoPackets',
  '$sales.paneerMomoPackets',
  '$sales.friedVegMomoPackets',
  '$sales.friedPaneerMomoPackets',
];

/** Mongo aggregation expression for the momo plates a report sold. */
const momoPlatesExpr = () => ({
  $add: MOMO_PLATE_FIELDS.map((field) => ({ $ifNull: [field, 0] })),
});

/** The same total, for a plain report object. */
function momoPlatesSold(sales = {}) {
  return (sales.vegMomoPackets || 0)
    + (sales.paneerMomoPackets || 0)
    + (sales.friedVegMomoPackets || 0)
    + (sales.friedPaneerMomoPackets || 0);
}

module.exports = { momoPlatesExpr, momoPlatesSold, MOMO_PLATE_FIELDS };
