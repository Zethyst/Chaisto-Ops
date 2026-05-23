import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput,  ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { showAlert } from '../../components/AppAlert';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { expenseService } from '../../services/expenseService';
import { Expense } from '../../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';

const CATEGORIES: { key: Expense['category']; label: string; icon: string }[] = [
  { key: 'gas', label: 'Gas / Fuel', icon: '🔥' },
  { key: 'supplies', label: 'Supplies', icon: '🧻' },
  { key: 'maintenance', label: 'Maintenance', icon: '🔧' },
  { key: 'equipment', label: 'Equipment', icon: '⚙️' },
  { key: 'other', label: 'Other', icon: '📦' },
];

const today = () => new Date().toISOString().split('T')[0];
const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function ExpenseTrackerScreen({ navigation }: any) {
  const { user } = useSelector((s: RootState) => s.auth);
  const isAdmin = user?.role === 'admin' || user?.role === 'moderator';

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState<Expense['category']>('gas');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const load = async () => {
    try {
      const data = await expenseService.getExpenses({
        stallId: isAdmin ? undefined : user?.stallId,
        month: currentMonth(),
      });
      setExpenses(data);
    } catch {
      showAlert('Error', 'Could not load expenses');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt < 1) {
      showAlert('Invalid Amount', 'Enter a valid amount (min ₹1).');
      return;
    }
    haptics.medium();
    setSaving(true);
    try {
      await expenseService.logExpense({
        stallId: user!.stallId!,
        category,
        amount: amt,
        description: description.trim() || undefined,
        date: today(),
      });
      haptics.success();
      setShowForm(false);
      setAmount('');
      setDescription('');
      setCategory('gas');
      load();
    } catch (err: any) {
      haptics.error();
      showAlert('Error', err.response?.data?.error || 'Could not save expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    showAlert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          haptics.heavy();
          try {
            await expenseService.deleteExpense(id);
            setExpenses((prev) => prev.filter((e) => e.id !== id && (e as any)._id !== id));
          } catch {
            showAlert('Error', 'Could not delete expense');
          }
        },
      },
    ]);
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory: Record<string, number> = {};
  expenses.forEach((e) => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primaryLight} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Expense Tracker</Text>
            <Text style={styles.headerSub}>{new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => { haptics.light(); setShowForm(true); }}>
            <Text style={styles.addBtnText}>+ Log</Text>
          </TouchableOpacity>
        </View>

        {/* Total card */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total This Month</Text>
          <Text style={styles.totalAmount}>₹{total.toLocaleString('en-IN')}</Text>
          <View style={styles.catRow}>
            {CATEGORIES.map((c) => byCategory[c.key] ? (
              <View key={c.key} style={styles.catChip}>
                <Text style={styles.catChipIcon}>{c.icon}</Text>
                <Text style={styles.catChipText}>{c.label.split(' ')[0]}: ₹{byCategory[c.key]}</Text>
              </View>
            ) : null)}
          </View>
        </View>

        {/* List */}
        <Text style={styles.sectionTitle}>This Month's Entries</Text>
        {expenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40 }}>💸</Text>
            <Text style={styles.emptyText}>No expenses logged this month</Text>
          </View>
        ) : (
          expenses.map((e) => {
            const cat = CATEGORIES.find((c) => c.key === e.category);
            const eid = (e as any)._id || e.id;
            return (
              <View key={eid} style={styles.expenseRow}>
                <View style={styles.expenseCatIcon}>
                  <Text style={{ fontSize: 22 }}>{cat?.icon || '📦'}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.expenseCat}>{cat?.label || e.category}</Text>
                  {e.description ? <Text style={styles.expenseDesc}>{e.description}</Text> : null}
                  <Text style={styles.expenseDate}>{e.date} · by {e.loggedByName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.expenseAmount}>₹{e.amount}</Text>
                  {isAdmin && (
                    <TouchableOpacity onPress={() => handleDelete(eid)}>
                      <Text style={styles.deleteBtn}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Log expense modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Log Expense</Text>

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.catOption, category === c.key && styles.catOptionActive]}
                  onPress={() => { haptics.selection(); setCategory(c.key); }}
                >
                  <Text style={{ fontSize: 20 }}>{c.icon}</Text>
                  <Text style={[styles.catOptionLabel, category === c.key && styles.catOptionLabelActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Amount (₹)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="e.g. 150"
              placeholderTextColor={COLORS.muted}
            />

            <Text style={styles.fieldLabel}>Description (optional)</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Gas cylinder refill"
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
      </Modal>
    </View>
  );
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

  totalCard: {
    margin: SPACING.xl, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl, ...SHADOWS.md, borderWidth: 1, borderColor: COLORS.border,
  },
  totalLabel: { fontSize: FONT_SIZE.sm, color: COLORS.muted, fontWeight: '600', marginBottom: 4 },
  totalAmount: { fontSize: FONT_SIZE.xxxl, fontWeight: '800', color: COLORS.danger },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  catChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  catChipIcon: { fontSize: 14, marginRight: 4 },
  catChipText: { fontSize: FONT_SIZE.xs, color: COLORS.medium, fontWeight: '600' },

  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.black, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },

  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxxl },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.muted, marginTop: SPACING.md },

  expenseRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    marginHorizontal: SPACING.xl, marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.md, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  expenseCatIcon: {
    width: 44, height: 44, borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.dangerBg, alignItems: 'center', justifyContent: 'center',
  },
  expenseCat: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black },
  expenseDesc: { fontSize: FONT_SIZE.sm, color: COLORS.medium, marginTop: 2 },
  expenseDate: { fontSize: FONT_SIZE.xs, color: COLORS.muted, marginTop: 2 },
  expenseAmount: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.danger },
  deleteBtn: { fontSize: FONT_SIZE.xs, color: COLORS.danger, fontWeight: '600', marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, paddingBottom: 40,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.black, marginBottom: SPACING.xl },
  fieldLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.dark, marginBottom: SPACING.sm },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  catOption: {
    flexDirection: 'row', alignItems: 'center', borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm, backgroundColor: COLORS.surface,
  },
  catOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  catOptionLabel: { fontSize: FONT_SIZE.sm, color: COLORS.dark, marginLeft: 6 },
  catOptionLabelActive: { color: COLORS.primary, fontWeight: '700' },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.black, backgroundColor: COLORS.surface,
    marginBottom: SPACING.lg,
  },
  modalActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md, alignItems: 'center',
  },
  cancelText: { fontSize: FONT_SIZE.md, color: COLORS.medium, fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
});
