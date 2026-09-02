import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { reportService } from '../../services/reportService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';

const { width } = Dimensions.get('window');
const chartW = width - SPACING.xl * 2 - 8;

interface AnalyticsData {
  summary: {
    totalCups: number;
    totalMomoPackets: number;
    totalMomoPieces?: number;
    totalRevenue: number;
    totalUPI: number;
    totalCash: number;
    reportCount: number;
    flaggedCount: number;
  };
  daily: { _id: string; cups: number; momoPackets: number; revenue: number }[];
  staffPerformance: { _id: string; name: string; cups: number; momoPackets: number; revenue: number; reports: number }[];
}

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

export default function AnalyticsScreen() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<7 | 30>(7);

  const load = async () => {
    try {
      const result = await reportService.getAnalytics({ days: period });
      setData(result);
    } catch {
      // show empty state
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { setIsLoading(true); load(); }, [period]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const buildChartData = () => {
    if (!data?.daily?.length) {
      return {
        cups: { labels: ['—'], datasets: [{ data: [0] }] },
        revenue: { labels: ['—'], datasets: [{ data: [0] }] },
      };
    }
    const slice = data.daily.slice(-7);
    const labels = slice.map((d) => {
      const dt = new Date(d._id);
      return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).replace(' ', '\n');
    });
    return {
      cups: { labels, datasets: [{ data: slice.map((d) => d.cups) }] },
      revenue: { labels, datasets: [{ data: slice.map((d) => Math.round(d.revenue)) }] },
    };
  };

  const charts = buildChartData();
  const upiPct = data?.summary
    ? data.summary.totalRevenue > 0
      ? Math.round((data.summary.totalUPI / data.summary.totalRevenue) * 100)
      : 0
    : 0;

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primaryLight} />}
    >
      {/* Period Toggle */}
      <View style={styles.toggleRow}>
        {([7, 30] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.toggleBtn, period === p && styles.toggleBtnActive]}
            onPress={() => { haptics.selection(); setPeriod(p); }}
          >
            <Text style={[styles.toggleText, period === p && styles.toggleTextActive]}>
              {p === 7 ? 'Last 7 Days' : 'Last 30 Days'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* KPI Grid */}
      <View style={styles.kpiGrid}>
        <KpiCard
          label="Total Cups" icon="☕"
          value={String(data?.summary.totalCups ?? 0)}
          sub={`${data?.summary.reportCount ?? 0} reports`}
          color={COLORS.primary}
        />
        <KpiCard
          label="Momo Packets" icon="🥟"
          value={String(data?.summary.totalMomoPieces ?? 0)}
          sub={`${data?.summary.reportCount ?? 0} reports`}
          color={COLORS.primary}
        />
        <KpiCard
          label="Revenue" icon="💰"
          value={`₹${Math.round(data?.summary.totalRevenue ?? 0).toLocaleString('en-IN')}`}
          sub={`₹${Math.round((data?.summary.totalRevenue ?? 0) / Math.max(data?.summary.reportCount ?? 1, 1))} avg`}
          color={COLORS.success}
        />
        <KpiCard
          label="UPI Share" icon="📱"
          value={`${upiPct}%`}
          sub={`₹${Math.round(data?.summary.totalUPI ?? 0).toLocaleString('en-IN')} via UPI`}
          color={COLORS.info}
        />
        <KpiCard
          label="Flagged" icon="🚨"
          value={String(data?.summary.flaggedCount ?? 0)}
          sub="suspicious reports"
          color={COLORS.danger}
        />
      </View>

      {/* Cups Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Cups Sold — Daily Trend</Text>
        <LineChart
          data={charts.cups}
          width={chartW}
          height={180}
          chartConfig={chartConfig}
          bezier
          withInnerLines={false}
          withOuterLines={false}
          style={styles.chart}
        />
      </View>

      {/* Revenue Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Revenue (₹) — Daily</Text>
        <BarChart
          data={charts.revenue}
          width={chartW}
          height={180}
          chartConfig={{ ...chartConfig, color: (o = 1) => `rgba(29, 158, 117, ${o})` }}
          style={styles.chart}
          withInnerLines={false}
          showValuesOnTopOfBars
          yAxisLabel="₹"
          yAxisSuffix=""
        />
      </View>

      {/* Payment Breakdown */}
      <View style={styles.payCard}>
        <Text style={styles.cardTitle}>Payment Breakdown</Text>
        <View style={styles.payRow}>
          <PayBar label="UPI" amount={data?.summary.totalUPI ?? 0} total={data?.summary.totalRevenue ?? 1} color={COLORS.info} />
          <PayBar label="Cash" amount={data?.summary.totalCash ?? 0} total={data?.summary.totalRevenue ?? 1} color={COLORS.warning} />
        </View>
      </View>

      {/* Staff Leaderboard */}
      {(data?.staffPerformance?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Staff Performance</Text>
          <View style={styles.leaderboard}>
            {data!.staffPerformance.map((staff, i) => (
              <View key={staff._id} style={styles.leaderRow}>
                <Text style={[styles.rank, i === 0 && { color: COLORS.primary }]}>
                  {i === 0 ? '👑' : `#${i + 1}`}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.staffName}>{staff.name}</Text>
                  <Text style={styles.staffSub}>{staff.cups} cups · {staff.momoPackets || 0} momos · {staff.reports} reports</Text>
                </View>
                <Text style={styles.staffRevenue}>₹{Math.round(staff.revenue).toLocaleString('en-IN')}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {(data?.staffPerformance?.length ?? 0) === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyText}>No report data for this period</Text>
          <Text style={styles.emptySub}>Data appears once reports are submitted</Text>
        </View>
      )}
    </ScrollView>
  );
}

function KpiCard({ label, icon, value, sub, color }: any) {
  return (
    <View style={[styles.kpiCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiSub}>{sub}</Text>
    </View>
  );
}

function PayBar({ label, amount, total, color }: any) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.payLabelRow}>
        <Text style={styles.payLabel}>{label}</Text>
        <Text style={[styles.payPct, { color }]}>{Math.round(pct)}%</Text>
      </View>
      <View style={styles.payTrack}>
        <View style={[styles.payFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={styles.payAmount}>₹{Math.round(amount).toLocaleString('en-IN')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  toggleRow: {
    flexDirection: 'row', margin: SPACING.xl, backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md, padding: 3, borderWidth: 1, borderColor: COLORS.border,
  },
  toggleBtn: { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center', borderRadius: BORDER_RADIUS.sm - 2 },
  toggleBtnActive: { backgroundColor: COLORS.primaryBg, borderWidth: 1, borderColor: COLORS.border },
  toggleText: { fontSize: FONT_SIZE.sm, color: COLORS.muted, fontWeight: '600' },
  toggleTextActive: { color: COLORS.primary, fontWeight: '700' },

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

  payCard: {
    backgroundColor: COLORS.white, margin: SPACING.xl, marginBottom: 0,
    borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, ...SHADOWS.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.dark, marginBottom: SPACING.lg },
  payRow: { flexDirection: 'row', gap: SPACING.xl },
  payLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  payLabel: { fontSize: FONT_SIZE.sm, color: COLORS.medium, fontWeight: '600' },
  payPct: { fontSize: FONT_SIZE.md, fontWeight: '800' },
  payTrack: { height: 8, backgroundColor: COLORS.borderLight, borderRadius: 4, marginTop: 6, overflow: 'hidden' },
  payFill: { height: '100%', borderRadius: 4 },
  payAmount: { fontSize: FONT_SIZE.sm, color: COLORS.dark, fontWeight: '700', marginTop: 4 },

  section: { padding: SPACING.xl, paddingBottom: 0 },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.black, marginBottom: SPACING.md },
  leaderboard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border,
  },
  leaderRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  rank: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.primaryLight, width: 36 },
  staffName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black },
  staffSub: { fontSize: FONT_SIZE.sm, color: COLORS.muted },
  staffRevenue: { fontSize: FONT_SIZE.md, fontWeight: '800', color: COLORS.success },

  empty: { alignItems: 'center', padding: SPACING.xl * 2 },
  emptyIcon: { fontSize: 56, marginBottom: SPACING.md },
  emptyText: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.dark },
  emptySub: { fontSize: FONT_SIZE.md, color: COLORS.muted, marginTop: SPACING.sm, textAlign: 'center' },
});
