import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Switch, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import {
  fetchMenuConfig, saveMenuItems,
  addMenuItem, updateMenuItem, updateMenuPortion, setItemPortioned,
  setSupplyUnits, removeMenuItem, MOMO_ITEM_KEYS, getSellableUnits, splitUnitKey,
} from '../../store/slices/menuSlice';
import { MenuItem } from '../../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';
import { showAlert } from '../../components/AppAlert';
import { authService } from '../../services/authService';
import { aiService } from '../../services/aiService';

export default function MenuPricingScreen({ navigation }: any) {
  const isTab = !navigation?.canGoBack?.();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((s: RootState) => s.auth);
  const { items, isSaving, milkCostPerPacket, milkMlPerPacket, momoPiecesPerPlate } = useSelector((s: RootState) => s.menu);

  // Snapshot of items as last saved/fetched — used to detect unsaved changes
  const [savedItems, setSavedItems] = useState<MenuItem[]>(items);
  const [savedUnits, setSavedUnits] = useState({
    cost: milkCostPerPacket, ml: milkMlPerPacket, pieces: momoPiecesPerPlate,
  });
  const [milkCostInput, setMilkCostInput] = useState(String(milkCostPerPacket));
  const [milkMlInput, setMilkMlInput] = useState(String(milkMlPerPacket));
  const [momoPiecesInput, setMomoPiecesInput] = useState(String(momoPiecesPerPlate));
  // Resolved stall ID — user.stallId for staff/mod, or first stall for admin
  const [resolvedStallId, setResolvedStallId] = useState<string | null>(user?.stallId || null);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editRecipe, setEditRecipe] = useState('');
  // portionKey -> { name, price } while editing a plate-served item
  const [editPortions, setEditPortions] = useState<Record<string, { name: string; price: string }>>({});

  // Add-item form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newRecipe, setNewRecipe] = useState('');

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
          const cost = cfg?.milkCostPerPacket ?? milkCostPerPacket;
          const ml = cfg?.milkMlPerPacket ?? milkMlPerPacket;
          const pieces = cfg?.momoPiecesPerPlate ?? momoPiecesPerPlate;
          setSavedUnits({ cost, ml, pieces });
          setMilkCostInput(String(cost));
          setMilkMlInput(String(ml));
          setMomoPiecesInput(String(pieces));
        })
        .catch(() => {});
    };
    load();
  }, []);

  const unitsChanged = milkCostPerPacket !== savedUnits.cost
    || milkMlPerPacket !== savedUnits.ml
    || momoPiecesPerPlate !== savedUnits.pieces;
  const hasChanges = JSON.stringify(items) !== JSON.stringify(savedItems) || unitsChanged;

  const startEdit = (item: MenuItem) => {
    haptics.selection();
    setEditingKey(item.key);
    setEditName(item.name);
    setEditPrice(String(item.price));
    setEditRecipe(item.recipe ?? '');
    setEditPortions(
      Object.fromEntries((item.portions ?? []).map(p => [p.key, { name: p.name, price: String(p.price) }])),
    );
  };

  const saveEdit = () => {
    if (!editingKey) return;
    const item = items.find(i => i.key === editingKey);
    const portions = item?.portions ?? [];

    if (!editName.trim()) {
      showAlert('Invalid Input', 'Enter a valid item name.');
      return;
    }

    if (portions.length > 0) {
      const parsed = portions.map(p => ({
        key: p.key,
        name: (editPortions[p.key]?.name ?? p.name).trim(),
        price: parseFloat(editPortions[p.key]?.price ?? String(p.price)),
      }));
      const bad = parsed.find(p => !p.name || isNaN(p.price) || p.price < 0);
      if (bad) {
        showAlert('Invalid Input', 'Enter a valid name and price for every plate size.');
        return;
      }
      haptics.medium();
      dispatch(updateMenuItem({ key: editingKey, name: editName.trim(), recipe: editRecipe.trim() }));
      parsed.forEach(p => dispatch(updateMenuPortion({
        itemKey: editingKey, portionKey: p.key, name: p.name, price: p.price,
      })));
      setEditingKey(null);
      return;
    }

    const price = parseFloat(editPrice);
    if (isNaN(price) || price < 0) {
      showAlert('Invalid Input', 'Enter a valid name and price.');
      return;
    }
    haptics.medium();
    dispatch(updateMenuItem({ key: editingKey, name: editName.trim(), price, recipe: editRecipe.trim() }));
    setEditingKey(null);
  };

  const handleTogglePortioned = (item: MenuItem) => {
    haptics.selection();
    dispatch(setItemPortioned({ key: item.key, portioned: !item.portions?.length }));
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
    dispatch(addMenuItem({ name: newName.trim(), price, recipe: newRecipe.trim() }));
    setNewName('');
    setNewPrice('');
    setNewRecipe('');
    setShowAddForm(false);
  };

  const handleSaveToServer = () => {
    if (!resolvedStallId || !hasChanges) return;
    haptics.medium();

    const priceLabel = (item?: MenuItem) => {
      if (!item) return '';
      if (item.portions?.length) return item.portions.map(p => `${p.name} ₹${p.price}`).join(', ');
      return `₹${item.price}`;
    };

    const changedItems = items.filter((item) => {
      const prev = savedItems.find(s => s.key === item.key);
      return !prev || JSON.stringify(prev) !== JSON.stringify(item);
    });
    const addedItems = items.filter(item => !savedItems.find(s => s.key === item.key));
    const removedItems = savedItems.filter(s => !items.find(i => i.key === s.key));

    const lines: string[] = [];
    addedItems.forEach(i => lines.push(`+ Added: ${i.name} (${priceLabel(i)})`));
    removedItems.forEach(i => lines.push(`− Removed: ${i.name}`));
    changedItems
      .filter(i => !addedItems.find(a => a.key === i.key))
      .forEach(i => {
        const prev = savedItems.find(s => s.key === i.key)!;
        if (priceLabel(prev) !== priceLabel(i)) lines.push(`✏️ ${i.name}: ${priceLabel(prev)} → ${priceLabel(i)}`);
        else if (!i.active && prev.active) lines.push(`🚫 Disabled: ${i.name}`);
        else if (i.active && !prev.active) lines.push(`✅ Enabled: ${i.name}`);
        else if (prev.name !== i.name) lines.push(`✏️ Renamed to: ${i.name}`);
        else lines.push(`✏️ Updated: ${i.name}`);
      });
    if (milkCostPerPacket !== savedUnits.cost) lines.push(`🥛 Milk packet: ₹${savedUnits.cost} → ₹${milkCostPerPacket}`);
    if (milkMlPerPacket !== savedUnits.ml) lines.push(`🥛 Packet size: ${savedUnits.ml}ml → ${milkMlPerPacket}ml`);
    if (momoPiecesPerPlate !== savedUnits.pieces) lines.push(`🥟 Pieces per full plate: ${savedUnits.pieces} → ${momoPiecesPerPlate}`);

    showAlert({
      title: 'Save Menu Changes',
      message: lines.length > 0 ? lines.join('\n') : 'Push updated menu to the server?',
      type: 'confirm',
      buttons: [
        {
          text: 'Save',
          onPress: () => {
            haptics.heavy();
            dispatch(saveMenuItems({
              stallId: resolvedStallId!, items, milkCostPerPacket, milkMlPerPacket, momoPiecesPerPlate,
            }))
              .unwrap()
              .then(() => {
                setSavedItems(items);
                setSavedUnits({ cost: milkCostPerPacket, ml: milkMlPerPacket, pieces: momoPiecesPerPlate });
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

  type PriceSuggestion = { itemKey: string; itemName: string; currentPrice: number; suggestedPrice: number; reason: string };
  const [optimizations, setOptimizations] = useState<PriceSuggestion[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showOptimizer, setShowOptimizer] = useState(false);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setShowOptimizer(true);
    try {
      // Portioned items are sent one entry per plate size so the model prices
      // each serving; the `itemKey::portionKey` form maps back on apply.
      const optimizerItems = items.flatMap((item) =>
        item.portions?.length
          ? item.portions.map(p => ({ ...item, key: `${item.key}::${p.key}`, name: `${item.name} (${p.name})`, price: p.price, portions: undefined }))
          : [item]
      );
      const suggestions = await aiService.getPriceOptimizations(resolvedStallId ?? undefined, optimizerItems);
      setOptimizations(suggestions);
    } catch {
      showAlert('AI Error', 'Could not generate price suggestions. Ensure the server has a valid ANTHROPIC_API_KEY.');
      setShowOptimizer(false);
    } finally {
      setIsOptimizing(false);
    }
  };

  const applyOptimization = (suggestion: PriceSuggestion) => {
    haptics.medium();
    const { itemKey, portionKey } = splitUnitKey(suggestion.itemKey);
    if (portionKey) {
      dispatch(updateMenuPortion({ itemKey, portionKey, price: suggestion.suggestedPrice }));
    } else {
      dispatch(updateMenuItem({ key: itemKey, price: suggestion.suggestedPrice }));
    }
    setOptimizations(prev => prev.filter(s => s.itemKey !== suggestion.itemKey));
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

        {/* Price Optimizer */}
        <TouchableOpacity style={styles.optimizeBtn} onPress={handleOptimize} disabled={isOptimizing}>
          {isOptimizing
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : <Text style={styles.optimizeBtnText}>✨ AI Price Optimizer</Text>
          }
        </TouchableOpacity>

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
                {item.portions?.length ? (
                  <>
                    <Text style={styles.editLabel}>PLATE SIZES & PRICES</Text>
                    {item.portions.map((p) => (
                      <View key={p.key} style={styles.portionEditRow}>
                        <TextInput
                          style={[styles.editInput, styles.portionNameInput]}
                          value={editPortions[p.key]?.name ?? p.name}
                          onChangeText={(text) => setEditPortions(prev => ({
                            ...prev,
                            [p.key]: { name: text, price: prev[p.key]?.price ?? String(p.price) },
                          }))}
                          placeholder="Half Plate"
                          placeholderTextColor={COLORS.muted}
                        />
                        <View style={styles.portionPriceWrap}>
                          <Text style={styles.portionRupee}>₹</Text>
                          <TextInput
                            style={styles.portionPriceInput}
                            value={editPortions[p.key]?.price ?? String(p.price)}
                            onChangeText={(text) => setEditPortions(prev => ({
                              ...prev,
                              [p.key]: { name: prev[p.key]?.name ?? p.name, price: text },
                            }))}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={COLORS.muted}
                          />
                        </View>
                      </View>
                    ))}
                    <Text style={styles.portionHint}>
                      A half plate counts as half a packet against stock, so plate sales still
                      reconcile with opening/closing stock.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.editLabel}>PRICE (₹)</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editPrice}
                      onChangeText={setEditPrice}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={COLORS.muted}
                    />
                  </>
                )}
                <Text style={styles.editLabel}>RECIPE / INSTRUCTIONS (shown to staff)</Text>
                <TextInput
                  style={styles.recipeInput}
                  value={editRecipe}
                  onChangeText={setEditRecipe}
                  placeholder="e.g. Boil 200ml water, add 1 tsp tea leaves, 100ml milk, 2 tsp sugar..."
                  placeholderTextColor={COLORS.muted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
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
                  {item.portions?.length ? (
                    <View style={styles.portionList}>
                      {item.portions.map((p) => (
                        <View key={p.key} style={styles.portionTag}>
                          <Text style={[styles.portionTagName, !item.active && styles.itemPriceInactive]}>{p.name}</Text>
                          <Text style={[styles.portionTagPrice, !item.active && styles.itemPriceInactive]}>₹{p.price}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.itemPrice, !item.active && styles.itemPriceInactive]}>
                      ₹{item.price} per {MOMO_ITEM_KEYS.includes(item.key) ? 'packet' : 'cup'}
                    </Text>
                  )}
                  <TouchableOpacity style={styles.plateToggle} onPress={() => handleTogglePortioned(item)}>
                    <Text style={styles.plateToggleText}>
                      {item.portions?.length ? '↩︎ Use a single price' : '🍽 Sell as half / full plate'}
                    </Text>
                  </TouchableOpacity>
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
            <Text style={styles.editLabel}>PRICE (₹ per cup / packet)</Text>
            <TextInput
              style={styles.editInput}
              value={newPrice}
              onChangeText={setNewPrice}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={COLORS.muted}
            />
            <Text style={styles.editLabel}>RECIPE / INSTRUCTIONS (optional)</Text>
            <TextInput
              style={styles.recipeInput}
              value={newRecipe}
              onChangeText={setNewRecipe}
              placeholder="How to prepare this item..."
              placeholderTextColor={COLORS.muted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => { setShowAddForm(false); setNewName(''); setNewPrice(''); setNewRecipe(''); }}
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

        {/* Supply pricing & units — non-menu values the report entry screens use */}
        <Text style={styles.sectionTitle}>SUPPLY PRICING & UNITS</Text>
        <View style={styles.supplyCard}>
          <Text style={styles.supplyTitle}>🥛 Milk Packet</Text>
          <Text style={styles.supplySub}>Used for the milk expense counter on the staff tally screen.</Text>
          <View style={styles.supplyRow}>
            <View style={styles.supplyField}>
              <Text style={styles.editLabel}>COST PER PACKET (₹)</Text>
              <TextInput
                style={styles.editInput}
                value={milkCostInput}
                onChangeText={(text) => {
                  setMilkCostInput(text);
                  const n = parseFloat(text);
                  if (!isNaN(n) && n >= 0) dispatch(setSupplyUnits({ milkCostPerPacket: n }));
                }}
                keyboardType="decimal-pad"
                placeholder="30"
                placeholderTextColor={COLORS.muted}
              />
            </View>
            <View style={styles.supplyField}>
              <Text style={styles.editLabel}>PACKET SIZE (ML)</Text>
              <TextInput
                style={styles.editInput}
                value={milkMlInput}
                onChangeText={(text) => {
                  setMilkMlInput(text);
                  const n = parseFloat(text);
                  if (!isNaN(n) && n > 0) dispatch(setSupplyUnits({ milkMlPerPacket: n }));
                }}
                keyboardType="decimal-pad"
                placeholder="500"
                placeholderTextColor={COLORS.muted}
              />
            </View>
          </View>

          <View style={styles.supplyDivider} />

          <Text style={styles.supplyTitle}>🥟 Momo Plate Size</Text>
          <Text style={styles.supplySub}>
            Staff count momos in pieces on the daily report; this converts them into plates sold.
          </Text>
          <View style={styles.supplyRow}>
            <View style={styles.supplyField}>
              <Text style={styles.editLabel}>PIECES PER FULL PLATE</Text>
              <TextInput
                style={styles.editInput}
                value={momoPiecesInput}
                onChangeText={(text) => {
                  setMomoPiecesInput(text);
                  const n = parseFloat(text);
                  if (!isNaN(n) && n > 0) dispatch(setSupplyUnits({ momoPiecesPerPlate: n }));
                }}
                keyboardType="decimal-pad"
                placeholder="10"
                placeholderTextColor={COLORS.muted}
              />
            </View>
            <View style={styles.supplyField} />
          </View>
        </View>

        {/* Preview card */}
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>MENU PREVIEW</Text>
          <Text style={styles.previewSub}>How staff sees it during sales entry</Text>
          {activeItems.sort((a, b) => a.sortOrder - b.sortOrder).flatMap((item) =>
            getSellableUnits(item).map((unit) => (
              <View key={unit.unitKey} style={styles.previewRow}>
                <Text style={styles.previewItem}>
                  {MOMO_ITEM_KEYS.includes(item.key) ? '🥟' : '☕'} {item.name}
                  {unit.portionName ? ` · ${unit.portionName}` : ''}
                </Text>
                <Text style={styles.previewPrice}>₹{unit.price}</Text>
              </View>
            ))
          )}
          {activeItems.length === 0 && (
            <Text style={styles.previewEmpty}>No active items — enable some above</Text>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Price Optimizer Modal */}
      <Modal visible={showOptimizer} transparent animationType="slide" onRequestClose={() => setShowOptimizer(false)}>
        <View style={styles.optimizerOverlay}>
          <View style={styles.optimizerSheet}>
            <View style={styles.optimizerHandle} />
            <Text style={styles.optimizerTitle}>✨ AI Price Optimizer</Text>
            <Text style={styles.optimizerSub}>Based on last 30 days of sales data</Text>
            {isOptimizing ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={{ color: COLORS.muted, marginTop: 12, fontSize: FONT_SIZE.sm }}>Analyzing sales patterns…</Text>
              </View>
            ) : optimizations.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ fontSize: 32 }}>✅</Text>
                <Text style={{ color: COLORS.muted, marginTop: 8, textAlign: 'center' }}>All prices look optimal based on current sales data.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 380 }}>
                {optimizations.map((s) => {
                  const isIncrease = s.suggestedPrice > s.currentPrice;
                  const isDecrease = s.suggestedPrice < s.currentPrice;
                  const isSame = s.suggestedPrice === s.currentPrice;
                  return (
                    <View key={s.itemKey} style={styles.optimizerRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.optimizerItemName}>{s.itemName}</Text>
                        <Text style={styles.optimizerReason}>{s.reason}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <Text style={styles.optimizerOldPrice}>₹{s.currentPrice}</Text>
                          <Text style={{ color: COLORS.muted }}>→</Text>
                          <Text style={[styles.optimizerNewPrice, { color: isIncrease ? COLORS.success : isDecrease ? COLORS.danger : COLORS.muted }]}>
                            ₹{s.suggestedPrice}
                          </Text>
                          {!isSame && (
                            <View style={[styles.optimizerChangeBadge, { backgroundColor: isIncrease ? COLORS.successBg : COLORS.dangerBg }]}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: isIncrease ? COLORS.success : COLORS.danger }}>
                                {isIncrease ? '+' : ''}₹{s.suggestedPrice - s.currentPrice}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      {!isSame && (
                        <TouchableOpacity style={styles.optimizerApplyBtn} onPress={() => applyOptimization(s)}>
                          <Text style={styles.optimizerApplyText}>Apply</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.optimizerCloseBtn} onPress={() => setShowOptimizer(false)}>
              <Text style={styles.optimizerCloseBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  portionList: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  portionTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: 3,
    borderWidth: 1, borderColor: COLORS.border,
  },
  portionTagName: { fontSize: FONT_SIZE.sm, color: COLORS.primaryLight, fontWeight: '600' },
  portionTagPrice: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '800' },
  plateToggle: { marginTop: 6, alignSelf: 'flex-start' },
  plateToggleText: { fontSize: 11, fontWeight: '700', color: COLORS.primaryLight },

  portionEditRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  portionNameInput: { flex: 1 },
  portionPriceWrap: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm, backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md, minWidth: 96, minHeight: 48,
  },
  portionRupee: { fontSize: FONT_SIZE.md, color: COLORS.primaryLight, fontWeight: '700', marginRight: 4 },
  portionPriceInput: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.black, fontWeight: '700' },
  portionHint: { fontSize: 11, color: COLORS.muted, marginTop: SPACING.sm, lineHeight: 16 },

  supplyCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  supplyTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black },
  supplySub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 2 },
  supplyRow: { flexDirection: 'row', gap: SPACING.md },
  supplyDivider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.lg },
  supplyField: { flex: 1 },

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
  recipeInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.sm, color: COLORS.black, minHeight: 90, lineHeight: 20,
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

  optimizeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  optimizeBtnText: { fontSize: FONT_SIZE.sm, fontWeight: '800', color: COLORS.primary },

  optimizerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  optimizerSheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SPACING.xl, paddingBottom: 40, paddingTop: SPACING.md,
  },
  optimizerHandle: {
    width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2,
    alignSelf: 'center', marginBottom: SPACING.lg,
  },
  optimizerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.black, marginBottom: 4 },
  optimizerSub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginBottom: SPACING.lg },
  optimizerRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  optimizerItemName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black },
  optimizerReason: { fontSize: 12, color: COLORS.muted, marginTop: 2, lineHeight: 16 },
  optimizerOldPrice: { fontSize: FONT_SIZE.md, color: COLORS.muted, textDecorationLine: 'line-through' },
  optimizerNewPrice: { fontSize: FONT_SIZE.md, fontWeight: '800' },
  optimizerChangeBadge: {
    borderRadius: BORDER_RADIUS.full, paddingHorizontal: 8, paddingVertical: 2,
  },
  optimizerApplyBtn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, marginLeft: SPACING.md,
  },
  optimizerApplyText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.sm },
  optimizerCloseBtn: {
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  optimizerCloseBtnText: { fontWeight: '700', color: COLORS.dark, fontSize: FONT_SIZE.md },
});
