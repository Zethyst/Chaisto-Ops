import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
   RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { showAlert } from '../../components/AppAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchTodayReport, resumeOrStartReport } from '../../store/slices/reportSlice';
import { fetchMenuConfig, ensureFreshTally } from '../../store/slices/menuSlice';
import { reportService } from '../../services/reportService';
import { payrollService } from '../../services/payrollService';
import { notificationService } from '../../services/notificationService';
import { DailyReport, PayrollSummary } from '../../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';
import { useLanguage } from '../../i18n';
import BrandedLogoMark from '../../components/BrandedLogoMark';

function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  });
}

function dayLabel(dateStr: string, index: number, t: any): string {
  if (index === 0) return t('today');
  if (index === 1) return t('yesterday');
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function StaffDashboard({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useSelector((s: RootState) => s.auth);
  const { todayReport, syncPending } = useSelector((s: RootState) => s.reports);
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useLanguage();

  const [refreshing, setRefreshing] = useState(false);
  const [recentReports, setRecentReports] = useState<DailyReport[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [payroll, setPayroll] = useState<PayrollSummary | null>(null);
  const [payrollLoading, setPayrollLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadRecentReports = async () => {
    if (!user?.id) return;
    const result = await reportService.getReportsCached(user.id, 30);
    setRecentReports(Array.isArray(result.reports) ? result.reports : []);
    setFromCache(result.fromCache);
  };

  const loadPayroll = async () => {
    if (!user?.id) return;
    setPayrollLoading(true);
    try {
      const data = await payrollService.getMyPayroll(currentMonth());
      setPayroll(data);
    } catch {
      // Non-critical
    } finally {
      setPayrollLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const { unreadCount: count } = await notificationService.getNotifications();
      setUnreadCount(count);
    } catch {}
  };

  useEffect(() => {
    if (user?.id) {
      dispatch(fetchTodayReport(user.id));
      dispatch(ensureFreshTally());
      if (user.stallId) dispatch(fetchMenuConfig(user.stallId));
      loadRecentReports();
      loadPayroll();
      loadUnreadCount();
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    if (user?.id) {
      await Promise.all([
        dispatch(fetchTodayReport(user.id)),
        loadRecentReports(),
        loadPayroll(),
        loadUnreadCount(),
      ]);
    }
    setRefreshing(false);
    haptics.selection();
  };

  const startReport = () => {
    if (todayReport?.status === 'submitted' || todayReport?.status === 'reviewed') {
      haptics.error();
      showAlert('Already Submitted', "You have already submitted today's report. Contact your admin if there's an issue.");
      return;
    }
    haptics.medium();
    // Picks up an unfinished report — local or autosaved on the server
    dispatch(resumeOrStartReport({
      staffId: user!.id,
      stallId: user!.stallId!,
      stallName: user!.stallName || 'Chaisto Stall',
    })).finally(() => navigation.navigate('DailyReport'));
  };

  const addCartClosingPhoto = () => {
    haptics.medium();
    navigation.navigate('CameraCapture', {
      category: 'cartClosing',
      reportId: (todayReport as any)?._id || todayReport?.id,
    });
  };

  const hour = new Date().getHours();
  const greeting = hour < 5 ? t('goodNight') : hour < 12 ? t('goodMorning') : hour < 17 ? t('goodAfternoon') : hour < 21 ? t('goodEvening') : t('goodNight');
  const reportSubmitted = todayReport?.status === 'submitted' || todayReport?.status === 'reviewed';
  const recentDays = lastNDays(5);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primaryLight} />}
    >
      {/* Offline banner */}
      {syncPending && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📵 {t('offlineQueued')}</Text>
        </View>
      )}
      {fromCache && !syncPending && (
        <View style={[styles.offlineBanner, styles.cacheBanner]}>
          <Text style={[styles.offlineText, { color: COLORS.info }]}>💾 {t('cachedData')}</Text>
        </View>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.xl }]}>
        <View style={styles.headerOrb} />
        <BrandedLogoMark size={52} />
        <View style={styles.headerTextCol}>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.name}>{user?.name || 'Staff'}</Text>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => { haptics.light(); navigation.navigate('Notifications'); }}
        >
          <Text style={{ fontSize: 24 }}>🔔</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Monthly Income Card */}
      <View style={styles.incomeCard}>
        <View style={styles.incomeLeft}>
          <Text style={styles.incomeLabel}>{t('monthlyEarnings')} 💚</Text>
          {payrollLoading ? (
            <ActivityIndicator color={COLORS.success} style={{ marginTop: 6 }} />
          ) : (
            <>
              <Text style={styles.incomeAmount}>
                ₹{(payroll?.totalPay || 0).toLocaleString('en-IN')}
              </Text>
              <View style={styles.incomeBreakdown}>
                <Text style={styles.incomeBreakItem}>
                  {t('baseSalary')}: ₹{(payroll?.baseSalary || 0).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.incomePlus}> + </Text>
                <Text style={[styles.incomeBreakItem, { color: COLORS.success }]}>
                  {t('cupBonus')}: ₹{(payroll?.cupsIncentive || 0).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.incomePlus}> + </Text>
                <Text style={[styles.incomeBreakItem, { color: COLORS.success }]}>
                  {t('momoBonus')}: ₹{(payroll?.momoIncentive || 0).toLocaleString('en-IN')}
                </Text>
              </View>
            </>
          )}
        </View>
        <View style={styles.incomeRight}>
          <View style={styles.incomeStatsRow}>
            <View style={styles.incomeStat}>
              <Text style={styles.incomeCupCount}>{payroll?.totalCups || 0}</Text>
              <Text style={styles.incomeCupLabel}>{t('cups')}</Text>
            </View>
            <View style={styles.incomeStatDivider} />
            <View style={styles.incomeStat}>
              <Text style={styles.incomeCupCount}>{payroll?.totalMomoPieces ?? 0}</Text>
              <Text style={styles.incomeCupLabel}>{t('momos')}</Text>
            </View>
          </View>
          <Text style={styles.incomePerCup}>
            ₹{payroll?.cupRate ?? 1}/cup · ₹{payroll?.momoRate ?? 5}/plate
          </Text>
        </View>
      </View>

      {/* Today's Status */}
      <View style={[styles.statusCard, reportSubmitted ? styles.statusDone : styles.statusPending]}>
        <Text style={styles.statusIcon}>{reportSubmitted ? '✅' : '⏰'}</Text>
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={styles.statusTitle}>
            {reportSubmitted ? t('reportSubmitted') : t('dailyReportPending')}
          </Text>
          <Text style={styles.statusSub}>
            {reportSubmitted
              ? `${t('submittedAt')} ${new Date(todayReport!.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
              : t('submitBeforeClosing')}
          </Text>
        </View>
      </View>

      {/* Main Action */}
      {!reportSubmitted && (
        <TouchableOpacity style={styles.mainAction} onPress={startReport} activeOpacity={0.85}>
          <Text style={styles.mainActionIcon}>📋</Text>
          <Text style={styles.mainActionTitle}>{t('startDailyReport')}</Text>
          <Text style={styles.mainActionSub}>{t('startDailyReportSub')}</Text>
        </TouchableOpacity>
      )}

      {/* Today's Summary */}
      {reportSubmitted && todayReport && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('todaySummary')}</Text>
          <View style={styles.summaryGrid}>
            <SummaryItem label={t('cupsSold')} value={String((todayReport.sales?.regularCups || 0) + (todayReport.sales?.specialCups || 0))} icon="☕" />
            <SummaryItem label={t('momoSold')} value={String((todayReport.sales?.vegMomoPackets || 0) + (todayReport.sales?.paneerMomoPackets || 0))} icon="🥟" />
            <SummaryItem label={t('revenue')} value={`₹${todayReport.computed?.totalRevenue || 0}`} icon="💰" />
            <SummaryItem label="UPI" value={`₹${todayReport.payments?.upi || 0}`} icon="📱" />
            <SummaryItem label="Cash" value={`₹${todayReport.payments?.cash || 0}`} icon="💵" />
          </View>
          {todayReport.flags?.length > 0 && (
            <View style={styles.flagWarning}>
              <Text style={styles.flagText}>⚠️ {todayReport.flags.length} {t('flagsRaised')}</Text>
            </View>
          )}
        </View>
      )}

      {/* Cart closing photo — optional, added when the stall actually shuts */}
      {reportSubmitted && todayReport && !todayReport.photos?.cartClosing && (
        <TouchableOpacity style={styles.cartPhotoCard} onPress={addCartClosingPhoto} activeOpacity={0.85}>
          <Text style={styles.cartPhotoIcon}>🛒</Text>
          <View style={{ flex: 1, marginLeft: SPACING.md }}>
            <Text style={styles.cartPhotoTitle}>{t('addCartClosingPhoto')}</Text>
            <Text style={styles.cartPhotoSub}>{t('addCartClosingPhotoSub')}</Text>
          </View>
          <Text style={styles.cartPhotoChevron}>›</Text>
        </TouchableOpacity>
      )}

      {reportSubmitted && !!todayReport?.photos?.cartClosing && (
        <View style={[styles.cartPhotoCard, styles.cartPhotoDone]}>
          <Text style={styles.cartPhotoIcon}>✅</Text>
          <View style={{ flex: 1, marginLeft: SPACING.md }}>
            <Text style={styles.cartPhotoTitle}>{t('cartClosingPhotoAdded')}</Text>
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('quickActions')}</Text>
        <View style={styles.quickGrid}>
          <QuickBtn icon="📸" label={t('camera')} sub={t('takePhotos')}
            onPress={() => { haptics.light(); navigation.navigate('CameraCapture', { category: 'cash' }); }} />
          <QuickBtn icon="📦" label={t('inventory')} sub={t('checkStock')}
            onPress={() => { haptics.light(); navigation.navigate('InventoryManagement'); }} />
          <QuickBtn icon="💸" label={t('expenses')} sub={t('logExpense')}
            onPress={() => { haptics.light(); navigation.navigate('ExpenseTracker'); }} />
          <QuickBtn icon="♻️" label={t('wastage')} sub={t('logWastage')}
            onPress={() => { haptics.light(); navigation.navigate('WastageLog'); }} />
        </View>
      </View>

      {/* Recent Reports */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('recentReports')}</Text>
        <View style={styles.recentList}>
          {recentDays.map((dateStr, i) => {
            const isToday = i === 0;
            const report = isToday
              ? todayReport
              : recentReports.find((r) => r.date === dateStr);

            const submitted = report?.status === 'submitted' || report?.status === 'reviewed' || report?.status === 'flagged';
            const pending = isToday && !report;
            const flagged = report?.status === 'flagged';
            const missed = !isToday && !report;

            return (
              <TouchableOpacity
                key={dateStr}
                style={styles.recentRow}
                onPress={() => {
                  if (report?.id || (report as any)?._id) {
                    haptics.selection();
                    navigation.navigate('Notifications');
                  }
                }}
                disabled={!report}
              >
                <Text style={styles.recentDate}>{dayLabel(dateStr, i, t)}</Text>
                <Text style={[
                  styles.recentStatus,
                  pending && styles.recentPending,
                  submitted && !flagged && styles.recentDone,
                  flagged && styles.recentFlagged,
                  missed && styles.recentMissed,
                ]}>
                  {pending ? t('pending')
                    : flagged ? t('flagged')
                    : submitted ? t('submitted')
                    : t('noReport')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Tips */}
      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>💡 {t('dailyTip')}</Text>
        <Text style={styles.tipText}>{t('tipText')}</Text>
      </View>
    </ScrollView>
  );
}

function SummaryItem({ label, value, icon }: any) {
  return (
    <View style={styles.summaryItem}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function QuickBtn({ icon, label, sub, onPress }: any) {
  return (
    <TouchableOpacity style={styles.quickBtn} onPress={onPress} activeOpacity={0.8}>
      <Text style={{ fontSize: 28 }}>{icon}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
      <Text style={styles.quickSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { paddingBottom: 80 },

  offlineBanner: { backgroundColor: COLORS.warningBg, padding: SPACING.md, alignItems: 'center' },
  cacheBanner: { backgroundColor: COLORS.infoBg },
  offlineText: { color: COLORS.warning, fontWeight: '600', fontSize: FONT_SIZE.sm },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    overflow: 'hidden',
  },
  headerOrb: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: COLORS.primaryBg, top: -60, right: -40, opacity: 0.7,
  },
  headerTextCol: { flex: 1, marginLeft: SPACING.md, minWidth: 0 },
  greeting: { fontSize: FONT_SIZE.sm, color: COLORS.muted },
  name: {
    fontSize: 28,
    color: COLORS.black,
    fontFamily: 'GreatVibes-Regular',
  },
  stall: { fontSize: FONT_SIZE.sm, color: COLORS.medium, marginTop: 2 },
  notifBtn: { padding: SPACING.sm, position: 'relative' },
  badge: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: COLORS.danger, borderRadius: 10,
    minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: COLORS.white,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', lineHeight: 14 },

  // Income card
  incomeCard: {
    margin: SPACING.xl, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    backgroundColor: '#0D3D2A', flexDirection: 'row', alignItems: 'flex-start',
    ...SHADOWS.md,
  },
  incomeLeft: { flex: 1 },
  incomeLabel: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  incomeAmount: { fontSize: 38, fontWeight: '900', color: '#4ADE80', marginTop: 2, letterSpacing: -1 },
  incomeBreakdown: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 6 },
  incomeBreakItem: { fontSize: FONT_SIZE.xs, color: 'rgba(255,255,255,0.65)' },
  incomePlus: { fontSize: FONT_SIZE.xs, color: 'rgba(255,255,255,0.4)' },
  incomeRight: { alignItems: 'center', marginLeft: SPACING.lg },
  incomeStatsRow: { flexDirection: 'row', alignItems: 'center' },
  incomeStat: { alignItems: 'center', minWidth: 44 },
  incomeStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: SPACING.sm },
  incomeCupCount: { fontSize: 26, fontWeight: '900', color: '#4ADE80' },
  incomeCupLabel: { fontSize: FONT_SIZE.xs, color: 'rgba(255,255,255,0.6)', marginTop: -2 },
  incomePerCup: { fontSize: 11, color: '#4ADE80', fontWeight: '600', marginTop: 6, backgroundColor: 'rgba(74,222,128,0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },

  cartPhotoCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: SPACING.xl, marginBottom: SPACING.md,
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, borderWidth: 1.5, borderColor: COLORS.primary,
    borderStyle: 'dashed', ...SHADOWS.sm,
  },
  cartPhotoDone: { borderColor: COLORS.success, borderStyle: 'solid' },
  cartPhotoIcon: { fontSize: 24 },
  cartPhotoTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black },
  cartPhotoSub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 2 },
  cartPhotoChevron: { fontSize: 26, color: COLORS.primaryLight, fontWeight: '700' },

  statusCard: {
    marginHorizontal: SPACING.xl, marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
  },
  statusDone: { backgroundColor: COLORS.successBg, borderColor: COLORS.success },
  statusPending: { backgroundColor: COLORS.warningBg, borderColor: COLORS.warning },
  statusIcon: { fontSize: 32 },
  statusTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.black },
  statusSub: { fontSize: FONT_SIZE.sm, color: COLORS.medium, marginTop: 2 },

  mainAction: {
    marginHorizontal: SPACING.xl, marginBottom: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl, backgroundColor: COLORS.primary, padding: SPACING.xl, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.primaryLight,
    shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
  },
  mainActionIcon: { fontSize: 44, marginBottom: SPACING.md },
  mainActionTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: '#fff', textAlign: 'center' },
  mainActionSub: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.7)', marginTop: 6, textAlign: 'center' },

  summaryCard: {
    marginHorizontal: SPACING.xl, marginBottom: SPACING.xl,
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, ...SHADOWS.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  summaryTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black, marginBottom: SPACING.md },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  summaryItem: {
    flex: 1, minWidth: '45%', backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderLight,
  },
  summaryValue: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.primary, marginTop: 4 },
  summaryLabel: { fontSize: 11, color: COLORS.muted, marginTop: 2 },

  flagWarning: {
    marginTop: SPACING.md, backgroundColor: COLORS.warningBg, borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.warning,
  },
  flagText: { fontSize: FONT_SIZE.sm, color: COLORS.warning, fontWeight: '600' },

  section: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.black, marginBottom: SPACING.md },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  quickBtn: {
    width: '47%', backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  quickLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.black, marginTop: SPACING.sm },
  quickSub: { fontSize: FONT_SIZE.xs, color: COLORS.muted, marginTop: 2 },

  recentList: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border,
  },
  recentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  recentDate: { fontSize: FONT_SIZE.md, color: COLORS.dark },
  recentStatus: { fontSize: FONT_SIZE.sm, color: COLORS.muted, fontWeight: '600' },
  recentDone: { color: COLORS.success },
  recentPending: { color: COLORS.danger },
  recentFlagged: { color: COLORS.warning },
  recentMissed: { color: COLORS.muted },

  tipCard: {
    margin: SPACING.xl, backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg, borderLeftWidth: 3, borderLeftColor: COLORS.primaryLight,
    borderWidth: 1, borderColor: COLORS.border,
  },
  tipTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primaryLight, marginBottom: 6 },
  tipText: { fontSize: FONT_SIZE.sm, color: COLORS.medium, lineHeight: 20 },
});
