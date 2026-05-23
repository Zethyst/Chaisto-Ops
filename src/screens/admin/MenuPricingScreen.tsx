import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import {
  fetchMenuConfig, saveMenuItems,
  addMenuItem, updateMenuItem, removeMenuItem,
} from '../../store/slices/menuSlice';
import { MenuItem } from '../../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';
import { showAlert } from '../../components/AppAlert';
import { authService } from '../../services/authService';

export default function MenuPricingScreen({ navigation }: any) {
  const isTab = !navigation?.canGoBack?.();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((s: RootState) => s.auth);
  const { items, isSaving } = useSelector((s: RootState) => s.menu);

  // Snapshot of items as last saved/fetched — used to detect unsaved changes
  const [savedItems, setSavedItems] = useState<MenuItem[]>(items);
  // Resolved stall ID — user.stallId for staff/mod, or first stall for admin
  const [resolvedStallId, setResolvedStallId] = useState<string | null>(user?.stallId || null);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  // Add-item form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  useEffect(() => {
    const load = async () => {
      let stallId = user?.stallId;
      if (!stallId) {
        // Admin users have no stallId on their account — resolve from stalls list
        try {
          const stalls = await authService.getStalls();
          stallId = stalls[0]?.id;
        } catch {}
      }
      if (!stallId) return;
      setResolvedStallId(stallId);
      dispatch(fetchMenuConfig(stallId)).unwrap()
        .then((cfg: any) => {
          if (cfg?.menuItems?.length > 0) setSavedItems(cfg.menuItems);
        })
        .catch(() => {});
    };
    load();
  }, []);

  const hasChanges = JSON.stringify(items) !== JSON.stringify(savedItems);

  const startEdit = (item: MenuItem) => {
    haptics.selection();
    setEditingKey(item.key);
    setEditName(item.name);
    setEditPrice(String(item.price));
  };

  const saveEdit = () => {
    if (!editingKey) return;
    const price = parseFloat(editPrice);
    if (!editName.trim() || isNaN(price) || price < 0) {
      showAlert('Invalid Input', 'Enter a valid name and price.');
      return;
    }
    haptics.medium();
    dispatch(updateMenuItem({ key: editingKey, name: editName.trim(), price }));
    setEditingKey(null);
  };

  const cancelEdit = () => {
    haptics.light();
    setEditingKey(null);
  };

  const handleToggleActive = (item: MenuItem) => {
    haptics.selection();
    dispatch(updateMenuItem({ key: item.key, active: !item.active }));
  };

  const handleDelete = (item: MenuItem) => {
    if (item.isDefault) {
      showAlert('Cannot Delete', 'Default items cannot be deleted. You can disable them instead.', [
        { text: 'Disable Instead', onPress: () => dispatch(updateMenuItem({ key: item.key, active: false })) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    haptics.heavy();
    showAlert('Remove Item', `Remove "${item.name}" from the menu?`, [
      {
        text: 'Remove', style: 'destructive',
        onPress: () => dispatch(removeMenuItem(item.key)),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleAddItem = () => {
    const price = parseFloat(newPrice);
    if (!newName.trim() || isNaN(price) || price < 0) {
      showAlert('Invalid Input', 'Enter a valid name and price for the new item.');
      return;
    }
    haptics.medium();
    dispatch(addMenuItem({ name: newName.trim(), price }));
    setNewName('');
    setNewPrice('');
    setShowAddForm(false);
  };

  const handleSaveToServer = () => {
    if (!resolvedStallId || !hasChanges) return;
    haptics.medium();

    const changedItems = items.filter((item) => {
      const prev = savedItems.find(s => s.key === item.key);
      return !prev || prev.name !== item.name || prev.price !== item.price || prev.active !== item.active;
    });
    const addedItems = items.filter(item => !savedItems.find(s => s.key === item.key));
    const removedItems = savedItems.filter(s => !items.find(i => i.key === s.key));

    const lines: string[] = [];
    addedItems.forEach(i => lines.push(`+ Added: ${i.name} (₹${i.price})`));
    removedItems.forEach(i => lines.push(`− Removed: ${i.name}`));
    changedItems
      .filter(i => !addedItems.find(a => a.key === i.key))
      .forEach(i => {
        const prev = savedItems.find(s => s.key === i.key)!;
        if (prev.price !== i.price) lines.push(`✏️ ${i.name}: ₹${prev.price} → ₹${i.price}`);
        else if (!i.active && prev.active) lines.push(`🚫 Disabled: ${i.name}`);
        else if (i.active && !prev.active) lines.push(`✅ Enabled: ${i.name}`);
        else lines.push(`✏️ Renamed to: ${i.name}`);
      });

    showAlert({
      title: 'Save Menu Changes',
      message: lines.length > 0 ? lines.join('\n') : 'Push updated menu to the server?',
      type: 'confirm',
      buttons: [
        {
          text: 'Save',
          onPress: () => {
            haptics.heavy();
            dispatch(saveMenuItems({ stallId: resolvedStallId!, items }))
              .unwrap()
              .then(() => {
                setSavedItems(items);
                showAlert('Menu Saved', 'Menu and pricing updated successfully.');
              })
              .catch((err: string) => {
                showAlert('Save Failed', err || 'Could not save menu. Try again.');
              });
          },
        },
        { text: 'Review', style: 'cancel' },
      ],
    });
  };

  const activeItems = items.filter(i => i.active);
  const totalRevEstimate = activeItems.reduce((sum, i) => sum + i.price, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {!isTab && (
          <TouchableOpacity style={styles.backBtn} onPress={() => { haptics.light(); navigation.goBack(); }}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Menu & Pricing</Text>
          <Text style={styles.headerSub}>{activeItems.length} active items</Text>
        </View>
        {(hasChanges || isSaving) && (
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={handleSaveToServer}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoText}>
            Prices shown to staff during sales entry and used for revenue estimates. Tap Save to push changes.
          </Text>
        </View>

        {/* Menu Items */}
        <Text style={styles.sectionTitle}>MENU ITEMS</Text>

        {items.map((item) => (
          <View key={item.key} style={[styles.itemCard, !item.active && styles.itemCardInactive]}>
            {editingKey === item.key ? (
              // Edit mode
              <View>
                <Text style={styles.editLabel}>ITEM NAME</Text>
                <TextInput
                  style={styles.editInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="e.g. Ginger Chai"
                  placeholderTextColor={COLORS.muted}
                  autoFocus
                />
                <Text style={styles.editLabel}>PRICE (₹)</Text>
                <TextInput
                  style={styles.editInput}
                  value={editPrice}
                  onChangeText={setEditPrice}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={COLORS.muted}
                />
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.editCancelBtn} onPress={cancelEdit}>
                    <Text style={styles.editCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.editSaveBtn} onPress={saveEdit}>
                    <Text style={styles.editSaveText}>✓  Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Display mode
              <View style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, !item.active && styles.itemNameInactive]}>
                      {item.name}
                    </Text>
                    {item.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.itemPrice, !item.active && styles.itemPriceInactive]}>
                    ₹{item.price} per cup
                  </Text>
                </View>
                <View style={styles.itemActions}>
                  <Switch
                    value={item.active}
                    onValueChange={() => handleToggleActive(item)}
                    trackColor={{ false: COLORS.borderLight, true: COLORS.primaryBg }}
                    thumbColor={item.active ? COLORS.primary : COLORS.muted}
                  />
                  <TouchableOpacity style={styles.editBtn} onPress={() => startEdit(item)}>
                    <Text style={styles.editBtnText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ))}

        {/* Add Item Form */}
        {showAddForm ? (
          <View style={styles.addForm}>
            <Text style={styles.addFormTitle}>NEW MENU ITEM</Text>
            <Text style={styles.editLabel}>ITEM NAME</Text>
            <TextInput
              style={styles.editInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Masala Chai"
              placeholderTextColor={COLORS.muted}
              autoFocus
            />
            <Text style={styles.editLabel}>PRICE (₹ per cup)</Text>
            <TextInput
              style={styles.editInput}
              value={newPrice}
              onChangeText={setNewPrice}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={COLORS.muted}
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => { setShowAddForm(false); setNewName(''); setNewPrice(''); }}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editSaveBtn} onPress={handleAddItem}>
                <Text style={styles.editSaveText}>+ Add Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addItemBtn}
            onPress={() => { haptics.light(); setShowAddForm(true); }}
          >
            <Text style={styles.addItemBtnText}>+ Add Menu Item</Text>
          </TouchableOpacity>
        )}

        {/* Preview card */}
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>MENU PREVIEW</Text>
          <Text style={styles.previewSub}>How staff sees it during sales entry</Text>
          {activeItems.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
            <View key={item.key} style={styles.previewRow}>
              <Text style={styles.previewItem}>☕ {item.name}</Text>
              <Text style={styles.previewPrice}>₹{item.price}</Text>
            </View>
          ))}
          {activeItems.length === 0 && (
            <Text style={styles.previewEmpty}>No active items — enable some above</Text>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { marginRight: SPACING.md, padding: 4 },
  backText: { fontSize: 22, color: COLORS.primaryLight, fontWeight: '700' },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.black },
  headerSub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 2 },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    minWidth: 64, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: FONT_SIZE.md },

  scroll: { padding: SPACING.xl },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.primaryBg,
    borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
  },
  infoIcon: { fontSize: 16, marginTop: 1 },
  infoText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.primaryLight, lineHeight: 20 },

  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: COLORS.muted, letterSpacing: 1.5,
    marginBottom: SPACING.md,
  },

  itemCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  itemCardInactive: { opacity: 0.55 },

  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemLeft: { flex: 1 },
  itemInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  itemName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black },
  itemNameInactive: { color: COLORS.muted },
  defaultBadge: {
    backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.border,
  },
  defaultBadgeText: { fontSize: 9, fontWeight: '800', color: COLORS.primaryLight, letterSpacing: 0.5 },
  itemPrice: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600' },
  itemPriceInactive: { color: COLORS.muted },

  itemActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  editBtn: { padding: 6 },
  editBtnText: { fontSize: 18 },
  deleteBtn: { padding: 6 },
  deleteBtnText: { fontSize: 18 },

  editLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.muted, letterSpacing: 1.2,
    marginBottom: 6, marginTop: SPACING.md,
  },
  editInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.md, color: COLORS.black, minHeight: 48,
  },
  editActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
  editCancelBtn: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.sm,
    paddingVertical: SPACING.md, alignItems: 'center',
  },
  editCancelText: { color: COLORS.medium, fontWeight: '600', fontSize: FONT_SIZE.md },
  editSaveBtn: {
    flex: 2, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.sm,
    paddingVertical: SPACING.md, alignItems: 'center',
  },
  editSaveText: { color: '#fff', fontWeight: '800', fontSize: FONT_SIZE.md },

  addForm: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md,
    borderWidth: 2, borderColor: COLORS.primary, borderStyle: 'dashed',
  },
  addFormTitle: { fontSize: 11, fontWeight: '700', color: COLORS.primary, letterSpacing: 1.5 },

  addItemBtn: {
    borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  addItemBtnText: { color: COLORS.primaryLight, fontWeight: '700', fontSize: FONT_SIZE.md },

  previewCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  previewTitle: { fontSize: 11, fontWeight: '700', color: COLORS.muted, letterSpacing: 1.5, marginBottom: 4 },
  previewSub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginBottom: SPACING.lg },
  previewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  previewItem: { fontSize: FONT_SIZE.md, color: COLORS.dark },
  previewPrice: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primary },
  previewEmpty: { fontSize: FONT_SIZE.sm, color: COLORS.muted, textAlign: 'center', paddingVertical: SPACING.lg },
});
