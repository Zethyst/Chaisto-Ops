import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../constants';
import { haptics } from '../utils/haptics';

/** The last `count` days ending today, newest first. */
export function recentDates(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return {
      value: d.toISOString().split('T')[0],
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      isToday: i === 0,
    };
  });
}

/**
 * Horizontal day picker for entering records after the fact. Only past days and
 * today are offered — there is nothing to record for a day that hasn't happened.
 */
export default function DateStrip({ value, onChange, days = 14 }: {
  value: string;
  onChange: (date: string) => void;
  days?: number;
}) {
  const dates = useMemo(() => recentDates(days), [days]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
      {dates.map((d) => {
        const active = value === d.value;
        return (
          <TouchableOpacity
            key={d.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => { haptics.selection(); onChange(d.value); }}
          >
            <Text style={[styles.weekday, active && styles.textActive]}>
              {d.isToday ? 'Today' : d.weekday}
            </Text>
            <Text style={[styles.label, active && styles.textActive]}>{d.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { flexGrow: 0 },
  chip: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border, marginRight: SPACING.sm,
    alignItems: 'center', minWidth: 64,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  weekday: { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  label: { fontSize: FONT_SIZE.md, fontWeight: '800', color: COLORS.black, marginTop: 1 },
  textActive: { color: '#fff' },
});
