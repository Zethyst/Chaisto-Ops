import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../constants';
import { haptics } from '../utils/haptics';
import { toISODate, todayISO } from '../utils/date';

type Day = { value: string; label: string; weekday: string; isToday: boolean };

const toDay = (d: Date, todayStr: string): Day => {
  const value = toISODate(d);
  return {
    value,
    label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
    isToday: value === todayStr,
  };
};

/** The last `count` days ending today, newest first. */
export function recentDates(count: number): Day[] {
  const todayStr = todayISO();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return toDay(d, todayStr);
  });
}

/**
 * Every day of `month` (YYYY-MM), newest first, stopping at today for the
 * current month — you cannot log against a day that hasn't happened.
 */
export function datesInMonth(month: string): Day[] {
  const todayStr = todayISO();
  const [y, mo] = month.split('-').map(Number);
  const lastOfMonth = new Date(y, mo, 0).getDate();
  const isCurrentMonth = month === todayStr.slice(0, 7);
  const lastDay = isCurrentMonth ? new Date().getDate() : lastOfMonth;

  return Array.from({ length: lastDay }, (_, i) => toDay(new Date(y, mo - 1, lastDay - i), todayStr));
}

/** The day a new entry should default to when browsing `month`. */
export function defaultDayFor(month: string): string {
  return datesInMonth(month)[0]?.value ?? todayISO();
}

/**
 * Horizontal day picker for entering records after the fact. Pass `month` to
 * offer that whole month; otherwise it offers the last `days` days.
 */
export default function DateStrip({ value, onChange, days = 14, month }: {
  value: string;
  onChange: (date: string) => void;
  days?: number;
  month?: string;
}) {
  const dates = useMemo(
    () => (month ? datesInMonth(month) : recentDates(days)),
    [month, days],
  );

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
