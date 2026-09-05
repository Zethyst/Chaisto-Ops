import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { DailyReport } from '../types';
import BufferedTextInput from './BufferedTextInput';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../constants';

export type FigureSection = 'openingStock' | 'purchases' | 'sales' | 'payments' | 'closingStock';
export type ReportFigures = Record<FigureSection, Record<string, number>>;

export const FIGURE_SECTIONS: FigureSection[] = [
  'openingStock', 'purchases', 'sales', 'payments', 'closingStock',
];

export const emptyFigures = (): ReportFigures => ({
  openingStock: {},
  purchases: {},
  sales: {},
  payments: {},
  closingStock: {},
});

/**
 * Pulls the editable numbers out of a submitted report or an unfinished draft,
 * in stored units. Anything non-numeric in the section (a stray string from an
 * older client) is left out rather than becoming NaN.
 */
export function figuresFrom(report: Partial<DailyReport> | null | undefined): ReportFigures {
  const figures = emptyFigures();
  if (!report) return figures;
  FIGURE_SECTIONS.forEach((section) => {
    const stored = (report as any)[section] || {};
    Object.entries(stored).forEach(([key, value]) => {
      if (typeof value === 'number' && Number.isFinite(value)) figures[section][key] = value;
    });
  });
  return figures;
}

/**
 * The figures that differ, named `section.field` — the same diff the edit
 * screens show and the server records. Compared in stored units, so a
 * display-only rounding difference is not a change.
 */
export function changedFigureFields(original: ReportFigures, form: ReportFigures): string[] {
  return FIGURE_SECTIONS.flatMap((section) =>
    Object.keys({ ...original[section], ...form[section] })
      .filter((key) => (original[section][key] ?? 0) !== (form[section][key] ?? 0))
      .map((key) => `${section}.${key}`)
  );
}

/**
 * The numeric body of a daily report, shared by the admin backfill and edit
 * screens so the two cannot drift apart on fields or units.
 *
 * Values are held in the report's stored units (milk in litres, momos in
 * plate-equivalents) and converted for display — staff count milk in packets
 * and momos in pieces.
 */
export default function ReportFiguresForm({ values, onChange }: {
  values: ReportFigures;
  onChange: (section: FigureSection, field: string, value: number) => void;
}) {
  const { milkMlPerPacket, momoPiecesPerPlate } = useSelector((s: RootState) => s.menu);
  const milkPacketsPerLitre = milkMlPerPacket > 0 ? 1000 / milkMlPerPacket : 2;
  const piecesPerPlate = momoPiecesPerPlate > 0 ? momoPiecesPerPlate : 1;

  const get = (section: FigureSection, field: string) => values[section]?.[field] ?? 0;

  // A render helper, deliberately not a component — a component declared here
  // would be a new type on every render, remounting each input and dropping
  // keyboard focus mid-entry.
  const field = (section: FigureSection, name: string, label: string, unit: string, factor?: number) => (
    <NumField
      key={`${section}.${name}`}
      label={label}
      unit={unit}
      value={factor ? get(section, name) * factor : get(section, name)}
      onChange={(v) => onChange(section, name, factor ? v / factor : v)}
    />
  );

  return (
    <>
      <Text style={styles.sectionTitle}>SALES</Text>
      <View style={styles.card}>
        {field('sales', 'regularCups', 'Regular chai', 'cups')}
        {field('sales', 'specialCups', 'Special chai', 'cups')}
        {field('sales', 'kulhadCups', 'Kulhad chai', 'cups')}
        {field('sales', 'vegMomoPackets', 'Veg momos', 'pieces', piecesPerPlate)}
        {field('sales', 'paneerMomoPackets', 'Paneer momos', 'pieces', piecesPerPlate)}
        {field('sales', 'snacks', 'Snacks sold', '₹')}
        {field('sales', 'cigarettes', 'Cigarettes sold', '₹')}
      </View>

      <Text style={styles.sectionTitle}>PAYMENTS COLLECTED</Text>
      <View style={styles.card}>
        {field('payments', 'upi', 'UPI', '₹')}
        {field('payments', 'cash', 'Cash', '₹')}
      </View>

      <Text style={styles.sectionTitle}>OPENING STOCK</Text>
      <View style={styles.card}>
        {field('openingStock', 'milk', 'Milk', 'packets', milkPacketsPerLitre)}
        {field('openingStock', 'cups', 'Paper cups', 'count')}
        {field('openingStock', 'kulhadCups', 'Kulhad cups', 'count')}
        {field('openingStock', 'vegMomoPackets', 'Veg momos', 'pieces', piecesPerPlate)}
        {field('openingStock', 'paneerMomoPackets', 'Paneer momos', 'pieces', piecesPerPlate)}
      </View>

      <Text style={styles.sectionTitle}>PURCHASES</Text>
      <View style={styles.card}>
        {field('purchases', 'milk', 'Milk purchased', 'packets', milkPacketsPerLitre)}
        {field('purchases', 'vegMomoPackets', 'Veg momos purchased', 'pieces', piecesPerPlate)}
        {field('purchases', 'paneerMomoPackets', 'Paneer momos purchased', 'pieces', piecesPerPlate)}
        {field('purchases', 'snacks', 'Snacks purchased', '₹')}
        {field('purchases', 'cigarettes', 'Cigarettes purchased', '₹')}
      </View>

      <Text style={styles.sectionTitle}>CLOSING STOCK</Text>
      <View style={styles.card}>
        {field('closingStock', 'milk', 'Milk remaining', 'packets', milkPacketsPerLitre)}
        {field('closingStock', 'cups', 'Paper cups remaining', 'count')}
        {field('closingStock', 'kulhadCups', 'Kulhad cups remaining', 'count')}
        {field('closingStock', 'vegMomoPackets', 'Veg momos remaining', 'pieces', piecesPerPlate)}
        {field('closingStock', 'paneerMomoPackets', 'Paneer momos remaining', 'pieces', piecesPerPlate)}
      </View>
    </>
  );
}

/** Kept outside the form so re-rendering does not remount the inputs. */
function NumField({ label, value, onChange, unit }: {
  label: string; value: number; onChange: (v: number) => void; unit: string;
}) {
  // The text is the input's own while it has focus, so a partial entry like
  // "1." is never fought over; a value changed from outside — a report
  // finishing loading, figures reset after a save — lands when focus leaves.
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <BufferedTextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={value === 0 ? '' : String(round(value))}
          onChangeText={(t) => {
            const n = parseFloat(t);
            onChange(isNaN(n) ? 0 : n);
          }}
          placeholder="0"
          placeholderTextColor={COLORS.muted}
        />
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

/** Trims float noise from unit conversion (3 packets → 1.5L → 3, not 2.9999). */
const round = (n: number) => Math.round(n * 100) / 100;

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: COLORS.muted, letterSpacing: 1.5,
    marginBottom: SPACING.md, marginTop: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  field: { marginBottom: SPACING.md },
  fieldLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.dark, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md, minHeight: 48,
  },
  input: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.black, fontWeight: '600' },
  unit: { fontSize: FONT_SIZE.sm, color: COLORS.primaryLight, fontWeight: '700' },
});
