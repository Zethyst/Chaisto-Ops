// The categories an expense can be filed under, in one place: the model enum
// and every route validator read from here, so adding one cannot leave a
// validator rejecting what the schema accepts.
const EXPENSE_CATEGORIES = [
  'gas',
  'supplies',
  'maintenance',
  'equipment',
  // Stock bought in for the day, split out from general supplies so the P&L
  // shows what the food actually costs
  'momos',
  'milk',
  'rolls',
  'water',
  'other',
];

module.exports = { EXPENSE_CATEGORIES };
