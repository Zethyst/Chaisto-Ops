import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZE } from '../constants';
import { haptics } from '../utils/haptics';
import { currentMonthISO } from '../utils/date';

export function currentMonth() { return currentMonthISO(); }

export function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  return new Date(parseInt(y, 10), parseInt(mo, 10) - 1)
    .toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

/** Shifts a YYYY-MM string by whole months, rolling the year over correctly. */
export function shiftMonth(m: string, by: number) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + by);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * ‹ September 2026 › month stepper for screens that list a month at a time.
 * Forward is capped at the current month — there is nothing recorded ahead.
 */
export default function MonthNavigator({ value, onChange }: {
  value: string;
  onChange: (month: string) => void;
}) {
  const atLatest = value >= currentMonth();

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={() => { haptics.selection(); onChange(shiftMonth(value, -1)); }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.arrow}>‹</Text>
      </TouchableOpacity>

      <Text style={styles.label}>{monthLabel(value)}</Text>

      <TouchableOpacity
        disabled={atLatest}
        onPress={() => { haptics.selection(); onChange(shiftMonth(value, 1)); }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.arrow, atLatest && styles.arrowDisabled]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  arrow: { fontSize: 28, color: COLORS.primary, fontWeight: '700', paddingHorizontal: SPACING.md },
  arrowDisabled: { color: COLORS.border },
  label: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.black, minWidth: 160, textAlign: 'center' },
});
