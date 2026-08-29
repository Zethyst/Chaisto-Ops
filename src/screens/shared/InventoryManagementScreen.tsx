import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
   Modal, ActivityIndicator, RefreshControl,
} from 'react-native';
import { showAlert } from '../../components/AppAlert';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { inventoryService } from '../../services/inventoryService';
import { authService } from '../../services/authService';
import { InventoryItem } from '../../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';

type Stall = { id: string; name: string };

export default function InventoryManagementScreen() {
  const { user } = useSelector((s: RootState) => s.auth);
  const isAdminOrMod = user?.role === 'admin' || user?.role === 'moderator';

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [selectedStallId, setSelectedStallId] = useState<string>(user?.stallId || '');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Supply modal
  const [supplyItem, setSupplyItem] = useState<InventoryItem | null>(null);
  const [supplyQty, setSupplyQty] = useState('');
  const [supplyNote, setSupplyNote] = useState('');
  const [supplyLoading, setSupplyLoading] = useState(false);
  const [supplyError, setSupplyError] = useState<string | null>(null);

  // Add item modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newThreshold, setNewThreshold] = useState('');
  const [newStock, setNewStock] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const loadItems = useCallback(async (stallId: string) => {
    if (!stallId) return;
    try {
      const data = await inventoryService.getItems(stallId);
      setItems(data);
    } catch {
      showAlert('Error', 'Could not load inventory. Is the server running?');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdminOrMod) {
      authService.getStalls().then((s) => {
        setStalls(s);
        if (!selectedStallId && s.length > 0) {
          setSelectedStallId(s[0].id);
          loadItems(s[0].id);
        } else if (selectedStallId) {
          loadItems(selectedStallId);
        }
      }).catch(() => {
        if (selectedStallId) loadItems(selectedStallId);
      });
    } else if (user?.stallId) {
      loadItems(user.stallId);
    }
  }, []);

  const onRefresh = () => { setRefreshing(true); loadItems(selectedStallId); };

  const handleSupply = async () => {
    if (!supplyItem || !supplyQty || isNaN(parseFloat(supplyQty))) {
      haptics.error();
      setSupplyError('Enter a valid quantity.');
      return;
    }
    setSupplyError(null);
    haptics.medium();
    setSupplyLoading(true);
    try {
      const updated = await inventoryService.addSupply(supplyItem.id, parseFloat(supplyQty), supplyNote || undefined);
      setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i));
      const restockedName = supplyItem.name;
      const restockedUnit = supplyItem.unit;
      const restockedQty = supplyQty;
      setSupplyItem(null);
      setSupplyQty('');
      setSupplyNote('');
      haptics.success();
      showAlert('Done', `${restockedName} restocked by ${restockedQty} ${restockedUnit}.`);
    } catch (err: any) {
      haptics.error();
      setSupplyError(err.response?.data?.error || 'Could not record supply. Please try again.');
    } finally {
      setSupplyLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newName.trim() || !newUnit.trim() || !newThreshold) {
      haptics.error();
      setAddError('Name, unit, and minimum threshold are required.');
      return;
    }
    setAddError(null);
    haptics.medium();
    setAddLoading(true);
    try {
      const item = await inventoryService.createItem({
        stallId: selectedStallId,
        name: newName.trim(),
        unit: newUnit.trim(),
        minThreshold: parseFloat(newThreshold),
        currentStock: newStock ? parseFloat(newStock) : 0,
      });
      setItems((prev) => [...prev, item]);
      setShowAddModal(false);
      setNewName(''); setNewUnit(''); setNewThreshold(''); setNewStock('');
      haptics.success();
    } catch (err: any) {
      haptics.error();
      setAddError(err.response?.data?.error || 'Could not add item. Please try again.');
    } finally {
      setAddLoading(false);
    }
  };

  const stockLevel = (item: InventoryItem) => {
    if (item.currentStock <= item.minThreshold) return 'low';
    if (item.currentStock <= item.minThreshold * 2) return 'medium';
    return 'ok';
  };
  const levelColor = { ok: COLORS.success, medium: COLORS.warning, low: COLORS.danger };
  const levelBg = { ok: COLORS.successBg, medium: COLORS.warningBg, low: COLORS.dangerBg };

  if (!selectedStallId && !user?.stallId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>📦</Text>
        <Text style={styles.emptyTitle}>No stall assigned</Text>
        <Text style={styles.emptySub}>Contact your admin to assign you to a stall.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stall picker for admin/mod */}
      {isAdminOrMod && stalls.length > 1 && (
        <View style={styles.stallPicker}>
          {stalls.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.stallTab, selectedStallId === s.id && styles.stallTabActive]}
              onPress={() => {
                haptics.selection();
                setSelectedStallId(s.id);
                setIsLoading(true);
                loadItems(s.id);
              }}
            >
              <Text style={[styles.stallTabText, selectedStallId === s.id && styles.stallTabTextActive]}>
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <StatChip label="Total" value={items.length} color={COLORS.info} />
        <StatChip label="Low Stock" value={items.filter((i) => stockLevel(i) === 'low').length} color={COLORS.danger} />
        <StatChip label="OK" value={items.filter((i) => stockLevel(i) === 'ok').length} color={COLORS.success} />
        {isAdminOrMod && (
          <TouchableOpacity style={styles.addItemBtn} onPress={() => { haptics.medium(); setAddError(null); setShowAddModal(true); }}>
            <Text style={styles.addItemText}>+ Add Item</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ margin: 40 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>No inventory items</Text>
              {isAdminOrMod && <Text style={styles.emptySub}>Tap "+ Add Item" to create inventory</Text>}
            </View>
          }
          renderItem={({ item }) => {
            const level = stockLevel(item);
            const pct = Math.min(100, (item.currentStock / Math.max(item.minThreshold * 3, 1)) * 100);
            return (
              <View style={styles.itemCard}>
                <View style={styles.itemTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemUnit}>{item.unit}</Text>
                  </View>
                  <View style={[styles.levelBadge, { backgroundColor: levelBg[level] }]}>
                    <Text style={[styles.levelText, { color: levelColor[level] }]}>
                      {level.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.stockRow}>
                  <Text style={styles.stockNum}>{item.currentStock}</Text>
                  <Text style={styles.stockSep}>/</Text>
                  <Text style={styles.stockMin}>{item.minThreshold} min</Text>
                </View>

                {/* Progress bar */}
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: levelColor[level] }]} />
                </View>

                {isAdminOrMod && (
                  <TouchableOpacity style={styles.supplyBtn} onPress={() => { haptics.light(); setSupplyError(null); setSupplyItem(item); }}>
                    <Text style={styles.supplyBtnText}>+ Record Supply</Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.updatedAt}>
                  Updated {new Date(item.lastUpdated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            );
          }}
        />
      )}

      {/* Supply Modal */}
      <Modal visible={!!supplyItem} animationType="slide" presentationStyle="pageSheet" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Record Supply</Text>
            <Text style={styles.modalSub}>{supplyItem?.name} · {supplyItem?.unit}</Text>
            {supplyError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>⚠️ {supplyError}</Text>
              </View>
            )}
            <Text style={styles.fieldLabel}>Quantity received</Text>
            <TextInput
              style={styles.fieldInput}
              keyboardType="decimal-pad"
              value={supplyQty}
              onChangeText={setSupplyQty}
              placeholder="0"
              placeholderTextColor={COLORS.muted}
            />
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.fieldInput, { height: 72, textAlignVertical: 'top', paddingTop: SPACING.sm }]}
              value={supplyNote}
              onChangeText={setSupplyNote}
              placeholder="Supplier name, invoice #..."
              placeholderTextColor={COLORS.muted}
              multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setSupplyItem(null); setSupplyQty(''); setSupplyNote(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleSupply} disabled={supplyLoading}>
                {supplyLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Item Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.addModal}>
          <View style={styles.addModalHeader}>
            <Text style={styles.modalTitle}>Add Inventory Item</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: SPACING.xl }}>
            {addError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>⚠️ {addError}</Text>
              </View>
            )}
            <AddField label="Item Name *" value={newName} onChange={setNewName} placeholder="e.g. Milk" />
            <AddField label="Unit *" value={newUnit} onChange={setNewUnit} placeholder="litres / kg / count" />
            <AddField label="Min. Threshold *" value={newThreshold} onChange={setNewThreshold} placeholder="0" numeric />
            <AddField label="Opening Stock" value={newStock} onChange={setNewStock} placeholder="0" numeric />
            <TouchableOpacity style={styles.createItemBtn} onPress={handleAddItem} disabled={addLoading}>
              {addLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.createItemText}>Create Item</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statChip, { borderColor: color }]}>
      <Text style={[styles.statNum, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AddField({ label, value, onChange, placeholder, numeric }: any) {
  return (
    <View style={{ marginBottom: SPACING.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyIcon: { fontSize: 56, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.dark },
  emptySub: { fontSize: FONT_SIZE.md, color: COLORS.muted, marginTop: SPACING.sm, textAlign: 'center' },

  stallPicker: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm,
    padding: SPACING.md, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  stallTab: { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  stallTabActive: { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primary },
  stallTabText: { fontSize: FONT_SIZE.sm, color: COLORS.muted, fontWeight: '600' },
  stallTabTextActive: { color: COLORS.primary },

  statsBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.md, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  statChip: { borderWidth: 1, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: 4, alignItems: 'center' },
  statNum: { fontSize: FONT_SIZE.md, fontWeight: '800' },
  statLabel: { fontSize: 10, color: COLORS.muted },
  addItemBtn: { marginLeft: 'auto' as any, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: 6 },
  addItemText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.sm },

  list: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 40 },

  itemCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg, ...SHADOWS.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.sm },
  itemName: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.black },
  itemUnit: { fontSize: FONT_SIZE.sm, color: COLORS.muted },
  levelBadge: { borderRadius: BORDER_RADIUS.full, paddingHorizontal: 10, paddingVertical: 3 },
  levelText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  stockRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: SPACING.sm },
  stockNum: { fontSize: FONT_SIZE.xxl, fontWeight: '800', color: COLORS.black },
  stockSep: { fontSize: FONT_SIZE.md, color: COLORS.muted, marginHorizontal: 4 },
  stockMin: { fontSize: FONT_SIZE.sm, color: COLORS.muted },
  barTrack: { height: 6, backgroundColor: COLORS.borderLight, borderRadius: 3, marginBottom: SPACING.sm, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  supplyBtn: { alignSelf: 'flex-start', backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.primaryLight },
  supplyBtnText: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '700' },
  updatedAt: { fontSize: 11, color: COLORS.muted, marginTop: SPACING.sm },

  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: {
    backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, paddingBottom: 40,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.black, marginBottom: 4 },
  modalSub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginBottom: SPACING.lg },
  errorBanner: {
    backgroundColor: COLORS.dangerBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.danger,
  },
  errorBannerText: { fontSize: FONT_SIZE.sm, color: COLORS.danger, fontWeight: '600', lineHeight: 20 },
  fieldLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.dark, marginBottom: 6 },
  fieldInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md, height: 48, fontSize: FONT_SIZE.md,
    color: COLORS.black, backgroundColor: COLORS.surface, marginBottom: SPACING.md,
  },
  modalBtns: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  modalCancel: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center' },
  modalCancelText: { fontWeight: '700', color: COLORS.muted },
  modalConfirm: { flex: 1, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '700' },

  addModal: { flex: 1, backgroundColor: COLORS.white },
  addModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.xl, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  createItemBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.lg, alignItems: 'center', marginTop: SPACING.md },
  createItemText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.lg },
});
