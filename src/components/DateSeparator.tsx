import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZE } from '../constants';
import { friendlyDate } from '../utils/date';

/**
 * Marks where one day's entries end and the next begin.
 *
 * Lists of dated entries repeated the date on every single row, which reads as
 * noise when a dozen of them share it. The date belongs once, between the
 * groups, and the rows get on with saying what they are.
 */
export default function DateSeparator({ date }: { date: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.label}>{friendlyDate(date)}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    gap: SPACING.md, marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  line: { flex: 1, height: 1, backgroundColor: COLORS.border },
  label: {
    fontSize: FONT_SIZE.xs, fontWeight: '800', color: COLORS.muted,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
});
