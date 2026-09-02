import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
   ActivityIndicator, RefreshControl, TextInput, Modal,
   Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform,
} from 'react-native';
import { showAlert } from '../../components/AppAlert';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { payrollService } from '../../services/payrollService';
import { PayrollSummary } from '../../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';

function currentMonth() { return new Date().toISOString().slice(0, 7); }
function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

export default function PayrollScreen() {
  const { user } = useSelector((s: RootState) => s.auth);
  const isAdmin = user?.role === 'admin';

  const [month, setMonth] = useState(currentMonth());
  const [payroll, setPayroll] = useState<PayrollSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [salaryModal, setSalaryModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<PayrollSummary | null>(null);
  const [salaryInput, setSalaryInput] = useState('');
  const [savingSalary, setSavingSalary] = useState(false);
  const [salaryError, setSalaryError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await payrollService.getAllPayroll({ month });
      setPayroll(data);
    } catch {
      showAlert('Error', 'Could not load payroll');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [month]);

  const openSalaryModal = (p: PayrollSummary) => {
    haptics.light();
    setSelectedStaff(p);
    setSalaryInput(String(p.baseSalary || ''));
    setSalaryError(null);
    setSalaryModal(true);
  };

  const handleSaveSalary = async () => {
    const salary = parseFloat(salaryInput);
    if (isNaN(salary) || salary < 0) {
      setSalaryError('Enter a valid salary amount.');
      return;
    }
    setSalaryError(null);
    haptics.medium();
    setSavingSalary(true);
    try {
      await payrollService.setSalary(selectedStaff!.staffId.toString(), salary);
      haptics.success();
      setSalaryModal(false);
      load();
    } catch (err: any) {
      haptics.error();
      setSalaryError(err.response?.data?.error || 'Could not update salary. Please try again.');
    } finally {
      setSavingSalary(false);
    }
  };

  const totalPayroll = payroll.reduce((s, p) => s + p.totalPay, 0);
  const totalIncentives = payroll.reduce((s, p) => s + p.cupsIncentive + (p.momoIncentive || 0), 0);
  const totalCups = payroll.reduce((s, p) => s + p.totalCups, 0);
  // Momos are shown in pieces — plate-equivalents are fractional and read as
  // nonsense next to a whole-number cup count
  const totalMomoPieces = payroll.reduce((s, p) => s + (p.totalMomoPieces ?? 0), 0);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primaryLight} />}
      >
        {/* Month picker */}
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={() => {
            haptics.selection();
            const [y, m] = month.split('-').map(Number);
            const d = new Date(y, m - 2);
            setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
          }}>
            <Text style={styles.monthArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
          <TouchableOpacity
            disabled={month >= currentMonth()}
            onPress={() => {
              haptics.selection();
              const [y, m] = month.split('-').map(Number);
              const d = new Date(y, m);
              setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
            }}
          >
            <Text style={[styles.monthArrow, month >= currentMonth() && { color: COLORS.border }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Summary bar */}
        <View style={styles.summaryBar}>
          <SummaryItem label="Total Payout" value={`₹${totalPayroll.toLocaleString('en-IN')}`} color={COLORS.danger} />
          <SummaryItem label="Incentives" value={`₹${totalIncentives.toLocaleString('en-IN')}`} color={COLORS.success} />
          <SummaryItem label="Total Cups" value={String(totalCups)} color={COLORS.primary} />
          <SummaryItem label="Total Momos" value={String(totalMomoPieces)} color={COLORS.primary} />
        </View>

        {/* Staff cards */}
        <Text style={styles.sectionTitle}>Staff Payroll</Text>
        {payroll.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40 }}>💼</Text>
            <Text style={styles.emptyText}>No staff payroll data</Text>
          </View>
        ) : (
          payroll.map((p) => (
            <View key={p.staffId.toString()} style={styles.staffCard}>
              <View style={styles.staffHeader}>
                <View style={styles.staffAvatar}>
                  <Text style={styles.staffAvatarText}>{p.staffName?.charAt(0) || 'S'}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.staffName}>{p.staffName}</Text>
                  <Text style={styles.staffStall}>{p.stallName || '—'}</Text>
                </View>
                <Text style={styles.totalPay}>₹{p.totalPay.toLocaleString('en-IN')}</Text>
              </View>

              <View style={styles.payBreakdown}>
                <PayRow label="Base Salary" value={p.baseSalary} />
                <PayRow label={`Cup Incentive (${p.totalCups} cups × ₹${p.cupRate ?? 1})`} value={p.cupsIncentive} color={COLORS.success} />
                <PayRow label={momoIncentiveLabel(p)} value={p.momoIncentive || 0} color={COLORS.success} />
                <View style={styles.payDivider} />
                <PayRow label="Total Payout" value={p.totalPay} bold color={COLORS.danger} />
              </View>

              <View style={styles.statsRow}>
                <StatChip icon="☕" label={`${p.totalCups} cups`} />
                <StatChip icon="🥟" label={`${p.totalMomoPieces ?? 0} momos`} />
                <StatChip icon="📋" label={`${p.reportCount} reports`} />
                <StatChip icon="💰" label={`₹${p.totalRevenue.toLocaleString('en-IN')} rev`} />
                {isAdmin && (
                  <TouchableOpacity style={styles.editSalaryBtn} onPress={() => openSalaryModal(p)}>
                    <Text style={styles.editSalaryText}>Set Salary</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={salaryModal} animationType="slide" transparent onRequestClose={() => setSalaryModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Set Base Salary</Text>
                <Text style={styles.modalSub}>{selectedStaff?.staffName}</Text>
                {salaryError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>⚠️ {salaryError}</Text>
                  </View>
                )}
                <Text style={styles.fieldLabel}>Monthly Base Salary (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={salaryInput}
                  onChangeText={setSalaryInput}
                  keyboardType="numeric"
                  placeholder="e.g. 8000"
                  placeholderTextColor={COLORS.muted}
                />
                <Text style={styles.hint}>Cup and momo incentives are added automatically from report data.</Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setSalaryModal(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, savingSalary && { opacity: 0.6 }]} onPress={handleSaveSalary} disabled={savingSalary}>
                    {savingSalary ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/**
 * The incentive is paid per plate sold, but staff count momos in pieces — so
 * the line shows both, and the plate figure is trimmed of a trailing ".0" when
 * the pieces divide evenly.
 */
function momoIncentiveLabel(p: PayrollSummary) {
  const pieces = p.totalMomoPieces ?? 0;
  const plates = p.totalMomoPlates ?? p.totalMomoPackets ?? 0;
  const rate = p.momoRate ?? 5;
  const platesLabel = Number.isInteger(plates) ? String(plates) : plates.toFixed(1);
  return `Momo Incentive (${pieces} momos = ${platesLabel} plates × ₹${rate})`;
}

function SummaryItem({ label, value, color }: any) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function PayRow({ label, value, bold, color }: any) {
  return (
    <View style={styles.payRow}>
      <Text style={[styles.payLabel, bold && styles.payLabelBold]}>{label}</Text>
      <Text style={[styles.payValue, bold && styles.payValueBold, color && { color }]}>
        ₹{(value || 0).toLocaleString('en-IN')}
      </Text>
    </View>
  );
}

function StatChip({ icon, label }: any) {
  return (
    <View style={styles.statChip}>
      <Text style={{ fontSize: 13 }}>{icon}</Text>
      <Text style={styles.statChipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  monthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: SPACING.xl, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.xl,
  },
  monthArrow: { fontSize: 28, color: COLORS.primary, fontWeight: '700', paddingHorizontal: SPACING.md },
  monthLabel: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.black, minWidth: 160, textAlign: 'center' },

  summaryBar: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    paddingVertical: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: FONT_SIZE.xl, fontWeight: '800' },
  summaryLabel: { fontSize: FONT_SIZE.xs, color: COLORS.muted, marginTop: 2 },

  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.black, padding: SPACING.xl, paddingBottom: SPACING.md },

  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxxl },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.muted, marginTop: SPACING.md },

  staffCard: {
    backgroundColor: COLORS.white, marginHorizontal: SPACING.xl, marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  staffHeader: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  staffAvatar: {
    width: 44, height: 44, borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center',
  },
  staffAvatarText: { color: COLORS.primary, fontWeight: '800', fontSize: FONT_SIZE.lg },
  staffName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black },
  staffStall: { fontSize: FONT_SIZE.xs, color: COLORS.muted, marginTop: 2 },
  totalPay: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.danger },

  payBreakdown: { padding: SPACING.lg, backgroundColor: COLORS.surface },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  payLabel: { fontSize: FONT_SIZE.sm, color: COLORS.medium },
  payLabelBold: { fontWeight: '700', color: COLORS.black },
  payValue: { fontSize: FONT_SIZE.sm, color: COLORS.dark, fontWeight: '600' },
  payValueBold: { fontSize: FONT_SIZE.md, fontWeight: '800' },
  payDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },

  statsRow: { flexDirection: 'row', padding: SPACING.md, gap: SPACING.sm, flexWrap: 'wrap', alignItems: 'center' },
  statChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryBg,
    borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 4, gap: 4,
  },
  statChipText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  editSalaryBtn: {
    marginLeft: 'auto', backgroundColor: COLORS.adminBg, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: 4,
  },
  editSalaryText: { fontSize: 11, color: COLORS.admin, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, paddingBottom: 40,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.black, marginBottom: 4 },
  modalSub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginBottom: SPACING.xl },
  errorBanner: {
    backgroundColor: COLORS.dangerBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.danger,
  },
  errorBannerText: { fontSize: FONT_SIZE.sm, color: COLORS.danger, fontWeight: '600', lineHeight: 20 },
  fieldLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.dark, marginBottom: SPACING.sm },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.black, backgroundColor: COLORS.surface, marginBottom: SPACING.sm,
  },
  hint: { fontSize: FONT_SIZE.xs, color: COLORS.muted, marginBottom: SPACING.lg },
  modalActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md, alignItems: 'center',
  },
  cancelText: { fontSize: FONT_SIZE.md, color: COLORS.medium, fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
});
