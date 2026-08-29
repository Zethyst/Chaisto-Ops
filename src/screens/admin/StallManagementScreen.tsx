import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Switch, RefreshControl,
} from 'react-native';
import { showAlert } from '../../components/AppAlert';
import { authService } from '../../services/authService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';

interface Stall {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  allowedRadiusMeters?: number;
  isActive?: boolean;
}

const EMPTY_FORM = { name: '', address: '', latitude: '', longitude: '', radius: '200' };

export default function StallManagementScreen() {
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingStall, setEditingStall] = useState<Stall | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      const data = await authService.getStalls();
      setStalls(data as Stall[]);
    } catch {
      showAlert('Error', 'Could not load stalls. Is the server running?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    haptics.medium();
    setEditingStall(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (stall: Stall) => {
    haptics.light();
    setEditingStall(stall);
    setForm({
      name: stall.name,
      address: stall.address ?? '',
      latitude: stall.latitude != null ? String(stall.latitude) : '',
      longitude: stall.longitude != null ? String(stall.longitude) : '',
      radius: String(stall.allowedRadiusMeters ?? 200),
    });
    setFormError(null);
    setShowModal(true);
  };

  const validate = () => {
    if (!form.name.trim()) { setFormError('Stall name is required.'); return false; }
    if (!form.latitude || !form.longitude) { setFormError('Latitude and longitude are required.'); return false; }
    if (isNaN(Number(form.latitude)) || isNaN(Number(form.longitude))) { setFormError('Enter valid decimal coordinates.'); return false; }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setFormError(null);
    haptics.medium();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        allowedRadiusMeters: Number(form.radius) || 200,
      };
      if (editingStall) {
        await authService.updateStall(editingStall.id, payload);
        setStalls((prev) => prev.map((s) => s.id === editingStall.id ? { ...s, ...payload } : s));
        haptics.success();
        setShowModal(false);
        showAlert('Saved', `${payload.name} updated.`);
      } else {
        const created = await authService.createStall(payload);
        setStalls((prev) => [...prev, { ...payload, id: created.id, isActive: true }]);
        haptics.success();
        setShowModal(false);
        showAlert('Created', `${payload.name} is now live.`);
      }
    } catch (err: any) {
      haptics.error();
      setFormError(err.response?.data?.error || 'Could not save stall. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = (stall: Stall) => {
    const next = !stall.isActive;
    showAlert(
      `${next ? 'Enable' : 'Disable'} Stall`,
      `${next ? 'Activate' : 'Deactivate'} ${stall.name}? Staff at this stall will ${next ? 'regain' : 'lose'} access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: next ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await authService.updateStall(stall.id, { isActive: next });
              setStalls((prev) => prev.map((s) => s.id === stall.id ? { ...s, isActive: next } : s));
              haptics.success();
            } catch {
              showAlert('Error', 'Could not update stall status.');
            }
          },
        },
      ]
    );
  };

  const setField = (key: keyof typeof EMPTY_FORM, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Stats bar */}
      <View style={styles.statsBar}>
        <StatPill label="Total" value={stalls.length} color={COLORS.primary} />
        <StatPill label="Active" value={stalls.filter((s) => s.isActive !== false).length} color={COLORS.success} />
        <StatPill label="Inactive" value={stalls.filter((s) => s.isActive === false).length} color={COLORS.muted} />
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addBtnText}>+ Add Stall</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primaryLight} />}
      >
        {stalls.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏪</Text>
            <Text style={styles.emptyTitle}>No stalls yet</Text>
            <Text style={styles.emptySub}>Tap "+ Add Stall" to create your first location.</Text>
          </View>
        ) : (
          stalls.map((stall) => (
            <View key={stall.id} style={[styles.card, stall.isActive === false && styles.cardInactive]}>
              <View style={styles.cardHeader}>
                <View style={styles.stallIcon}>
                  <Text style={styles.stallIconText}>🏪</Text>
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.stallName}>{stall.name}</Text>
                  {stall.address ? (
                    <Text style={styles.stallAddress}>📍 {stall.address}</Text>
                  ) : stall.latitude ? (
                    <Text style={styles.stallAddress}>
                      📍 {stall.latitude?.toFixed(4)}, {stall.longitude?.toFixed(4)}
                    </Text>
                  ) : (
                    <Text style={[styles.stallAddress, { color: COLORS.warning }]}>⚠️ No location set</Text>
                  )}
                </View>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(stall)}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.radiusBadge}>
                  <Text style={styles.radiusText}>📡 {stall.allowedRadiusMeters ?? 200}m radius</Text>
                </View>
                <View style={styles.activeRow}>
                  <Text style={styles.activeLabel}>{stall.isActive !== false ? 'Active' : 'Inactive'}</Text>
                  <Switch
                    value={stall.isActive !== false}
                    onValueChange={() => { haptics.medium(); toggleActive(stall); }}
                    trackColor={{ false: COLORS.dangerBg, true: COLORS.successBg }}
                    thumbColor={stall.isActive !== false ? COLORS.success : COLORS.danger}
                  />
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Create / Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingStall ? 'Edit Stall' : 'New Stall'}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.modalClose}>✕ Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            {formError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>⚠️ {formError}</Text>
              </View>
            )}
            <Field label="Stall Name *" value={form.name} onChangeText={(v) => setField('name', v)} placeholder="e.g. Chaisto - Civil Lines" />
            <Field label="Address" value={form.address} onChangeText={(v) => setField('address', v)} placeholder="e.g. 12A, Civil Lines, Prayagraj" />

            <View style={styles.coordRow}>
              <View style={{ flex: 1 }}>
                <Field label="Latitude *" value={form.latitude} onChangeText={(v) => setField('latitude', v)} placeholder="25.4358" keyboardType="decimal-pad" />
              </View>
              <View style={{ width: SPACING.md }} />
              <View style={{ flex: 1 }}>
                <Field label="Longitude *" value={form.longitude} onChangeText={(v) => setField('longitude', v)} placeholder="81.8463" keyboardType="decimal-pad" />
              </View>
            </View>

            <Field
              label="GPS Check-in Radius (metres)"
              value={form.radius}
              onChangeText={(v) => setField('radius', v)}
              placeholder="200"
              keyboardType="number-pad"
              hint="Staff must be within this distance to submit a report. Default: 200m"
            />

            <View style={styles.coordHint}>
              <Text style={styles.coordHintText}>
                💡 Open Google Maps, long-press your stall location, and copy the coordinates shown at the top.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>{editingStall ? 'Save Changes' : 'Create Stall'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, hint }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize="none"
      />
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  statsBar: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.lg,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  statPill: {
    alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  statValue: { fontSize: FONT_SIZE.lg, fontWeight: '800' },
  statLabel: { fontSize: 10, color: COLORS.muted, marginTop: 1 },
  addBtn: {
    marginLeft: 'auto' as any, backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.sm },

  list: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 40 },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 52, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.dark },
  emptySub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: SPACING.sm, textAlign: 'center' },

  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm, overflow: 'hidden',
  },
  cardInactive: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg },
  stallIcon: {
    width: 48, height: 48, borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center',
  },
  stallIconText: { fontSize: 24 },
  stallName: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.black },
  stallAddress: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 2 },
  editBtn: {
    backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border,
  },
  editBtnText: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '700' },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight, backgroundColor: COLORS.surface,
  },
  radiusBadge: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.border },
  radiusText: { fontSize: FONT_SIZE.sm, color: COLORS.medium, fontWeight: '600' },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  activeLabel: { fontSize: FONT_SIZE.sm, color: COLORS.medium },

  modal: { flex: 1, backgroundColor: COLORS.white },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.xl, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.black },
  modalClose: { color: COLORS.primary, fontWeight: '600' },
  modalBody: { flex: 1, padding: SPACING.xl },
  errorBanner: {
    backgroundColor: COLORS.dangerBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.danger,
  },
  errorBannerText: { fontSize: FONT_SIZE.sm, color: COLORS.danger, fontWeight: '600', lineHeight: 20 },

  fieldWrap: { marginBottom: SPACING.lg },
  fieldLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.dark, marginBottom: 8 },
  fieldInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md, height: 48, fontSize: FONT_SIZE.md,
    color: COLORS.black, backgroundColor: COLORS.surface,
  },
  fieldHint: { fontSize: FONT_SIZE.xs, color: COLORS.muted, marginTop: 4 },
  coordRow: { flexDirection: 'row' },
  coordHint: {
    backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.border,
  },
  coordHintText: { fontSize: FONT_SIZE.sm, color: COLORS.primaryLight, lineHeight: 20 },

  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md,
    height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 40,
  },
  saveBtnText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '700' },
});
