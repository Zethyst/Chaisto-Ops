import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../components/AppAlert';
import { reportService } from '../../services/reportService';
import { DailyReport } from '../../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';
import { toISODate } from '../../utils/date';

const STATUS_FILTERS = ['All', 'Draft', 'Submitted', 'Reviewed', 'Flagged'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

function dateLabel(d: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function toDateStr(d: Date): string {
  return toISODate(d);
}

export default function ReportsListScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [reports, setReports] = useState<DailyReport[]>([]);
  // Reports a staff member started and never submitted — listed separately so a
  // half-entered day reads as unfinished rather than missing
  const [drafts, setDrafts] = useState<DailyReport[]>([]);
  const [draftsFailed, setDraftsFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  const load = useCallback(async (date: Date) => {
    const day = toDateStr(date);
    try {
      const [submitted, unfinished] = await Promise.all([
        reportService.getReportsByDate(day),
        // Drafts are a secondary view of the day — a failure here must not hide
        // the reports that did come in, but it must not pass unnoticed either:
        // silently swallowing it makes a server without the drafts endpoint
        // look exactly like a day with nothing unfinished
        reportService.getDrafts({ date: day })
          .then((rows) => { setDraftsFailed(false); return rows; })
          .catch(() => { setDraftsFailed(true); return [] as DailyReport[]; }),
      ]);
      setReports(submitted);
      setDrafts(unfinished);
    } catch {
      showAlert('Error', 'Could not load reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(selectedDate);
  }, [selectedDate]);

  // Coming back from editing or filing a draft should not show stale figures
  useEffect(() => navigation.addListener('focus', () => load(selectedDate)), [navigation, selectedDate, load]);

  const changeDate = (delta: number) => {
    haptics.selection();
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    if (d > new Date()) return;
    setSelectedDate(d);
  };

  const filtered = statusFilter === 'All'
    ? reports
    : statusFilter === 'Draft'
      ? []
      : reports.filter((r) => r.status === statusFilter.toLowerCase());
  const visibleDrafts = statusFilter === 'All' || statusFilter === 'Draft' ? drafts : [];
  const nothingToShow = filtered.length === 0 && visibleDrafts.length === 0;

  const isToday = toDateStr(selectedDate) === toDateStr(new Date());

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Date Navigator */}
      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.dateArrow} onPress={() => changeDate(-1)}>
          <Text style={styles.dateArrowText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.dateLabelWrap}>
          <Text style={styles.dateLabel}>{dateLabel(selectedDate)}</Text>
          <Text style={styles.dateSub}>{selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        </View>
        <TouchableOpacity
          style={[styles.dateArrow, isToday && styles.dateArrowDisabled]}
          onPress={() => changeDate(1)}
          disabled={isToday}
        >
          <Text style={[styles.dateArrowText, isToday && { color: COLORS.border }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Backfill entry point — for days nobody filed a report */}
      <TouchableOpacity
        style={styles.backfillBtn}
        onPress={() => { haptics.light(); navigation.navigate('BackfillReport'); }}
      >
        <Text style={styles.backfillBtnText}>＋  Add a past report</Text>
      </TouchableOpacity>

      {/* Status Filter Pills */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, statusFilter === f && styles.filterPillActive]}
            onPress={() => { haptics.selection(); setStatusFilter(f); }}
          >
            <Text style={[styles.filterText, statusFilter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(selectedDate); }} tintColor={COLORS.primaryLight} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary strip — submitted reports only; a draft is not a record yet */}
          {reports.length > 0 && (
            <View style={styles.summaryStrip}>
              <SummaryItem
                label="REPORTS"
                value={String(reports.length)}
                color={COLORS.primary}
              />
              <View style={styles.summaryDivider} />
              <SummaryItem
                label="TOTAL CUPS"
                value={String(reports.reduce((s, r) => s + (r.sales?.regularCups || 0) + (r.sales?.specialCups || 0) + (r.sales?.kulhadCups || 0), 0))}
                color={COLORS.primary}
              />
              <View style={styles.summaryDivider} />
              <SummaryItem
                label="TOTAL MOMOS"
                value={String(reports.reduce((s, r) => s + (r.sales?.vegMomoPackets || 0) + (r.sales?.paneerMomoPackets || 0), 0))}
                color={COLORS.primary}
              />
              <View style={styles.summaryDivider} />
              <SummaryItem
                label="REVENUE"
                value={`₹${reports.reduce((s, r) => s + (r.payments?.upi || 0) + (r.payments?.cash || 0), 0).toLocaleString('en-IN')}`}
                color={COLORS.success}
              />
              <View style={styles.summaryDivider} />
              <SummaryItem
                label="FLAGS"
                value={String(reports.reduce((s, r) => s + (r.flags?.length || 0), 0))}
                color={COLORS.danger}
              />
            </View>
          )}

          {draftsFailed && (
            <View style={styles.draftsError}>
              <Text style={styles.draftsErrorText}>
                Unfinished reports could not be loaded, so any half-entered day is missing from this list.
              </Text>
            </View>
          )}

          {/* Unfinished reports — started by staff, never submitted */}
          {visibleDrafts.length > 0 && (
            <>
              <Text style={styles.groupTitle}>
                UNFINISHED · {visibleDrafts.length} NOT SUBMITTED
              </Text>
              {visibleDrafts.map((draft) => (
                <ReportCard
                  key={draft._id || draft.id}
                  report={draft}
                  onPress={() => {
                    haptics.light();
                    navigation.navigate('EditDraft', { draftId: draft._id || draft.id });
                  }}
                />
              ))}
            </>
          )}

          {/* Report cards */}
          {visibleDrafts.length > 0 && filtered.length > 0 && (
            <Text style={styles.groupTitle}>SUBMITTED · {filtered.length}</Text>
          )}
          {nothingToShow ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>
                {reports.length === 0 && drafts.length === 0 ? 'No reports submitted' : 'No matching reports'}
              </Text>
              <Text style={styles.emptySub}>
                {reports.length === 0 && drafts.length === 0
                  ? `No staff submitted a report on ${selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}`
                  : `Try a different filter`}
              </Text>
              {reports.length === 0 && drafts.length === 0 && (
                <TouchableOpacity
                  style={styles.emptyAction}
                  onPress={() => { haptics.light(); navigation.navigate('BackfillReport'); }}
                >
                  <Text style={styles.emptyActionText}>Enter it for them</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filtered.map((report) => (
              <ReportCard
                key={report._id || report.id}
                report={report}
                onPress={() => {
                  haptics.light();
                  navigation.navigate('ReportDetail', { reportId: report._id || report.id });
                }}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ReportCard({ report, onPress }: { report: DailyReport; onPress: () => void }) {
  const cups = (report.sales?.regularCups || 0) + (report.sales?.specialCups || 0) + (report.sales?.kulhadCups || 0);
  const momoPackets = (report.sales?.vegMomoPackets || 0) + (report.sales?.paneerMomoPackets || 0);
  const revenue = (report.payments?.upi || 0) + (report.payments?.cash || 0);
  const upiPct = revenue > 0 ? Math.round((report.payments?.upi / revenue) * 100) : 0;
  const flagCount = report.flags?.length || 0;
  const isDraft = !!report.isDraft;
  // A draft has no submission time — the last autosave is what there is to show
  const stamp = isDraft ? report.updatedAt : report.submittedAt;
  const timeText = stamp
    ? `${isDraft ? '💾 saved' : '⏱'} ${new Date(stamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`
    : null;

  const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    submitted:  { color: COLORS.info,    bg: COLORS.infoBg,    label: 'SUBMITTED' },
    reviewed:   { color: COLORS.success, bg: COLORS.successBg, label: 'REVIEWED' },
    flagged:    { color: COLORS.danger,  bg: COLORS.dangerBg,  label: 'FLAGGED' },
    draft:      { color: COLORS.muted,   bg: COLORS.surface,   label: 'DRAFT' },
  };
  const sc = statusConfig[report.status] ?? statusConfig.submitted;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{report.staffName?.charAt(0)?.toUpperCase() || 'S'}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={styles.staffName}>{report.staffName}</Text>
          <Text style={styles.stallName}>{report.stallName || '—'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
        </View>
      </View>

      {/* Metrics row */}
      <View style={styles.metricsRow}>
        <MetricChip icon="☕" value={`${cups} cups`} color={COLORS.primary} />
        {momoPackets > 0 && <MetricChip icon="🥟" value={`${momoPackets} momos`} color={COLORS.primary} />}
        <MetricChip icon="💰" value={`₹${revenue.toLocaleString('en-IN')}`} color={COLORS.success} />
        <MetricChip icon="📱" value={`${upiPct}% UPI`} color={COLORS.info} />
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <View style={styles.footerLeft}>
          {timeText && (
            <Text style={styles.timeText}>{timeText}</Text>
          )}
          {flagCount > 0 && (
            <View style={styles.flagBadge}>
              <Text style={styles.flagBadgeText}>🚨 {flagCount} flag{flagCount > 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>
        <Text style={styles.viewArrow}>{isDraft ? 'Edit →' : 'View →'}</Text>
      </View>

      {/* Flag preview */}
      {flagCount > 0 && report.flags?.[0] && (
        <View style={[styles.flagPreview, {
          borderLeftColor: report.flags[0].severity === 'high' ? COLORS.danger : COLORS.warning,
          backgroundColor: report.flags[0].severity === 'high' ? COLORS.dangerBg : COLORS.warningBg,
        }]}>
          <Text style={[styles.flagPreviewText, {
            color: report.flags[0].severity === 'high' ? COLORS.danger : COLORS.warning,
          }]} numberOfLines={1}>
            {report.flags[0].message}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function MetricChip({ icon, value, color }: { icon: string; value: string; color: string }) {
  return (
    <View style={styles.metricChip}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },

  dateNav: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  dateArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dateArrowDisabled: { opacity: 0.3 },
  dateArrowText: { fontSize: 28, fontWeight: '700', color: COLORS.primary },
  dateLabelWrap: { flex: 1, alignItems: 'center' },
  dateLabel: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.black },
  dateSub: { fontSize: FONT_SIZE.xs, color: COLORS.muted, marginTop: 1 },

  filterRow: {
    flexDirection: 'row', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    gap: SPACING.sm, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  filterPill: {
    paddingHorizontal: SPACING.md, paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  filterPillActive: { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primary },
  filterText: { fontSize: FONT_SIZE.sm, color: COLORS.muted, fontWeight: '600' },
  filterTextActive: { color: COLORS.primary, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.lg, paddingBottom: 48 },

  summaryStrip: {
    flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: SPACING.md },
  summaryValue: { fontSize: FONT_SIZE.lg, fontWeight: '800' },
  summaryLabel: { fontSize: 9, color: COLORS.muted, fontWeight: '700', letterSpacing: 0.8, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.sm },

  backfillBtn: {
    marginHorizontal: SPACING.xl, marginTop: SPACING.md,
    borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.sm, alignItems: 'center',
  },
  backfillBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: FONT_SIZE.sm },

  emptyAction: {
    marginTop: SPACING.lg, backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
  },
  emptyActionText: { color: '#fff', fontWeight: '800', fontSize: FONT_SIZE.md },

  draftsError: {
    backgroundColor: COLORS.warningBg, borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3, borderLeftColor: COLORS.warning,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  draftsErrorText: { fontSize: FONT_SIZE.sm, color: '#7A5C00', fontWeight: '600', lineHeight: 18 },

  groupTitle: {
    fontSize: 10, fontWeight: '800', color: COLORS.muted, letterSpacing: 1.2,
    marginBottom: SPACING.sm, marginTop: SPACING.xs,
  },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 52, marginBottom: SPACING.lg },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.dark },
  emptySub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: SPACING.sm, textAlign: 'center' },

  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  avatarCircle: {
    width: 44, height: 44, borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.primary },
  staffName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black },
  stallName: { fontSize: FONT_SIZE.xs, color: COLORS.muted, marginTop: 2 },
  statusBadge: { borderRadius: BORDER_RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  metricsRow: {
    flexDirection: 'row', paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md, gap: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  metricChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.sm,
    paddingVertical: SPACING.sm,
  },
  metricIcon: { fontSize: 14 },
  metricValue: { fontSize: FONT_SIZE.sm, fontWeight: '700' },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  timeText: { fontSize: FONT_SIZE.sm, color: COLORS.muted },
  flagBadge: {
    backgroundColor: COLORS.dangerBg, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
  },
  flagBadgeText: { fontSize: 11, color: COLORS.danger, fontWeight: '700' },
  viewArrow: { fontSize: FONT_SIZE.sm, color: COLORS.primaryLight, fontWeight: '700' },

  flagPreview: {
    borderLeftWidth: 3, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
  },
  flagPreviewText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
});
