import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState, ActivityIndicator } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { paymentCaptureService } from '../services/paymentCaptureService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../constants';
import { haptics } from '../utils/haptics';

/**
 * Phone makers whose builds kill a notification listener unless the app is also
 * on the autostart list — Xiaomi's MIUI most aggressively of all. On these the
 * permission alone is not enough to keep records running.
 */
const NEEDS_AUTOSTART = ['xiaomi', 'redmi', 'poco', 'oppo', 'realme', 'vivo', 'huawei', 'honor'];

/**
 * Holds the app closed for staff until UPI payment records are switched on.
 *
 * Android has no API to grant notification access — not at startup, not ever;
 * only the person holding the phone can turn it on, or `adb` at setup time. So
 * the app does the next best thing: on launch it takes them straight to the
 * toggle and will not go any further until it is on, then continues by itself
 * the moment it sees the grant.
 *
 * Admins and moderators pass straight through: this is about the phones that
 * collect money.
 */
export default function PaymentAccessGate({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useSelector((s: RootState) => s.auth);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [batteryUnrestricted, setBatteryUnrestricted] = useState(true);
  const [opening, setOpening] = useState(false);

  const brand = DeviceInfo.getBrand?.()?.toLowerCase() ?? '';
  const needsAutostart = NEEDS_AUTOSTART.some((b) => brand.includes(b));

  // Settings is opened once per launch. Opening it on every check would fight
  // the staff member: leaving Settings brings the app forward, which checks
  // again, which would send them back to Settings.
  const autoOpened = useRef(false);

  const applies =
    isAuthenticated && user?.role === 'staff' && paymentCaptureService.isSupported();

  const check = useCallback(async () => {
    if (!applies) return;
    const { enabled: on, batteryUnrestricted: unrestricted } = await paymentCaptureService.health();
    setEnabled(on);
    setBatteryUnrestricted(unrestricted);
    // Tell the server either way — an off phone is a thing the owner should see
    paymentCaptureService.sync().catch(() => {});

    if (!on && !autoOpened.current) {
      autoOpened.current = true;
      setOpening(true);
      await paymentCaptureService.openSettings();
      setOpening(false);
    }
  }, [applies]);

  useEffect(() => { check(); }, [check]);

  // Coming back from Settings is the moment the grant appears, so the app
  // re-checks every time it returns to the foreground and lets them in itself
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  if (!applies || enabled === null) return <>{children}</>;

  // Records are on, but this phone will switch them off again by itself unless
  // it is told to leave the app alone
  if (enabled && needsAutostart && !batteryUnrestricted) {
    return (
      <View style={styles.container}>
        <Text style={styles.icon}>🔋</Text>
        <Text style={styles.title}>One more step on this phone</Text>
        <Text style={styles.body}>
          {DeviceInfo.getBrand()} phones shut background apps down to save battery. Until
          that is turned off for Chaisto, payment records stop on their own after a few
          hours and the day goes unrecorded.
        </Text>

        <View style={styles.steps}>
          <Text style={styles.stepsTitle}>BOTH OF THESE</Text>
          <Text style={styles.step}>1.  Battery — set Chaisto to <Text style={styles.bold}>No restrictions</Text></Text>
          <Text style={styles.step}>2.  Autostart — turn Chaisto <Text style={styles.bold}>on</Text></Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={async () => {
            haptics.medium();
            await paymentCaptureService.requestBatteryUnrestricted();
          }}
        >
          <Text style={styles.buttonText}>Allow background use</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={async () => {
            haptics.light();
            await paymentCaptureService.openAutostartSettings();
          }}
        >
          <Text style={styles.secondaryButtonText}>Open autostart settings</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>The app opens once background use is allowed.</Text>
      </View>
    );
  }

  if (enabled) return <>{children}</>;

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Switch on UPI payment records</Text>
      <Text style={styles.body}>
        Chaisto records the UPI payments that arrive on this phone against your daily
        report, so the money you hand over always matches what came in.
      </Text>
      <Text style={styles.body}>
        Only payment apps and bank payment messages are read. Your personal messages,
        one-time passwords, photos and everything else on the phone are not.
      </Text>

      <View style={styles.steps}>
        <Text style={styles.stepsTitle}>ON THE SCREEN THAT OPENS</Text>
        <Text style={styles.step}>1.  Find <Text style={styles.bold}>Chaisto</Text> in the list</Text>
        <Text style={styles.step}>2.  Turn the switch <Text style={styles.bold}>on</Text></Text>
        <Text style={styles.step}>3.  Tap <Text style={styles.bold}>Allow</Text>, then come back here</Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={async () => {
          haptics.medium();
          setOpening(true);
          await paymentCaptureService.openSettings();
          setOpening(false);
        }}
        disabled={opening}
      >
        {opening
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Open Settings</Text>}
      </TouchableOpacity>

      <Text style={styles.footer}>
        The app opens once this is on. Ask the owner if you need help.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center', padding: SPACING.xl,
  },
  icon: { fontSize: 52, marginBottom: SPACING.lg },
  title: {
    fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.black,
    textAlign: 'center', marginBottom: SPACING.md,
  },
  body: {
    fontSize: FONT_SIZE.sm, color: COLORS.dark, textAlign: 'center',
    lineHeight: 21, marginBottom: SPACING.md,
  },
  steps: {
    alignSelf: 'stretch', backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.lg, marginVertical: SPACING.md,
  },
  stepsTitle: {
    fontSize: 10, fontWeight: '800', color: COLORS.muted,
    letterSpacing: 1.2, marginBottom: SPACING.sm,
  },
  step: { fontSize: FONT_SIZE.sm, color: COLORS.dark, lineHeight: 24 },
  bold: { fontWeight: '800', color: COLORS.black },
  button: {
    alignSelf: 'stretch', backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.lg,
    alignItems: 'center', justifyContent: 'center', minHeight: 56,
    marginTop: SPACING.sm,
  },
  buttonText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '800' },
  secondaryButton: {
    alignSelf: 'stretch', borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.primary,
    paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.sm,
  },
  secondaryButtonText: { color: COLORS.primary, fontSize: FONT_SIZE.md, fontWeight: '800' },
  footer: {
    fontSize: FONT_SIZE.xs, color: COLORS.muted,
    textAlign: 'center', marginTop: SPACING.lg,
  },
});
