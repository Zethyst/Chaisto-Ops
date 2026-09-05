import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../components/AppAlert';
import {
  paymentMonitorService, PaymentDaySummary, StaffPaymentSummary,
} from '../../services/paymentMonitorService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';
import { toISODate } from '../../utils/date';

/** Package names are how Android identifies an app; people read app names. */
const APP_NAMES: Record<string, string> = {
  'com.google.android.apps.nbu.paisa.user': 'Google Pay',
  'com.phonepe.app': 'PhonePe',
  'com.phonepe.business': 'PhonePe Business',
  'net.one97.paytm': 'Paytm',
  'net.one97.paytm.business': 'Paytm Business',
  'in.org.npci.upiapp': 'BHIM',
  'com.bharatpe.app': 'BharatPe',
  'com.bharatpe.merchant': 'BharatPe Merchant',
  'com.dreamplug.androidapp': 'CRED',
  'com.mobikwik_new': 'MobiKwik',
  'com.freecharge.android': 'Freecharge',
  'com.amazon.mShop.android.shopping': 'Amazon Pay',
  'com.jio.myjio': 'JioPay',
  'money.jupiter.app': 'Jupiter',
  'com.naviapp': 'Navi',
  'in.slice.android': 'Slice',
  'com.whatsapp': 'WhatsApp Pay',
  'com.whatsapp.w4b': 'WhatsApp Business',
  'com.google.android.apps.messaging': 'Google Messages',
  'com.samsung.android.messaging': 'Samsung Messages',
  'com.android.mms': 'Messages',
  'com.android.messaging': 'Messages',
  'com.oneplus.mms': 'OnePlus Messages',
  'com.oppo.quicksearchbox': 'ColorOS Messages',
  'com.vivo.messages': 'Vivo Messages',
  'com.transsion.mms': 'Messages',
  'com.truecaller': 'Truecaller',
  'com.microsoft.android.smsorganizer': 'SMS Organizer',
};

/** A capture from a messaging app is a bank alert — worth labelling as one. */
const SMS_APPS = new Set([
  'com.google.android.apps.messaging', 'com.samsung.android.messaging',
  'com.android.mms', 'com.android.messaging', 'com.oneplus.mms',
  'com.oppo.quicksearchbox', 'com.vivo.messages', 'com.transsion.mms',
  'com.truecaller', 'com.microsoft.android.smsorganizer',
]);

const sourceLabel = (app: string) =>
  `${SMS_APPS.has(app) ? 'Bank SMS · ' : ''}${APP_NAMES[app] ?? app}`;

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function dayLabel(d: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * What each staff member's phone recorded receiving by UPI, against what their
 * report for that day declares. A gap means money was collected on the phone
 * and left off the report.
 */
export default function PaymentMonitorScreen() {
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [summary, setSummary] = useState<PaymentDaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (date: Date) => {
    try {
      setSummary(await paymentMonitorService.getDaySummary(toISODate(date)));
    } catch {
      showAlert('Error', 'Could not load the payment summary.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { setLoading(true); load(selectedDate); }, [selectedDate, load]);

  const changeDate = (delta: number) => {
    haptics.selection();
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    if (d > new Date()) return;
    setSelectedDate(d);
  };

  const isToday = toISODate(selectedDate) === toISODate(new Date());
  const totals = summary?.totals;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.dateArrow} onPress={() => changeDate(-1)}>
          <Text style={styles.dateArrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.dateLabel}>{dayLabel(selectedDate)}</Text>
        <TouchableOpacity
          style={[styles.dateArrow, isToday && { opacity: 0.3 }]}
          onPress={() => changeDate(1)}
          disabled={isToday}
        >
          <Text style={styles.dateArrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(selectedDate); }}
              tintColor={COLORS.primaryLight}
            />
          }
        >
          <View style={styles.explainer}>
            <Text style={styles.explainerText}>
              UPI received on each staff phone, against what their report declares. If your
              customers pay the stall's own QR, nothing should appear on a staff phone at
              all — anything here was collected on their device.
            </Text>
          </View>

          {totals && (
            <View style={styles.totalsRow}>
              <Totals label="ON PHONES" value={rupees(totals.captured)} color={COLORS.primary} />
              <View style={styles.totalsDivider} />
              <Totals label="DECLARED" value={rupees(totals.declared)} color={COLORS.info} />
              <View style={styles.totalsDivider} />
              <Totals
                label="UNACCOUNTED"
                value={rupees(totals.unaccounted)}
                color={totals.unaccounted > 0 ? COLORS.danger : COLORS.success}
              />
            </View>
          )}

          {totals && totals.notReporting > 0 && (
            <View style={styles.warnBanner}>
              <Text style={styles.warnText}>
                ⚠️  {totals.notReporting} staff phone{totals.notReporting === 1 ? ' is' : 's are'} not recording
                payments right now — {totals.notReporting === 1 ? 'that phone shows' : 'those phones show'} a
                clean day whether or not it was one.
              </Text>
            </View>
          )}

          {(summary?.staff.length ?? 0) === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📱</Text>
              <Text style={styles.emptyTitle}>No staff to show</Text>
            </View>
          ) : (
            summary!.staff.map((row) => (
              <StaffRow
                key={row.staffId}
                row={row}
                expanded={expanded === row.staffId}
                onToggle={() => {
                  haptics.light();
                  setExpanded(expanded === row.staffId ? null : row.staffId);
                }}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Totals({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.totalsItem}>
      <Text style={[styles.totalsValue, { color }]}>{value}</Text>
      <Text style={styles.totalsLabel}>{label}</Text>
    </View>
  );
}

function StaffRow({ row, expanded, onToggle }: {
  row: StaffPaymentSummary; expanded: boolean; onToggle: () => void;
}) {
  // Granted but killed by the phone counts as not recording, which is the
  // state a Redmi lands in once MIUI cleans the app out of memory
  const notReporting = row.monitoring.health !== 'reporting';

  return (
    <TouchableOpacity
      style={[styles.card, row.mismatch && styles.cardAlert]}
      onPress={onToggle}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.staffName}>{row.staffName}</Text>
          <Text style={styles.staffSub}>
            {row.hasReport ? `${row.capturedCount} payment${row.capturedCount === 1 ? '' : 's'} on phone` : 'No report filed'}
          </Text>
        </View>
        {row.mismatch ? (
          <View style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>{rupees(row.undeclared)} UNACCOUNTED</Text>
          </View>
        ) : notReporting ? (
          <View style={styles.offBadge}>
            <Text style={styles.offBadgeText}>{row.monitoring.healthLabel.toUpperCase()}</Text>
          </View>
        ) : (
          <View style={styles.okBadge}>
            <Text style={styles.okBadgeText}>MATCHES</Text>
          </View>
        )}
      </View>

      <View style={styles.figuresRow}>
        <Figure label="On phone" value={rupees(row.capturedTotal)} color={COLORS.primary} />
        <Figure label="Declared" value={rupees(row.declaredUpi)} color={COLORS.info} />
        <Figure
          label="Difference"
          value={rupees(Math.abs(row.undeclared))}
          color={row.undeclared > 0 ? COLORS.danger : COLORS.muted}
        />
      </View>

      {expanded && (
        <View style={styles.captureList}>
          {row.captures.length === 0 ? (
            <Text style={styles.captureEmpty}>
              {notReporting
                ? `This phone is not recording payments — ${row.monitoring.healthLabel.toLowerCase()}.`
                : 'No UPI payments reached this phone on this day.'}
            </Text>
          ) : (
            row.captures.map((c) => (
              <View key={c._id} style={styles.captureRow}>
                <Text style={styles.captureAmount}>{rupees(c.amount)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.captureApp}>{sourceLabel(c.app)}</Text>
                  <Text style={styles.captureText} numberOfLines={2}>{c.title || c.text}</Text>
                </View>
                <Text style={styles.captureTime}>
                  {new Date(c.capturedAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit', minute: '2-digit', hour12: true,
                  })}
                </Text>
              </View>
            ))
          )}
        </View>
      )}

      <Text style={styles.expandHint}>{expanded ? 'Hide payments ▲' : 'Show payments ▼'}</Text>
    </TouchableOpacity>
  );
}

function Figure({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.figure}>
      <Text style={[styles.figureValue, { color }]}>{value}</Text>
      <Text style={styles.figureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: SPACING.lg, paddingBottom: 48 },

  dateNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  dateArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dateArrowText: { fontSize: 28, fontWeight: '700', color: COLORS.primary },
  dateLabel: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.black },

  explainer: {
    backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  explainerText: { fontSize: FONT_SIZE.xs, color: COLORS.primaryLight, lineHeight: 18 },

  totalsRow: {
    flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  totalsItem: { flex: 1, alignItems: 'center', paddingVertical: SPACING.md },
  totalsValue: { fontSize: FONT_SIZE.lg, fontWeight: '800' },
  totalsLabel: { fontSize: 9, color: COLORS.muted, fontWeight: '700', letterSpacing: 0.8, marginTop: 2 },
  totalsDivider: { width: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.sm },

  warnBanner: {
    backgroundColor: COLORS.warningBg, borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3, borderLeftColor: COLORS.warning,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  warnText: { fontSize: FONT_SIZE.sm, color: '#7A5C00', fontWeight: '600', lineHeight: 19 },

  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  cardAlert: { borderColor: COLORS.danger, borderWidth: 1.5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  staffName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black },
  staffSub: { fontSize: FONT_SIZE.xs, color: COLORS.muted, marginTop: 2 },

  alertBadge: {
    backgroundColor: COLORS.dangerBg, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  alertBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.danger, letterSpacing: 0.4 },
  offBadge: {
    backgroundColor: COLORS.warningBg, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  offBadgeText: { fontSize: 10, fontWeight: '800', color: '#7A5C00', letterSpacing: 0.4 },
  okBadge: {
    backgroundColor: COLORS.successBg, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  okBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.success, letterSpacing: 0.4 },

  figuresRow: {
    flexDirection: 'row', marginTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: SPACING.sm,
  },
  figure: { flex: 1, alignItems: 'center' },
  figureValue: { fontSize: FONT_SIZE.md, fontWeight: '800' },
  figureLabel: { fontSize: 10, color: COLORS.muted, marginTop: 1 },

  captureList: {
    marginTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
    paddingTop: SPACING.sm, gap: SPACING.sm,
  },
  captureRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  captureAmount: { fontSize: FONT_SIZE.md, fontWeight: '800', color: COLORS.danger, minWidth: 64 },
  captureApp: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.dark },
  captureText: { fontSize: FONT_SIZE.xs, color: COLORS.muted },
  captureTime: { fontSize: FONT_SIZE.xs, color: COLORS.muted },
  captureEmpty: { fontSize: FONT_SIZE.sm, color: COLORS.muted, fontStyle: 'italic' },

  expandHint: {
    fontSize: FONT_SIZE.xs, color: COLORS.primaryLight, fontWeight: '700',
    textAlign: 'center', marginTop: SPACING.sm,
  },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.dark },
});
