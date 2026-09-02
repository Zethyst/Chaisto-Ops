import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { expenseService } from '../../services/expenseService';
import { reportService } from '../../services/reportService';
import { wastageService } from '../../services/wastageService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function prevMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function PnLReportScreen() {
  const { user } = useSelector((s: RootState) => s.auth);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [revenue, setRevenue] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [expenseBreakdown, setExpenseBreakdown] = useState<Record<string, number>>({});
  const [wastage, setWastage] = useState(0);
  const [reportCount, setReportCount] = useState(0);
  const [totalCups, setTotalCups] = useState(0);
  const [totalMomoPieces, setTotalMomoPieces] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [analytics, expList, wastageList] = await Promise.all([
        reportService.getAnalytics({ days: 31 }),
        expenseService.getExpenses({ month }),
        wastageService.getWastageLogs({ month }),
      ]);

      const rev = analytics?.summary?.totalRevenue || 0;
      setRevenue(rev);
      setReportCount(analytics?.summary?.reportCount || 0);
      setTotalCups(analytics?.summary?.totalCups || 0);
      setTotalMomoPieces(analytics?.summary?.totalMomoPieces || 0);

      const expTotal = expList.reduce((s: number, e: any) => s + (e.amount || 0), 0);
      setExpenses(expTotal);

      const breakdown: Record<string, number> = {};
      expList.forEach((e: any) => { breakdown[e.category] = (breakdown[e.category] || 0) + e.amount; });
      setExpenseBreakdown(breakdown);

      const wastTotal = wastageList.reduce((s: number, w: any) => s + (w.totalEstimatedLoss || 0), 0);
      setWastage(wastTotal);
    } catch (err) {
      console.error('PnL load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [month]);

  const profit = revenue - expenses - wastage;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0';

  const PnLRow = ({ label, value, color, bold }: { label: string; value: number; color: string; bold?: boolean }) => (
    <View style={[styles.pnlRow, bold && styles.pnlRowBold]}>
      <Text style={[styles.pnlLabel, bold && styles.pnlLabelBold]}>{label}</Text>
      <Text style={[styles.pnlValue, { color }, bold && styles.pnlValueBold]}>
        {value < 0 ? '-' : ''}₹{Math.abs(value).toLocaleString('en-IN')}
      </Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primaryLight} />}
    >
      {/* Month picker */}
      <View style={styles.monthPicker}>
        <TouchableOpacity onPress={() => { haptics.selection(); setMonth(prevMonth(month)); }}>
          <Text style={styles.monthArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
        <TouchableOpacity
          onPress={() => { haptics.selection(); setMonth(nextMonth(month)); }}
          disabled={month >= new Date().toISOString().slice(0, 7)}
        >
          <Text style={[styles.monthArrow, month >= new Date().toISOString().slice(0, 7) && styles.arrowDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <>
          {/* Profit headline card */}
          <View style={[styles.headlineCard, { borderColor: profit >= 0 ? COLORS.success : COLORS.danger }]}>
            <Text style={styles.headlineSub}>Net Profit</Text>
            <Text style={[styles.headlineAmount, { color: profit >= 0 ? COLORS.success : COLORS.danger }]}>
              {profit < 0 ? '-' : ''}₹{Math.abs(profit).toLocaleString('en-IN')}
            </Text>
            <Text style={styles.headlineMargin}>Margin: {margin}%</Text>
          </View>

          {/* KPI row */}
          <View style={styles.kpiRow}>
            <KpiCard label="Revenue" value={`₹${revenue.toLocaleString('en-IN')}`} icon="💰" color={COLORS.success} />
            <KpiCard label="Expenses" value={`₹${expenses.toLocaleString('en-IN')}`} icon="💸" color={COLORS.danger} />
            <KpiCard label="Reports" value={String(reportCount)} icon="📋" color={COLORS.info} />
            <KpiCard label="Cups" value={String(totalCups)} icon="☕" color={COLORS.primary} />
            <KpiCard label="Momos" value={String(totalMomoPieces)} icon="🥟" color={COLORS.primary} />
          </View>

          {/* P&L Statement */}
          <View style={styles.pnlCard}>
            <Text style={styles.cardTitle}>P&L Statement</Text>

            <PnLRow label="Total Revenue" value={revenue} color={COLORS.success} />
            <View style={styles.divider} />

            <Text style={styles.subheading}>Expenses</Text>
            {Object.entries(expenseBreakdown).map(([cat, amt]) => (
              <PnLRow key={cat} label={`  ${cat.charAt(0).toUpperCase() + cat.slice(1)}`} value={-amt} color={COLORS.danger} />
            ))}
            {Object.keys(expenseBreakdown).length === 0 && (
              <Text style={styles.noData}>No expenses logged</Text>
            )}
            <PnLRow label="Total Expenses" value={-expenses} color={COLORS.danger} bold />

            {wastage > 0 && (
              <>
                <View style={styles.divider} />
                <PnLRow label="Wastage Loss" value={-wastage} color={COLORS.warning} />
              </>
            )}

            <View style={styles.divider} />
            <PnLRow label="Net Profit / Loss" value={profit} color={profit >= 0 ? COLORS.success : COLORS.danger} bold />
          </View>

          <Text style={styles.disclaimer}>
            * Expense data from logged entries only. Wastage loss based on admin estimates.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

function KpiCard({ label, value, icon, color }: any) {
  return (
    <View style={styles.kpiCard}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { paddingBottom: 40 },
  center: { paddingVertical: 60, alignItems: 'center' },

  monthPicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: SPACING.xl, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.xl,
  },
  monthArrow: { fontSize: 28, color: COLORS.primary, fontWeight: '700', paddingHorizontal: SPACING.md },
  arrowDisabled: { color: COLORS.border },
  monthLabel: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.black, minWidth: 160, textAlign: 'center' },

  headlineCard: {
    margin: SPACING.xl, borderRadius: BORDER_RADIUS.lg, padding: SPACING.xl,
    backgroundColor: COLORS.white, alignItems: 'center',
    borderWidth: 2, ...SHADOWS.md,
  },
  headlineSub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, fontWeight: '600' },
  headlineAmount: { fontSize: 44, fontWeight: '900', marginTop: 4 },
  headlineMargin: { fontSize: FONT_SIZE.sm, color: COLORS.medium, marginTop: 4 },

  kpiRow: { flexDirection: 'row', paddingHorizontal: SPACING.xl, gap: SPACING.sm, marginBottom: SPACING.xl },
  kpiCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  kpiValue: { fontSize: FONT_SIZE.lg, fontWeight: '800', marginTop: 4 },
  kpiLabel: { fontSize: 10, color: COLORS.muted, marginTop: 2 },

  pnlCard: {
    marginHorizontal: SPACING.xl, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  cardTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.black, marginBottom: SPACING.lg },
  subheading: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.muted, marginTop: SPACING.md, marginBottom: SPACING.sm, letterSpacing: 0.5 },
  pnlRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  pnlRowBold: { paddingTop: SPACING.sm },
  pnlLabel: { fontSize: FONT_SIZE.md, color: COLORS.dark },
  pnlLabelBold: { fontWeight: '700', color: COLORS.black },
  pnlValue: { fontSize: FONT_SIZE.md, fontWeight: '600' },
  pnlValueBold: { fontSize: FONT_SIZE.lg, fontWeight: '800' },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.sm },
  noData: { fontSize: FONT_SIZE.sm, color: COLORS.muted, paddingVertical: 8 },

  disclaimer: {
    fontSize: 11, color: COLORS.muted, textAlign: 'center',
    marginHorizontal: SPACING.xl, marginTop: SPACING.lg,
  },
});
