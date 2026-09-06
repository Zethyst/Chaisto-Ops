/**
 * Human names for the figures on a report.
 *
 * The edit history records changes as `section.field` — the shape the server
 * stores and the API speaks. Showing that to an admin ("purchases.vegMomoPackets:
 * 0 → 4.166666666666667") asks them to read a schema. These are the same words
 * the entry form uses, so a change reads as the thing that changed.
 */

export interface FieldLabel {
  label: string;
  /** The stored unit, matching what the report screens display */
  unit?: string;
}

const FIELDS: Record<string, FieldLabel> = {
  'sales.regularCups': { label: 'Regular chai sold', unit: 'cups' },
  'sales.specialCups': { label: 'Special chai sold', unit: 'cups' },
  'sales.kulhadCups': { label: 'Kulhad chai sold', unit: 'cups' },
  'sales.vegMomoPackets': { label: 'Veg momos sold', unit: 'plates' },
  'sales.paneerMomoPackets': { label: 'Paneer momos sold', unit: 'plates' },
  'sales.friedVegMomoPackets': { label: 'Fried veg momos sold', unit: 'plates' },
  'sales.friedPaneerMomoPackets': { label: 'Fried paneer momos sold', unit: 'plates' },
  'sales.springRolls': { label: 'Spring rolls sold', unit: 'plates' },
  'sales.maggi': { label: 'Maggi sold', unit: 'plates' },
  'sales.snacks': { label: 'Snacks sold', unit: '₹' },
  'sales.cigarettes': { label: 'Cigarettes sold', unit: '₹' },

  'payments.upi': { label: 'UPI collected', unit: '₹' },
  'payments.cash': { label: 'Cash collected', unit: '₹' },

  'purchases.milk': { label: 'Milk purchased', unit: 'L' },
  'purchases.vegMomoPackets': { label: 'Veg momos purchased', unit: 'plates' },
  'purchases.paneerMomoPackets': { label: 'Paneer momos purchased', unit: 'plates' },
  'purchases.springRolls': { label: 'Spring rolls purchased', unit: 'plates' },
  'purchases.maggi': { label: 'Maggi purchased', unit: 'plates' },
  'purchases.snacks': { label: 'Snacks purchased', unit: '₹' },
  'purchases.cigarettes': { label: 'Cigarettes purchased', unit: '₹' },

  'openingStock.milk': { label: 'Opening milk', unit: 'L' },
  'openingStock.cups': { label: 'Opening paper cups', unit: '' },
  'openingStock.kulhadCups': { label: 'Opening kulhad cups', unit: '' },
  'openingStock.vegMomoPackets': { label: 'Opening veg momos', unit: 'plates' },
  'openingStock.paneerMomoPackets': { label: 'Opening paneer momos', unit: 'plates' },
  'openingStock.springRolls': { label: 'Opening spring rolls', unit: 'plates' },
  'openingStock.maggi': { label: 'Opening maggi', unit: 'plates' },
  'openingStock.sugar': { label: 'Opening sugar', unit: 'kg' },
  'openingStock.teaLeaves': { label: 'Opening tea leaves', unit: 'g' },

  'closingStock.milk': { label: 'Closing milk', unit: 'L' },
  'closingStock.cups': { label: 'Closing paper cups', unit: '' },
  'closingStock.kulhadCups': { label: 'Closing kulhad cups', unit: '' },
  'closingStock.vegMomoPackets': { label: 'Closing veg momos', unit: 'plates' },
  'closingStock.paneerMomoPackets': { label: 'Closing paneer momos', unit: 'plates' },
  'closingStock.springRolls': { label: 'Closing spring rolls', unit: 'plates' },
  'closingStock.maggi': { label: 'Closing maggi', unit: 'plates' },
  'closingStock.sugar': { label: 'Closing sugar', unit: 'kg' },
  'closingStock.teaLeaves': { label: 'Closing tea leaves', unit: 'g' },
};

/**
 * A field added after this map was written still has to read as something, so
 * an unknown key falls back to its own words rather than disappearing:
 * `sales.newThing` → "Sales · new thing".
 */
export function fieldLabel(field: string): FieldLabel {
  const known = FIELDS[field];
  if (known) return known;

  const [section, name = ''] = field.split('.');
  const spaced = name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
  const sectionName = section
    ? section.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
    : '';

  return { label: spaced ? `${sectionName} · ${spaced.toLowerCase()}` : field };
}
