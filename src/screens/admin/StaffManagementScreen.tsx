import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput,  Modal, ActivityIndicator, Switch, RefreshControl, Image,
} from 'react-native';
import { showAlert } from '../../components/AppAlert';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { authService } from '../../services/authService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';
import { User } from '../../types';

type Stall = { id: string; name: string; address?: string };

export default function StaffManagementScreen() {
  const { user } = useSelector((s: RootState) => s.auth);
  const isAdmin = user?.role === 'admin';

  const [staffList, setStaffList] = useState<User[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');

  // Move-stall state
  const [moveStallTarget, setMoveStallTarget] = useState<User | null>(null);
  const [movingStall, setMovingStall] = useState(false);

  // New user form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<'staff' | 'moderator'>('staff');
  const [newPassword, setNewPassword] = useState('');
  const [newStallId, setNewStallId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [users, stallList] = await Promise.all([
        authService.getUsers(),
        authService.getStalls(),
      ]);
      setStaffList(users);
      setStalls(stallList);
    } catch {
      showAlert('Error', 'Could not load staff data. Is the server running?');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const resetForm = () => {
    setNewName('');
    setNewPhone('');
    setNewPassword('');
    setNewRole('staff');
    setNewStallId(null);
    setShowPassword(false);
  };

  const createUser = async () => {
    if (!newName.trim()) return showAlert('Missing Field', 'Please enter a name.');
    if (!/^\d{10}$/.test(newPhone)) return showAlert('Invalid Phone', 'Enter a valid 10-digit number.');
    if (newPassword.length < 8) return showAlert('Weak Password', 'Password must be at least 8 characters.');

    setCreating(true);
    try {
      const created = await authService.createStaffAccount({
        name: newName.trim(),
        phone: newPhone,
        role: newRole,
        stallId: newStallId || '',
        password: newPassword,
      });
      setStaffList((prev) => [created, ...prev]);
      setShowAddModal(false);
      resetForm();
      showAlert(
        'Account Created',
        `${created.name}'s account is ready.\n\nPhone: ${created.phone}\nRole: ${created.role.toUpperCase()}\n\nShare credentials securely.`
      );
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to create account';
      showAlert('Error', msg);
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = (staff: User) => {
    if (!isAdmin) return;
    showAlert(
      `${staff.isActive ? 'Disable' : 'Enable'} Account`,
      `${staff.isActive ? 'Block' : 'Restore'} login access for ${staff.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: staff.isActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await authService.toggleUserStatus(staff.id, !staff.isActive);
              setStaffList((prev) =>
                prev.map((s) => s.id === staff.id ? { ...s, isActive: !s.isActive } : s)
              );
            } catch {
              showAlert('Error', 'Could not update account status');
            }
          },
        },
      ]
    );
  };

  const resetDevice = (staff: User) => {
    showAlert(
      'Reset Device Binding',
      `${staff.name} will be able to log in from any device. Do this only if they changed phones.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            try {
              await authService.resetDevice(staff.id);
              setStaffList((prev) =>
                prev.map((s) => s.id === staff.id ? { ...s, deviceId: undefined } : s)
              );
              showAlert('Done', 'Device binding cleared.');
            } catch {
              showAlert('Error', 'Could not reset device binding');
            }
          },
        },
      ]
    );
  };

  const openMoveStall = (staff: User) => {
    haptics.light();
    setMoveStallTarget(staff);
  };

  const handleMoveStall = async (stallId: string | null) => {
    if (!moveStallTarget) return;
    const stallName = stalls.find((s) => s.id === stallId)?.name ?? null;
    setMovingStall(true);
    try {
      await authService.updateStaffStall(moveStallTarget.id, stallId, stallName);
      setStaffList((prev) =>
        prev.map((s) => s.id === moveStallTarget.id
          ? { ...s, stallId: stallId || undefined, stallName: stallName || undefined }
          : s)
      );
      haptics.success();
      showAlert('Done', stallId
        ? `${moveStallTarget.name} moved to ${stallName}.`
        : `${moveStallTarget.name} unassigned from stall.`
      );
      setMoveStallTarget(null);
    } catch {
      haptics.error();
      showAlert('Error', 'Could not update stall assignment.');
    } finally {
      setMovingStall(false);
    }
  };

  const filtered = staffList.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search)
  );

  const roleColor = (role: string) =>
    ({ admin: COLORS.admin, moderator: COLORS.moderator, staff: COLORS.staff }[role] ?? COLORS.staff);
  const roleBg = (role: string) =>
    ({ admin: COLORS.adminBg, moderator: COLORS.moderatorBg, staff: COLORS.staffBg }[role] ?? COLORS.staffBg);
  const roleTitle = (role: string) => role.toUpperCase();

  return (
    <View style={styles.container}>
      {/* Search + Add */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone..."
          placeholderTextColor={COLORS.muted}
          value={search}
          onChangeText={setSearch}
        />
        {isAdmin && (
          <TouchableOpacity style={styles.addBtn} onPress={() => { haptics.medium(); setShowAddModal(true); }}>
            <Text style={styles.addBtnText}>+ Add Staff</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatPill label="Total" value={staffList.length} color={COLORS.info} />
        <StatPill label="Active" value={staffList.filter((s) => s.isActive).length} color={COLORS.success} />
        <StatPill label="Disabled" value={staffList.filter((s) => !s.isActive).length} color={COLORS.danger} />
        <StatPill label="Unbound" value={staffList.filter((s) => !s.deviceId).length} color={COLORS.warning} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ margin: 40 }} color={COLORS.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {filtered.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>No users found</Text>
              {isAdmin && <Text style={styles.emptyHint}>Tap "+ Add User" to create the first account</Text>}
            </View>
          )}
          {filtered.map((staff) => (
            <View key={staff.id} style={[styles.staffCard, !staff.isActive && styles.staffCardDisabled]}>
              <View style={styles.staffHeader}>
                <View style={[styles.avatar, { backgroundColor: roleBg(staff.role) }]}>
                  {staff.profilePhoto
                    ? <Image source={{ uri: staff.profilePhoto }} style={styles.avatarImage} />
                    : <Text style={[styles.avatarText, { color: roleColor(staff.role) }]}>{staff.name.charAt(0).toUpperCase()}</Text>}
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.staffName}>{staff.name}</Text>
                    <View style={[styles.roleBadge, { backgroundColor: roleBg(staff.role) }]}>
                      <Text style={[styles.roleText, { color: roleColor(staff.role) }]}>
                        {roleTitle(staff.role)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.staffPhone}>📞 {staff.phone}</Text>
                  {staff.stallName && (
                    <Text style={styles.staffStall}>📍 {staff.stallName}</Text>
                  )}
                  <Text style={styles.staffMeta}>
                    {staff.deviceId
                      ? `🔒 ${staff.deviceName || 'Device bound'}`
                      : '⚠️ No device'}
                    {staff.lastLogin
                      ? ` · Last login ${new Date(staff.lastLogin).toLocaleDateString('en-IN')}`
                      : ' · Never logged in'}
                  </Text>
                </View>
              </View>

              {isAdmin && (
                <View style={styles.staffActions}>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>{staff.isActive ? 'Active' : 'Disabled'}</Text>
                    <Switch
                      value={staff.isActive}
                      onValueChange={() => { haptics.medium(); toggleStatus(staff); }}
                      trackColor={{ false: COLORS.dangerBg, true: COLORS.successBg }}
                      thumbColor={staff.isActive ? COLORS.success : COLORS.danger}
                    />
                  </View>
                  <View style={styles.actionBtns}>
                    <TouchableOpacity style={styles.moveStallBtn} onPress={() => openMoveStall(staff)}>
                      <Text style={styles.moveStallText}>Change Stall</Text>
                    </TouchableOpacity>
                    {staff.deviceId && (
                      <TouchableOpacity style={styles.resetBtn} onPress={() => { haptics.heavy(); resetDevice(staff); }}>
                        <Text style={styles.resetBtnText}>Reset Device</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Move Stall Modal */}
      <Modal visible={!!moveStallTarget} animationType="slide" transparent>
        <View style={styles.moveModalOverlay}>
          <View style={styles.moveModalCard}>
            <Text style={styles.moveModalTitle}>Change Stall</Text>
            <Text style={styles.moveModalSub}>{moveStallTarget?.name}</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              <TouchableOpacity
                style={[styles.stallOption, !moveStallTarget?.stallId && styles.stallOptionActive]}
                onPress={() => !movingStall && handleMoveStall(null)}
              >
                <Text style={[styles.stallOptionText, !moveStallTarget?.stallId && styles.stallOptionTextActive]}>
                  Unassigned
                </Text>
              </TouchableOpacity>
              {stalls.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.stallOption, moveStallTarget?.stallId === s.id && styles.stallOptionActive]}
                  onPress={() => !movingStall && handleMoveStall(s.id)}
                >
                  {movingStall ? (
                    <ActivityIndicator color={COLORS.primary} size="small" />
                  ) : (
                    <>
                      <Text style={[styles.stallOptionText, moveStallTarget?.stallId === s.id && styles.stallOptionTextActive]}>
                        {s.name}
                      </Text>
                      {s.address && <Text style={styles.stallAddress}>{s.address}</Text>}
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.moveModalCancel} onPress={() => setMoveStallTarget(null)}>
              <Text style={styles.moveModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add User Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add New User</Text>
            <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }}>
              <Text style={styles.modalClose}>✕ Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <FormField label="Full Name *" value={newName} onChangeText={setNewName} placeholder="Ravi Kumar" />
            <FormField
              label="Phone Number *"
              value={newPhone}
              onChangeText={setNewPhone}
              placeholder="9876543210"
              keyboardType="phone-pad"
              maxLength={10}
            />

            <View style={{ marginBottom: SPACING.lg }}>
              <Text style={styles.formLabel}>Password *</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Min 8 characters"
                  placeholderTextColor={COLORS.muted}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
                  <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.formLabel}>Role *</Text>
            <View style={styles.roleToggle}>
              {(['staff', 'moderator'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleBtn, newRole === r && styles.roleBtnActive]}
                  onPress={() => { haptics.selection(); setNewRole(r); }}
                >
                  <Text style={[styles.roleBtnText, newRole === r && styles.roleBtnTextActive]}>
                    {r === 'staff' ? '👨‍🍳 Staff' : '👔 Moderator'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {stalls.length > 0 && (
              <>
                <Text style={styles.formLabel}>Assign to Stall (optional)</Text>
                <View style={styles.stallList}>
                  <TouchableOpacity
                    style={[styles.stallOption, newStallId === null && styles.stallOptionActive]}
                    onPress={() => { haptics.selection(); setNewStallId(null); }}
                  >
                    <Text style={[styles.stallOptionText, newStallId === null && styles.stallOptionTextActive]}>
                      None
                    </Text>
                  </TouchableOpacity>
                  {stalls.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.stallOption, newStallId === s.id && styles.stallOptionActive]}
                      onPress={() => { haptics.selection(); setNewStallId(s.id); }}
                    >
                      <Text style={[styles.stallOptionText, newStallId === s.id && styles.stallOptionTextActive]}>
                        {s.name}
                      </Text>
                      {s.address && (
                        <Text style={styles.stallAddress}>{s.address}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Credentials preview */}
            <View style={styles.credentialsNote}>
              <Text style={styles.credTitle}>Credentials to share</Text>
              <Text style={styles.credText}>Phone:    +91 {newPhone || 'XXXXXXXXXX'}</Text>
              <Text style={styles.credText}>Password: {newPassword || '••••••••'}</Text>
              {newStallId && (
                <Text style={styles.credText}>
                  Stall: {stalls.find((s) => s.id === newStallId)?.name ?? '—'}
                </Text>
              )}
              <Text style={styles.credWarn}>⚠️  Share only via direct message. Never post publicly.</Text>
            </View>

            <TouchableOpacity style={styles.createBtn} onPress={() => { haptics.medium(); createUser(); }} disabled={creating}>
              {creating
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.createBtnText}>Create Account</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType, maxLength, secureTextEntry }: any) {
  return (
    <View style={{ marginBottom: SPACING.lg }}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={styles.formInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        keyboardType={keyboardType}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statPill, { borderColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },

  searchBar: { flexDirection: 'row', padding: SPACING.lg, gap: SPACING.sm, borderBottomWidth: 0.5, borderBottomColor: COLORS.borderLight, marginTop: 16 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.md, fontSize: FONT_SIZE.md, color: COLORS.black, backgroundColor: COLORS.surface, height: 44 },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.lg, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.sm },

  statsRow: { flexDirection: 'row', padding: SPACING.lg, gap: SPACING.sm },
  statPill: { flex: 1, borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, alignItems: 'center', backgroundColor: COLORS.white },
  statValue: { fontSize: FONT_SIZE.lg, fontWeight: '800' },
  statLabel: { fontSize: 10, color: COLORS.muted, marginTop: 2 },

  list: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 40 },

  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyText: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.dark },
  emptyHint: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: SPACING.sm },

  staffCard: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, ...SHADOWS.sm },
  staffCardDisabled: { opacity: 0.55 },
  staffHeader: { flexDirection: 'row' },
  avatar: { width: 48, height: 48, borderRadius: BORDER_RADIUS.full, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 48, height: 48, borderRadius: BORDER_RADIUS.full },
  avatarText: { fontSize: FONT_SIZE.xl, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4, flexWrap: 'wrap' },
  staffName: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.black },
  roleBadge: { borderRadius: BORDER_RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  roleText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  staffPhone: { fontSize: FONT_SIZE.sm, color: COLORS.medium },
  staffStall: { fontSize: FONT_SIZE.sm, color: COLORS.medium, marginTop: 2 },
  staffMeta: { fontSize: 11, color: COLORS.muted, marginTop: 4 },

  staffActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 0.5, borderTopColor: COLORS.borderLight },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  statusLabel: { fontSize: FONT_SIZE.sm, color: COLORS.medium },
  actionBtns: { flexDirection: 'row', gap: SPACING.sm },
  resetBtn: { backgroundColor: COLORS.warningBg, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: 6 },
  resetBtnText: { fontSize: FONT_SIZE.sm, color: COLORS.warning, fontWeight: '600' },
  moveStallBtn: { backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border },
  moveStallText: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '600' },

  moveModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  moveModalCard: {
    backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, paddingBottom: 40,
  },
  moveModalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.black, marginBottom: 4 },
  moveModalSub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginBottom: SPACING.lg },
  stallOption: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm, backgroundColor: COLORS.surface,
  },
  stallOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  stallOptionText: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.muted },
  stallOptionTextActive: { color: COLORS.primary },
  stallAddress: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 2 },
  moveModalCancel: {
    marginTop: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center',
  },
  moveModalCancelText: { fontSize: FONT_SIZE.md, color: COLORS.medium, fontWeight: '600' },

  modal: { flex: 1, backgroundColor: COLORS.white },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.xl, borderBottomWidth: 0.5, borderBottomColor: COLORS.borderLight },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.black },
  modalClose: { color: COLORS.primary, fontWeight: '600' },
  modalBody: { flex: 1, padding: SPACING.xl },

  formLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.dark, marginBottom: 8 },
  formInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.md, height: 48, fontSize: FONT_SIZE.md, color: COLORS.black, backgroundColor: COLORS.surface },

  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  eyeBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.sm, backgroundColor: COLORS.surface },
  eyeText: { fontSize: 18 },

  roleToggle: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.xl },
  roleBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center', backgroundColor: COLORS.surface },
  roleBtnActive: { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primary },
  roleBtnText: { fontSize: FONT_SIZE.md, color: COLORS.muted, fontWeight: '600' },
  roleBtnTextActive: { color: COLORS.primary },

  stallList: { gap: SPACING.sm, marginBottom: SPACING.xl },
  stallOption: { borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, backgroundColor: COLORS.surface },
  stallOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  stallOptionText: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.muted },
  stallOptionTextActive: { color: COLORS.primary },
  stallAddress: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 2 },

  credentialsNote: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.lg, marginBottom: SPACING.xl, borderWidth: 1, borderColor: COLORS.border },
  credTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.dark, marginBottom: SPACING.sm },
  credText: { fontSize: FONT_SIZE.md, color: COLORS.black, fontFamily: 'monospace', marginBottom: 4 },
  credWarn: { fontSize: FONT_SIZE.sm, color: COLORS.danger, marginTop: SPACING.sm, fontWeight: '600' },

  createBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  createBtnText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '700' },
});
