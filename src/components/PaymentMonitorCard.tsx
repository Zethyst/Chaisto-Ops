import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { paymentCaptureService } from '../services/paymentCaptureService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../constants';

/**
 * The standing disclosure: UPI payments arriving on this phone are recorded
 * against the day's report. It says so on the screen the staff member opens
 * every day rather than burying it in a policy nobody reads.
 *
 * Only the "on" state lives here — when records are off, PaymentAccessGate has
 * the whole screen and the app does not get this far.
 */
export default function PaymentMonitorCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const supported = paymentCaptureService.isSupported();

  const refresh = useCallback(async () => {
    if (!supported) return;
    setEnabled(await paymentCaptureService.isEnabled());
    // Whatever the phone is holding goes up on every check, and the server is
    // told whether monitoring is still on
    paymentCaptureService.sync().catch(() => {});
  }, [supported]);

  useEffect(() => { refresh(); }, [refresh]);

  // Granting access happens in Android's own settings, so the state is
  // re-checked when the staff member comes back to the app
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  if (!supported || !enabled) return null;

  return (
    <View style={[styles.card, styles.cardOn]}>
      <Text style={styles.icon}>🔒</Text>
      <View style={styles.textCol}>
        <Text style={styles.titleOn}>UPI payment records are on</Text>
        <Text style={styles.body}>
          Payments received on this phone are recorded against your daily report, so the
          cash and UPI you hand over always match what came in. Your personal messages and
          one-time passwords are not read.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    marginHorizontal: SPACING.lg, marginBottom: SPACING.md,
    padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
  },
  cardOn: { backgroundColor: COLORS.successBg, borderColor: COLORS.success },
  icon: { fontSize: 18, marginTop: 1 },
  textCol: { flex: 1 },
  titleOn: { fontSize: FONT_SIZE.sm, fontWeight: '800', color: COLORS.success, marginBottom: 2 },
  body: { fontSize: FONT_SIZE.xs, color: COLORS.dark, lineHeight: 17 },
});
