import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
   ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { showAlert } from '../../components/AppAlert';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { attendanceService } from '../../services/attendanceService';
import { authService } from '../../services/authService';
import { AttendanceRecord } from '../../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';

const STATUSES: { key: AttendanceRecord['status']; label: string; color: string; bg: string }[] = [
  { key: 'present', label: 'Present', color: COLORS.success, bg: COLORS.successBg },
  { key: 'absent', label: 'Absent', color: COLORS.danger, bg: COLORS.dangerBg },
  { key: 'halfday', label: 'Half Day', color: COLORS.warning, bg: COLORS.warningBg },
  { key: 'leave', label: 'Leave', color: COLORS.info, bg: COLORS.infoBg },
];

function currentMonth() { return new Date().toISOString().slice(0, 7); }
function today() { return new Date().toISOString().split('T')[0]; }
function daysInMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo, 0).getDate();
}

export default function AttendanceScreen() {
  const { user } = useSelector((s: RootState) => s.auth);
  const isAdmin = user?.role === 'admin' || user?.role === 'moderator';

  const [month, setMonth] = useState(currentMonth());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Mark attendance modal
  const [markModal, setMarkModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(today());
  const [selectedStatus, setSelectedStatus] = useState<AttendanceRecord['status']>('present');
  const [saving, setSaving] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  const load = async () => {
    try {
      if (isAdmin) {
        const [recs, sum, staff] = await Promise.all([
          attendanceService.getAttendance({ stallId: user?.stallId, month }),
          attendanceService.getAttendanceSummary({ stallId: user?.stallId, month }),
          authService.getUsers(),
        ]);
        setRecords(recs);
        setSummary(sum);
        setStaffList(Array.isArray(staff) ? staff.filter((s: any) => s.role === 'staff') : []);
      } else {
        const recs = await attendanceService.getAttendance({ userId: user?.id, month });
        setRecords(recs);
      }
    } catch {
      showAlert('Error', 'Could not load attendance');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [month]);

  const openMarkModal = (staffMember: any) => {
    haptics.light();
    setSelectedStaff(staffMember);
    setSelectedDate(today());
    setSelectedStatus('present');
    setMarkError(null);
    setMarkModal(true);
  };

  const handleMark = async () => {
    if (!selectedStaff) return;
    setMarkError(null);
    haptics.medium();
    setSaving(true);
    try {
      await attendanceService.markAttendance({
        userId: selectedStaff.id || selectedStaff._id,
        userName: selectedStaff.name,
        stallId: selectedStaff.stallId || user!.stallId!,
        date: selectedDate,
        status: selectedStatus,
      });
      haptics.success();
      setMarkModal(false);
      load();
    } catch (err: any) {
      haptics.error();
      setMarkError(err.response?.data?.error || 'Could not mark attendance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Get record for a specific staff+date
  const getRecord = (userId: string, date: string) =>
    records.find((r) => (r.userId === userId || (r as any).userId?.toString() === userId) && r.date === date);

  const statusStyle = (s: AttendanceRecord['status']) => {
    const st = STATUSES.find((x) => x.key === s);
    return { bg: st?.bg || COLORS.surface, color: st?.color || COLORS.muted, label: st?.label || s };
  };

  // Build last 7 days for quick view
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  // Staff: own attendance view
  if (!isAdmin) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primaryLight} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Attendance</Text>
          <Text style={styles.headerSub}>{month}</Text>
        </View>
        {records.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40 }}>📅</Text>
            <Text style={styles.emptyText}>No attendance records for this month</Text>
          </View>
        ) : (
          records.map((r) => {
            const s = statusStyle(r.status);
            const rid = (r as any)._id || r.id;
            return (
              <View key={rid} style={styles.recordRow}>
                <Text style={styles.recordDate}>{r.date}</Text>
                <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                  <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
                </View>
                {r.notes ? <Text style={styles.recordNote}>{r.notes}</Text> : null}
              </View>
            );
          })
        )}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primaryLight} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Attendance</Text>
          <Text style={styles.headerSub}>{month}</Text>
        </View>

        {/* Monthly summary */}
        {summary.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.cardTitle}>Monthly Summary</Text>
            {summary.map((s: any) => (
              <View key={s._id?.toString()} style={styles.summaryRow}>
                <Text style={styles.summaryName}>{s.userName}</Text>
                <View style={styles.summaryChips}>
                  <Chip label={`${s.present}P`} color={COLORS.success} bg={COLORS.successBg} />
                  <Chip label={`${s.absent}A`} color={COLORS.danger} bg={COLORS.dangerBg} />
                  {s.halfday > 0 && <Chip label={`${s.halfday}H`} color={COLORS.warning} bg={COLORS.warningBg} />}
                  {s.leave > 0 && <Chip label={`${s.leave}L`} color={COLORS.info} bg={COLORS.infoBg} />}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Staff list for marking */}
        <Text style={styles.sectionTitle}>Mark Attendance</Text>
        {staffList.length === 0 ? (
          <Text style={styles.noStaff}>No staff members found</Text>
        ) : (
          staffList.map((s: any) => {
            const sid = s.id || s._id;
            const todayRec = getRecord(sid, today());
            const ts = todayRec ? statusStyle(todayRec.status) : null;
            return (
              <TouchableOpacity key={sid} style={styles.staffRow} onPress={() => openMarkModal(s)}>
                <View style={styles.staffAvatar}>
                  <Text style={styles.staffAvatarText}>{s.name?.charAt(0) || 'S'}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.staffName}>{s.name}</Text>
                  <Text style={styles.staffStall}>{s.stallName || 'No stall'}</Text>
                </View>
                {ts ? (
                  <View style={[styles.statusBadge, { backgroundColor: ts.bg }]}>
                    <Text style={[styles.statusText, { color: ts.color }]}>{ts.label}</Text>
                  </View>
                ) : (
                  <Text style={styles.markBtn}>Mark ›</Text>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Mark attendance modal */}
      <Modal visible={markModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mark Attendance</Text>
            {selectedStaff && <Text style={styles.modalSubTitle}>{selectedStaff.name} · {selectedDate}</Text>}

            {markError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>⚠️ {markError}</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Status</Text>
            <View style={styles.statusOptions}>
              {STATUSES.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.statusOption, selectedStatus === s.key && { backgroundColor: s.bg, borderColor: s.color }]}
                  onPress={() => { haptics.selection(); setSelectedStatus(s.key); }}
                >
                  <Text style={[styles.statusOptionText, selectedStatus === s.key && { color: s.color, fontWeight: '700' }]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setMarkModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleMark} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    padding: SPACING.xl, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.black },
  headerSub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 2 },

  summaryCard: {
    margin: SPACING.xl, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  cardTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.black, marginBottom: SPACING.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 0.5, borderBottomColor: COLORS.borderLight },
  summaryName: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.dark, fontWeight: '600' },
  summaryChips: { flexDirection: 'row', gap: 6 },
  chip: { borderRadius: BORDER_RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 11, fontWeight: '700' },

  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.black, paddingHorizontal: SPACING.xl, marginVertical: SPACING.md },
  noStaff: { fontSize: FONT_SIZE.md, color: COLORS.muted, paddingHorizontal: SPACING.xl },

  staffRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    marginHorizontal: SPACING.xl, marginBottom: SPACING.sm, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  staffAvatar: {
    width: 40, height: 40, borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center',
  },
  staffAvatarText: { color: COLORS.primary, fontWeight: '800', fontSize: FONT_SIZE.md },
  staffName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black },
  staffStall: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 2 },
  markBtn: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '700' },

  statusBadge: { borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 4 },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },

  recordRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    marginHorizontal: SPACING.xl, marginBottom: SPACING.sm, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md,
  },
  recordDate: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.dark },
  recordNote: { fontSize: FONT_SIZE.xs, color: COLORS.muted },

  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxxl },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.muted, marginTop: SPACING.md },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, paddingBottom: 40,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.black, marginBottom: 4 },
  modalSubTitle: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginBottom: SPACING.xl },
  errorBanner: {
    backgroundColor: COLORS.dangerBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.danger,
  },
  errorBannerText: { fontSize: FONT_SIZE.sm, color: COLORS.danger, fontWeight: '600', lineHeight: 20 },
  fieldLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.dark, marginBottom: SPACING.sm },
  statusOptions: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.xl, flexWrap: 'wrap' },
  statusOption: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  statusOptionText: { fontSize: FONT_SIZE.md, color: COLORS.dark },
  modalActions: { flexDirection: 'row', gap: SPACING.md },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md, alignItems: 'center',
  },
  cancelText: { fontSize: FONT_SIZE.md, color: COLORS.medium, fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
});
