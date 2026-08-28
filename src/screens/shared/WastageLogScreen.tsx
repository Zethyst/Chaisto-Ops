import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput,  ActivityIndicator, RefreshControl, Modal,
  Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform,
} from 'react-native';
import { showAlert } from '../../components/AppAlert';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { wastageService } from '../../services/wastageService';
import { WastageLog, WastageItem } from '../../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';

const ITEMS = [
  { key: 'milk', label: 'Milk', unit: 'litres', icon: '🥛' },
  { key: 'sugar', label: 'Sugar', unit: 'kg', icon: '🍬' },
  { key: 'teaLeaves', label: 'Tea Leaves', unit: 'grams', icon: '🌿' },
  { key: 'cups', label: 'Cups', unit: 'count', icon: '🥤' },
  { key: 'momo', label: 'Momo', unit: 'packets', icon: '🥟' },
  { key: 'other', label: 'Other', unit: 'units', icon: '📦' },
] as const;

const REASONS = ['expired', 'spilled', 'unsold', 'damaged', 'other'] as const;

const today = () => new Date().toISOString().split('T')[0];
const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function WastageLogScreen() {
  const { user } = useSelector((s: RootState) => s.auth);
  const isAdmin = user?.role === 'admin' || user?.role === 'moderator';

  const [logs, setLogs] = useState<WastageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedItem, setSelectedItem] = useState<typeof ITEMS[number]['key']>('milk');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<typeof REASONS[number]>('expired');
  const [notes, setNotes] = useState('');

  const load = async () => {
    try {
      const data = await wastageService.getWastageLogs({ stallId: isAdmin ? undefined : user?.stallId, month: currentMonth() });
      setLogs(data);
    } catch {
      showAlert('Error', 'Could not load wastage logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const qty = parseFloat(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) {
      showAlert('Invalid Quantity', 'Enter a valid quantity.');
      return;
    }
    haptics.medium();
    setSaving(true);
    const itemMeta = ITEMS.find((i) => i.key === selectedItem)!;
    try {
      await wastageService.logWastage({
        stallId: user!.stallId!,
        date: today(),
        items: [{ item: selectedItem, quantity: qty, unit: itemMeta.unit, reason }],
        notes: notes.trim() || undefined,
      });
      haptics.success();
      setShowForm(false);
      setQuantity('');
      setNotes('');
      load();
    } catch (err: any) {
      haptics.error();
      showAlert('Error', err.response?.data?.error || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const totalLoss = logs.reduce((s, l) => s + (l.totalEstimatedLoss || 0), 0);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primaryLight} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Wastage Log</Text>
            <Text style={styles.headerSub}>{new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => { haptics.light(); setShowForm(true); }}>
            <Text style={styles.addBtnText}>+ Log</Text>
          </TouchableOpacity>
        </View>

        {totalLoss > 0 && (
          <View style={styles.lossCard}>
            <Text style={styles.lossLabel}>Estimated Loss This Month</Text>
            <Text style={styles.lossAmount}>₹{totalLoss.toLocaleString('en-IN')}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>This Month's Entries ({logs.length})</Text>
        {logs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40 }}>♻️</Text>
            <Text style={styles.emptyText}>No wastage logged this month</Text>
          </View>
        ) : (
          logs.map((log) => {
            const lid = (log as any)._id || log.id;
            return (
              <View key={lid} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <Text style={styles.logDate}>{log.date}</Text>
                  <Text style={styles.logBy}>by {log.loggedByName}</Text>
                  {log.totalEstimatedLoss > 0 && (
                    <Text style={styles.logLoss}>~₹{log.totalEstimatedLoss} loss</Text>
                  )}
                </View>
                {log.items.map((item, i) => {
                  const meta = ITEMS.find((it) => it.key === item.item);
                  return (
                    <View key={i} style={styles.itemRow}>
                      <Text style={styles.itemIcon}>{meta?.icon || '📦'}</Text>
                      <Text style={styles.itemText}>
                        {meta?.label || item.item}: <Text style={styles.itemQty}>{item.quantity} {item.unit}</Text>
                      </Text>
                      <View style={[styles.reasonBadge, { backgroundColor: reasonColor(item.reason).bg }]}>
                        <Text style={[styles.reasonText, { color: reasonColor(item.reason).text }]}>{item.reason}</Text>
                      </View>
                    </View>
                  );
                })}
                {log.notes ? <Text style={styles.logNotes}>Note: {log.notes}</Text> : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Log Wastage</Text>

            <Text style={styles.fieldLabel}>Item</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.lg }}>
              {ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.itemOption, selectedItem === item.key && styles.itemOptionActive]}
                  onPress={() => { haptics.selection(); setSelectedItem(item.key); }}
                >
                  <Text style={{ fontSize: 22 }}>{item.icon}</Text>
                  <Text style={[styles.itemOptionLabel, selectedItem === item.key && styles.itemOptionLabelActive]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>
              Quantity ({ITEMS.find((i) => i.key === selectedItem)?.unit})
            </Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={COLORS.muted}
            />

            <Text style={styles.fieldLabel}>Reason</Text>
            <View style={styles.reasonRow}>
              {REASONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonOption, reason === r && styles.reasonOptionActive]}
                  onPress={() => { haptics.selection(); setReason(r); }}
                >
                  <Text style={[styles.reasonOptionText, reason === r && styles.reasonOptionTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional notes"
              placeholderTextColor={COLORS.muted}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
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

function reasonColor(reason: string): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
    expired: { bg: COLORS.dangerBg, text: COLORS.danger },
    spilled: { bg: COLORS.infoBg, text: COLORS.info },
    unsold: { bg: COLORS.warningBg, text: COLORS.warning },
    damaged: { bg: '#FFF0E6', text: '#D97706' },
    other: { bg: COLORS.surface, text: COLORS.muted },
  };
  return map[reason] || { bg: COLORS.surface, text: COLORS.muted };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.xl, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.black },
  headerSub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 2 },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },

  lossCard: {
    margin: SPACING.xl, backgroundColor: COLORS.dangerBg, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.danger,
  },
  lossLabel: { fontSize: FONT_SIZE.sm, color: COLORS.danger, fontWeight: '600' },
  lossAmount: { fontSize: FONT_SIZE.xxxl, fontWeight: '800', color: COLORS.danger, marginTop: 4 },

  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.black, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxxl },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.muted, marginTop: SPACING.md },

  logCard: {
    backgroundColor: COLORS.white, marginHorizontal: SPACING.xl, marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.md, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  logHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.sm },
  logDate: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.black },
  logBy: { fontSize: FONT_SIZE.xs, color: COLORS.muted, flex: 1 },
  logLoss: { fontSize: FONT_SIZE.xs, color: COLORS.danger, fontWeight: '700' },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  itemIcon: { fontSize: 18, marginRight: SPACING.sm },
  itemText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.dark },
  itemQty: { fontWeight: '700' },
  reasonBadge: { borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  reasonText: { fontSize: 11, fontWeight: '700' },
  logNotes: { fontSize: FONT_SIZE.xs, color: COLORS.muted, marginTop: SPACING.sm, fontStyle: 'italic' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, paddingBottom: 40,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.black, marginBottom: SPACING.xl },
  fieldLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.dark, marginBottom: SPACING.sm },
  itemOption: {
    alignItems: 'center', marginRight: SPACING.sm, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
    backgroundColor: COLORS.surface, minWidth: 70,
  },
  itemOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  itemOptionLabel: { fontSize: 11, color: COLORS.dark, marginTop: 4 },
  itemOptionLabelActive: { color: COLORS.primary, fontWeight: '700' },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.black, backgroundColor: COLORS.surface,
    marginBottom: SPACING.lg,
  },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  reasonOption: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: 6,
  },
  reasonOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  reasonOptionText: { fontSize: FONT_SIZE.sm, color: COLORS.dark },
  reasonOptionTextActive: { color: COLORS.primary, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md, alignItems: 'center',
  },
  cancelText: { fontSize: FONT_SIZE.md, color: COLORS.medium, fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
});
