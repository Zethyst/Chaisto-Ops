import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Dimensions, ActivityIndicator,
} from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { reportService } from '../../services/reportService';
import { haptics } from '../../utils/haptics';
import { useLanguage } from '../../i18n';
import BrandedLogoMark from '../../components/BrandedLogoMark';

const { width } = Dimensions.get('window');
const chartWidth = width - SPACING.xl * 2 - 8;

const chartConfig = {
  backgroundColor: COLORS.white,
  backgroundGradientFrom: COLORS.white,
  backgroundGradientTo: COLORS.white,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(193, 123, 47, ${opacity})`,
  labelColor: () => COLORS.medium,
  strokeWidth: 2,
  propsForDots: { r: '4', strokeWidth: '2', stroke: COLORS.primaryDark },
};

const EMPTY_CHART = {
  labels: ['—', '—'],
  datasets: [{ data: [0, 0] }],
};

function formatRelTime(dateStr: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  if (Math.floor(hours / 24) === 1) return 'Yesterday';
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminDashboard({ navigation }: any) {
  const { user } = useSelector((s: RootState) => s.auth);
  const { t } = useLanguage();
  const [analytics, setAnalytics] = useState<any>(null);
  const [flaggedReports, setFlaggedReports] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 30>(7);

  const loadData = useCallback(async () => {
    try {
      const [data, flags] = await Promise.all([
        reportService.getAnalytics({ days: period }),
        reportService.getSuspicionAlerts(),
      ]);
      setAnalytics(data);
      setFlaggedReports(Array.isArray(flags) ? flags : []);
    } catch {
      // Keep previous data on error
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { setIsLoading(true); loadData(); }, [period]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  // ─── Derived values ────────────────────────────────────────────────────────
  const summary = analytics?.summary ?? {};
  const totalCups = summary.totalCups ?? 0;
  const totalRevenue = summary.totalRevenue ?? 0;
  const totalUPI = summary.totalUPI ?? 0;
  const flaggedCount = summary.flaggedCount ?? 0;
  const upiPct = totalRevenue > 0 ? Math.round((totalUPI / totalRevenue) * 100) : 0;

  // Flatten individual flags from all flagged reports for the alerts section
  const alertItems = flaggedReports.flatMap((report: any) =>
    (report.flags || []).map((f: any) => ({
      severity: (f.severity ?? 'medium') as 'high' | 'medium' | 'low',
      msg: `${report.staffName}: ${f.message}`,
      time: formatRelTime(report.submittedAt),
      reportId: report._id ?? report.id,
    }))
  ).slice(0, 5);

  // Build chart datasets from daily analytics
  const buildCharts = () => {
    const daily: any[] = analytics?.daily ?? [];
    if (daily.length < 2) return { cups: EMPTY_CHART, revenue: EMPTY_CHART };
    const slice = daily.slice(-7);
    const labels = slice.map((d: any) => {
      const dt = new Date(d._id);
      return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    });
    return {
      cups: { labels, datasets: [{ data: slice.map((d: any) => Math.round(d.cups)) }] },
      revenue: { labels, datasets: [{ data: slice.map((d: any) => Math.round(d.revenue)) }] },
    };
  };
  const charts = buildCharts();

  const staffPerf: any[] = analytics?.staffPerformance ?? [];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primaryLight} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerOrb} />
        <BrandedLogoMark size={52} />
        <View style={styles.headerTextCol}>
          <Text style={styles.greeting}>{greeting} 👋</Text>
          <Text style={styles.headerName}>{user?.name || 'Admin'}</Text>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => { haptics.light(); navigation.navigate('Notifications'); }}
        >
          <Text style={styles.notifIcon}>🔔</Text>
          {flaggedReports.length > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifCount}>{flaggedReports.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Period Toggle */}
      <View style={styles.toggleRow}>
        {([7, 30] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.toggleBtn, period === p && styles.toggleBtnActive]}
            onPress={() => { haptics.selection(); setPeriod(p); }}
          >
            <Text style={[styles.toggleText, period === p && styles.toggleTextActive]}>
              {p === 7 ? t('thisWeek') : t('thisMonth')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ margin: SPACING.xl * 2 }} color={COLORS.primary} />
      ) : (
        <>
          {/* KPI Cards — real data */}
          <View style={styles.kpiGrid}>
            <KpiCard
              label={t('cupsTotal')}
              value={totalCups.toLocaleString('en-IN')}
              sub={`${summary.reportCount ?? 0} ${t('reportsThisPeriod').toLowerCase()}`}
              color={COLORS.primaryLight}
              icon="☕"
            />
            <KpiCard
              label={t('revenueTotal')}
              value={`₹${Math.round(totalRevenue).toLocaleString('en-IN')}`}
              sub={`₹${summary.reportCount > 0 ? Math.round(totalRevenue / summary.reportCount) : 0} avg`}
              color={COLORS.success}
              icon="💰"
            />
            <KpiCard
              label="UPI Share"
              value={`${upiPct}%`}
              sub={`₹${Math.round(totalUPI).toLocaleString('en-IN')} UPI`}
              color={COLORS.info}
              icon="📱"
            />
            <KpiCard
              label={t('flaggedReports')}
              value={String(flaggedCount || flaggedReports.length)}
              sub={t('flaggedReports').toLowerCase()}
              color={COLORS.danger}
              icon="🚨"
            />
          </View>

          {/* Cups Chart — real data */}
          {analytics?.daily?.length >= 2 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Cups sold — daily trend</Text>
              <LineChart
                data={charts.cups}
                width={chartWidth}
                height={180}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                withInnerLines={false}
                withOuterLines={false}
              />
            </View>
          )}

          {/* Revenue Chart — real data */}
          {analytics?.daily?.length >= 2 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Revenue (₹) — daily</Text>
              <BarChart
                data={charts.revenue}
                width={chartWidth}
                height={180}
                chartConfig={{ ...chartConfig, color: (o = 1) => `rgba(29, 158, 117, ${o})` }}
                style={styles.chart}
                withInnerLines={false}
                showValuesOnTopOfBars
                yAxisLabel="₹"
                yAxisSuffix=""
              />
            </View>
          )}

          {analytics?.daily?.length < 2 && (
            <View style={styles.emptyChartCard}>
              <Text style={styles.emptyChartIcon}>📊</Text>
              <Text style={styles.emptyChartText}>Charts appear once reports are submitted</Text>
            </View>
          )}

          {/* Suspicion Alerts — real data */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('suspicionAlerts')}</Text>
              <TouchableOpacity onPress={() => { haptics.light(); navigation.navigate('Analytics'); }}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {alertItems.length === 0 ? (
              <View style={styles.emptyAlerts}>
                <Text style={styles.emptyAlertsText}>{t('noSuspicionAlerts')}</Text>
              </View>
            ) : (
              alertItems.map((alert, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    haptics.medium();
                    if (alert.reportId) navigation.navigate('ReportDetail', { reportId: alert.reportId });
                  }}
                >
                  <AlertCard alert={alert} />
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('quickActions')}</Text>
            <View style={styles.actionGrid}>
              {[
                { label: 'Staff', icon: '👥', screen: 'StaffManagement' },
                { label: 'Inventory', icon: '📦', screen: 'InventoryManagement' },
                { label: 'Map', icon: '🗺️', screen: 'StallMap' },
                { label: 'Analytics', icon: '📊', screen: 'Analytics' },
                { label: 'Expenses', icon: '💸', screen: 'ExpenseTracker' },
                { label: 'Wastage', icon: '♻️', screen: 'WastageLog' },
                { label: 'P&L', icon: '📈', screen: 'PnLReport' },
                { label: 'Payroll', icon: '💼', screen: 'Payroll' },
                { label: 'Attendance', icon: '📅', screen: 'Attendance' },
                { label: 'Audit Log', icon: '🔍', screen: 'AuditLog' },
              ].map((action) => (
                <TouchableOpacity
                  key={action.screen}
                  style={styles.actionBtn}
                  onPress={() => { haptics.light(); navigation.navigate(action.screen); }}
                >
                  <Text style={styles.actionIcon}>{action.icon}</Text>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Staff Leaderboard — real data */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('staffPerformance')}</Text>
            {staffPerf.length === 0 ? (
              <View style={styles.emptyAlerts}>
                <Text style={styles.emptyAlertsText}>{t('noPerformanceData')}</Text>
              </View>
            ) : (
              <View style={styles.leaderboard}>
                {staffPerf.slice(0, 3).map((staff: any, i: number) => (
                  <View key={staff._id} style={styles.leaderRow}>
                    <Text style={[styles.rank, i === 0 && { color: COLORS.primary }]}>
                      {i === 0 ? '👑' : `#${i + 1}`}
                    </Text>
                    <View style={styles.leaderInfo}>
                      <Text style={styles.leaderName}>{staff.name}</Text>
                      <Text style={styles.leaderSub}>{staff.cups} cups · {staff.reports} reports</Text>
                    </View>
                    <Text style={styles.leaderRevenue}>
                      ₹{Math.round(staff.revenue).toLocaleString('en-IN')}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function KpiCard({ label, value, sub, color, icon }: any) {
  return (
    <View style={[styles.kpiCard, { borderTopColor: color, borderTopWidth: 2 }]}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiSub}>{sub}</Text>
    </View>
  );
}

function AlertCard({ alert }: { alert: { severity: string; msg: string; time: string } }) {
  const colors: Record<string, string> = { high: COLORS.danger, medium: COLORS.warning, low: COLORS.info };
  const bgs: Record<string, string> = { high: COLORS.dangerBg, medium: COLORS.warningBg, low: COLORS.infoBg };
  const col = colors[alert.severity] ?? COLORS.warning;
  const bg = bgs[alert.severity] ?? COLORS.warningBg;
  return (
    <View style={[styles.alertCard, { backgroundColor: bg, borderLeftColor: col }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.alertMsg, { color: col }]} numberOfLines={2}>{alert.msg}</Text>
        <Text style={styles.alertTime}>{alert.time}</Text>
      </View>
      <View style={[styles.severityBadge, { backgroundColor: col }]}>
        <Text style={styles.severityText}>{alert.severity.toUpperCase()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { paddingBottom: SPACING.xxxl },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.lg,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    overflow: 'hidden',
  },
  headerOrb: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: COLORS.primaryBg, top: -80, right: -40, opacity: 0.8,
  },
  headerTextCol: { flex: 1, marginLeft: SPACING.md, minWidth: 0 },
  greeting: { fontSize: FONT_SIZE.sm, color: COLORS.muted },
  headerName: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.black },
  notifBtn: { position: 'relative', padding: SPACING.sm },
  notifIcon: { fontSize: 24 },
  notifBadge: {
    position: 'absolute', top: 0, right: 0, backgroundColor: COLORS.danger,
    borderRadius: BORDER_RADIUS.full, width: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  notifCount: { color: '#fff', fontSize: 10, fontWeight: '700' },

  toggleRow: {
    flexDirection: 'row', margin: SPACING.xl, marginBottom: SPACING.lg,
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md, padding: 3,
    borderWidth: 1, borderColor: COLORS.border,
  },
  toggleBtn: { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center', borderRadius: BORDER_RADIUS.sm - 2 },
  toggleBtnActive: { backgroundColor: COLORS.primaryBg, borderWidth: 1, borderColor: COLORS.border },
  toggleText: { fontSize: FONT_SIZE.sm, color: COLORS.muted },
  toggleTextActive: { color: COLORS.primaryLight, fontWeight: '700' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.lg, gap: SPACING.md },
  kpiCard: {
    flex: 1, minWidth: '45%', backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, ...SHADOWS.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  kpiValue: { fontSize: FONT_SIZE.xl, fontWeight: '800', marginTop: 6 },
  kpiLabel: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  kpiSub: { fontSize: 10, color: COLORS.muted, marginTop: 2 },

  chartCard: {
    backgroundColor: COLORS.white, margin: SPACING.xl, marginBottom: 0,
    borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, ...SHADOWS.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chartTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.dark, marginBottom: SPACING.md },
  chart: { borderRadius: BORDER_RADIUS.md, marginLeft: -SPACING.md },

  emptyChartCard: {
    margin: SPACING.xl, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  emptyChartIcon: { fontSize: 40, marginBottom: SPACING.sm },
  emptyChartText: { fontSize: FONT_SIZE.sm, color: COLORS.muted, textAlign: 'center' },

  section: { padding: SPACING.xl, paddingBottom: 0 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.black, marginBottom: SPACING.md },
  seeAll: { fontSize: FONT_SIZE.sm, color: COLORS.primaryLight, fontWeight: '600' },

  emptyAlerts: {
    backgroundColor: COLORS.successBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.success,
  },
  emptyAlertsText: { fontSize: FONT_SIZE.sm, color: COLORS.success, fontWeight: '600' },

  alertCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm, borderLeftWidth: 3,
  },
  alertMsg: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  alertTime: { fontSize: 11, color: COLORS.muted, marginTop: 3 },
  severityBadge: { borderRadius: BORDER_RADIUS.full, paddingHorizontal: 8, paddingVertical: 3, marginLeft: SPACING.sm },
  severityText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  actionBtn: {
    width: '18%', flexGrow: 1, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.xs,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  actionIcon: { fontSize: 24, marginBottom: 4 },
  actionLabel: { fontSize: 10, fontWeight: '700', color: COLORS.dark, textAlign: 'center' },

  leaderboard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border,
  },
  leaderRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  rank: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.primaryLight, width: 36 },
  leaderInfo: { flex: 1 },
  leaderName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black },
  leaderSub: { fontSize: FONT_SIZE.sm, color: COLORS.muted },
  leaderRevenue: { fontSize: FONT_SIZE.md, fontWeight: '800', color: COLORS.success },
});
