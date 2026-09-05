import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, Pressable, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import {
  ensureFreshTally, incrementTally, decrementTally,
  incrementMilkPackets, decrementMilkPackets,
  setTallyUpi, setTallyCash, setTallyNotes, setTallyCigarettes, resetTally,
  fetchMenuConfig, MOMO_ITEM_KEYS, getSellableUnits,
  servingsForItem, revenueForItem,
} from '../../store/slices/menuSlice';
import { resumeOrStartReport, preFillFromTally } from '../../store/slices/reportSlice';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';
import { showAlert } from '../../components/AppAlert';
import BufferedTextInput from '../../components/BufferedTextInput';
import { useLanguage } from '../../i18n';

// ─── Animated counter button ──────────────────────────────────────────────────
function CounterButton({ onPress, onLongPress, label, style, textStyle }: any) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 50 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      delayLongPress={400}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        <Text style={textStyle}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Counter row ──────────────────────────────────────────────────────────────
// One −/count/+ control. Portioned items render one of these per serving size.
function UnitCounter({ count, onIncrement, onDecrement, onLongIncrement, onLongDecrement }: any) {
  const countScale = useRef(new Animated.Value(1)).current;

  const handleIncrement = () => {
    onIncrement();
    Animated.sequence([
      Animated.spring(countScale, { toValue: 1.3, useNativeDriver: true, speed: 80 }),
      Animated.spring(countScale, { toValue: 1, useNativeDriver: true, speed: 60 }),
    ]).start();
  };

  return (
    <View style={counterStyles.counterRow}>
      <CounterButton
        label="−"
        style={[counterStyles.counterBtn, counterStyles.decrementBtn, count === 0 && counterStyles.counterBtnDisabled]}
        textStyle={[counterStyles.counterBtnText, count === 0 && { opacity: 0.3 }]}
        onPress={() => count > 0 && onDecrement()}
        onLongPress={() => count > 0 && onLongDecrement()}
      />

      <Animated.View style={[counterStyles.countBox, { transform: [{ scale: countScale }] }]}>
        <Text style={[counterStyles.countText, count > 0 && counterStyles.countTextActive]}>
          {count}
        </Text>
      </Animated.View>

      <CounterButton
        label="+"
        style={[counterStyles.counterBtn, counterStyles.incrementBtn]}
        textStyle={counterStyles.counterBtnTextPlus}
        onPress={handleIncrement}
        onLongPress={onLongIncrement}
      />
    </View>
  );
}

// ─── Counter card ─────────────────────────────────────────────────────────────
function CounterCard({ item, units, counters, onIncrement, onDecrement, onLongIncrement, onLongDecrement, unitLabel, onPressRecipe }: any) {
  const isPortioned = units.length > 1;
  const totalCount = units.reduce((sum: number, u: any) => sum + (counters[u.unitKey] || 0), 0);
  const subtotal = units.reduce((sum: number, u: any) => sum + (counters[u.unitKey] || 0) * u.price, 0);

  return (
    <View style={counterStyles.card}>
      <View style={counterStyles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={counterStyles.itemName}>{item.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {!isPortioned && (
              <Text style={counterStyles.itemPrice}>₹{units[0].price} {unitLabel}</Text>
            )}
            {item.recipe && (
              <TouchableOpacity style={counterStyles.recipeBtn} onPress={onPressRecipe}>
                <Text style={counterStyles.recipeBtnText}>📖 Recipe</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {subtotal > 0 && (
          <View style={counterStyles.subtotalBadge}>
            <Text style={counterStyles.subtotalText}>₹{subtotal}</Text>
          </View>
        )}
      </View>

      {units.map((unit: any, idx: number) => {
        const count = counters[unit.unitKey] || 0;
        return (
          <View key={unit.unitKey} style={idx > 0 ? counterStyles.portionBlockSpaced : undefined}>
            {isPortioned && (
              <View style={counterStyles.portionHeader}>
                <View style={[counterStyles.portionChip, count > 0 && counterStyles.portionChipActive]}>
                  <Text style={[counterStyles.portionChipText, count > 0 && counterStyles.portionChipTextActive]}>
                    {unit.portionName}
                  </Text>
                </View>
                <Text style={counterStyles.portionPrice}>₹{unit.price}</Text>
                {count > 0 && (
                  <Text style={counterStyles.portionSubtotal}>= ₹{count * unit.price}</Text>
                )}
              </View>
            )}
            <UnitCounter
              count={count}
              onIncrement={() => onIncrement(unit.unitKey)}
              onDecrement={() => onDecrement(unit.unitKey)}
              onLongIncrement={() => onLongIncrement(unit.unitKey)}
              onLongDecrement={() => onLongDecrement(unit.unitKey)}
            />
          </View>
        );
      })}

      {totalCount > 0 && (
        <View style={counterStyles.progressBar}>
          <View
            style={[counterStyles.progressFill, { width: `${Math.min((totalCount / 100) * 100, 100)}%` as any }]}
          />
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function TallyScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useLanguage();
  const { user } = useSelector((s: RootState) => s.auth);
  const { items, tally, milkCostPerPacket, milkMlPerPacket } = useSelector((s: RootState) => s.menu);
  const { todayReport } = useSelector((s: RootState) => s.reports);

  // Shown straight from the tally rather than seeded from it: ensureFreshTally
  // zeroes yesterday's figures on the first open of a new day, which happens
  // after the first render, and a seeded copy would keep showing them over an
  // empty tally. BufferedTextInput is what makes reading redux live safe here.
  const moneyText = (n: number) => (n ? String(n) : '');
  const [recipeModal, setRecipeModal] = useState<{ name: string; recipe: string } | null>(null);

  useEffect(() => {
    dispatch(ensureFreshTally());
    if (user?.stallId) dispatch(fetchMenuConfig(user.stallId));
  }, []);

  const activeItems = items.filter(i => i.active).sort((a, b) => a.sortOrder - b.sortOrder);

  // Portioned items (half / full plate) contribute one counter per serving, so
  // totals sum across every sellable unit rather than a single per-item count.
  const totalCups = activeItems
    .filter(item => !MOMO_ITEM_KEYS.includes(item.key))
    .reduce((sum, item) => sum + servingsForItem(item, tally.counters), 0);
  const totalMomoPlates = activeItems
    .filter(item => MOMO_ITEM_KEYS.includes(item.key))
    .reduce((sum, item) => sum + servingsForItem(item, tally.counters), 0);
  const cigaretteSales = tally.cigarettes || 0;
  const totalRevenue = activeItems.reduce((sum, item) => sum + revenueForItem(item, tally.counters), 0)
    + cigaretteSales;
  const totalPayments = tally.upi + tally.cash;
  const milkCost = tally.milkPackets * milkCostPerPacket;
  const milkLitres = ((tally.milkPackets * milkMlPerPacket) / 1000).toFixed(1);

  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const hasTallyData = totalCups > 0 || totalMomoPlates > 0 || cigaretteSales > 0
    || tally.upi > 0 || tally.cash > 0 || tally.milkPackets > 0;

  const handleReset = () => {
    haptics.heavy();
    showAlert(t('tallyResetTitle'), t('tallyResetConfirm'), [
      {
        text: t('tallyResetBtn'), style: 'destructive',
        onPress: () => {
          dispatch(resetTally());
          haptics.success();
        },
      },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const handleStartReport = () => {
    if (todayReport) {
      showAlert(t('tallyAlreadySubmittedTitle'), t('tallyAlreadySubmittedMsg'));
      return;
    }
    haptics.heavy();
    showAlert(
      t('tallyStartReportTitle'),
      hasTallyData ? t('tallyPreFillMsg') : t('tallyStartFreshMsg'),
      [
        {
          text: hasTallyData ? t('tallyUseTallyData') : t('startDailyReport'),
          onPress: async () => {
            // Resumes an unfinished report — the local draft, or one autosaved
            // to the server — before layering today's tally on top
            await dispatch(resumeOrStartReport({
              staffId: user?.id || '',
              stallId: user?.stallId || '',
              stallName: user?.stallName || '',
            }));
            if (hasTallyData) dispatch(preFillFromTally({ tally, items }));
            navigation.navigate('DailyReport');
          },
        },
        hasTallyData ? {
          text: t('tallyStartFreshBtn'),
          onPress: async () => {
            await dispatch(resumeOrStartReport({
              staffId: user?.id || '',
              stallId: user?.stallId || '',
              stallName: user?.stallName || '',
            }));
            navigation.navigate('DailyReport');
          },
        } : null,
        { text: t('cancel'), style: 'cancel' as const },
      ].filter(Boolean) as any
    );
  };

  return (
    <>
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerOrb} />
        <View>
          <Text style={styles.headerTitle}>{t('tallyTitle')}</Text>
          <Text style={styles.headerDate}>{dateStr}</Text>
        </View>
        {hasTallyData && (
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Text style={styles.resetBtnText}>{t('tallyResetBtn')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Totals strip */}
      <View style={styles.totalsStrip}>
        <View style={styles.totalItem}>
          <Text style={styles.totalValue}>{totalCups}</Text>
          <Text style={styles.totalLabel}>{t('cups').toUpperCase()}</Text>
        </View>
        <View style={styles.totalDivider} />
        <View style={styles.totalItem}>
          <Text style={styles.totalValue}>{totalMomoPlates}</Text>
          <Text style={styles.totalLabel}>{t('tallyMomosLabel')}</Text>
        </View>
        <View style={styles.totalDivider} />
        <View style={styles.totalItem}>
          <Text style={[styles.totalValue, { color: COLORS.success }]}>
            ₹{totalRevenue.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.totalLabel}>{t('tallyEstRevenue')}</Text>
        </View>
        <View style={styles.totalDivider} />
        <View style={styles.totalItem}>
          <Text style={[styles.totalValue, {
            color: Math.abs(totalPayments - totalRevenue) > 50 && totalPayments > 0
              ? COLORS.warning : COLORS.dark,
          }]}>
            ₹{totalPayments.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.totalLabel}>{t('tallyCollected')}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Cup counters */}
        <Text style={styles.sectionLabel}>{t('tallyCupCounters')}</Text>
        <Text style={styles.sectionHint}>{t('tallyCupCountersHint')}</Text>

        {activeItems.map((item) => (
          <CounterCard
            key={item.key}
            item={item}
            units={getSellableUnits(item)}
            counters={tally.counters}
            unitLabel={MOMO_ITEM_KEYS.includes(item.key) ? t('tallyPerPacket') : t('tallyPerCup')}
            onPressRecipe={() => setRecipeModal({ name: item.name, recipe: item.recipe || '' })}
            onIncrement={(key: string) => {
              haptics.selection();
              dispatch(incrementTally({ key }));
            }}
            onDecrement={(key: string) => {
              haptics.light();
              dispatch(decrementTally({ key }));
            }}
            onLongIncrement={(key: string) => {
              haptics.heavy();
              dispatch(incrementTally({ key, by: 5 }));
            }}
            onLongDecrement={(key: string) => {
              haptics.medium();
              dispatch(decrementTally({ key, by: 5 }));
            }}
          />
        ))}

        {activeItems.length === 0 && (
          <View style={styles.emptyMenuNote}>
            <Text style={styles.emptyMenuIcon}>☕</Text>
            <Text style={styles.emptyMenuText}>{t('tallyNoMenuItems')}</Text>
            <Text style={styles.emptyMenuSub}>{t('tallyNoMenuItemsSub')}</Text>
          </View>
        )}

        {/* Milk expense counter */}
        <Text style={[styles.sectionLabel, { marginTop: SPACING.xl }]}>{t('tallyMilkExpense')}</Text>
        <Text style={styles.sectionHint}>{t('tallyMilkHint')}</Text>

        <View style={milkStyles.card}>
          <View style={milkStyles.cardHeader}>
            <View>
              <Text style={milkStyles.title}>{t('tallyMilkTitle')}</Text>
              <Text style={milkStyles.subtitle}>
                {t('tallyMilkSubtitle')
                  .replace('{ml}', String(milkMlPerPacket))
                  .replace('{cost}', String(milkCostPerPacket))}
              </Text>
            </View>
            {tally.milkPackets > 0 && (
              <View style={milkStyles.infoBadge}>
                <Text style={milkStyles.infoBadgeTop}>{milkLitres}L</Text>
                <Text style={milkStyles.infoBadgeBot}>₹{milkCost} cost</Text>
              </View>
            )}
          </View>

          <View style={counterStyles.counterRow}>
            <CounterButton
              label="−"
              style={[counterStyles.counterBtn, milkStyles.decrementBtn, tally.milkPackets === 0 && counterStyles.counterBtnDisabled]}
              textStyle={[counterStyles.counterBtnText, tally.milkPackets === 0 && { opacity: 0.3 }]}
              onPress={() => {
                if (tally.milkPackets === 0) return;
                haptics.light();
                dispatch(decrementMilkPackets());
              }}
              onLongPress={() => {
                if (tally.milkPackets === 0) return;
                haptics.medium();
                dispatch(decrementMilkPackets(5));
              }}
            />
            <View style={counterStyles.countBox}>
              <Text style={[counterStyles.countText, tally.milkPackets > 0 && counterStyles.countTextActive]}>
                {tally.milkPackets}
              </Text>
            </View>
            <CounterButton
              label="+"
              style={[counterStyles.counterBtn, milkStyles.incrementBtn]}
              textStyle={counterStyles.counterBtnTextPlus}
              onPress={() => {
                haptics.selection();
                dispatch(incrementMilkPackets());
              }}
              onLongPress={() => {
                haptics.heavy();
                dispatch(incrementMilkPackets(5));
              }}
            />
          </View>

          {tally.milkPackets > 0 && (
            <View style={milkStyles.progressBar}>
              <View style={[milkStyles.progressFill, { width: `${Math.min((tally.milkPackets / 20) * 100, 100)}%` as any }]} />
            </View>
          )}
        </View>

        {/* Cigarettes — tracked by rupee value, not by unit count */}
        <Text style={[styles.sectionLabel, { marginTop: SPACING.xl }]}>{t('tallyCigarettes')}</Text>
        <Text style={styles.sectionHint}>{t('tallyCigarettesHint')}</Text>

        <View style={styles.paymentCard}>
          <View style={styles.paymentRow}>
            <View style={styles.paymentLabelCol}>
              <Text style={styles.paymentMode}>🚬 {t('tallyCigarettesLabel')}</Text>
              <Text style={styles.paymentSub}>{t('tallyCigarettesSub')}</Text>
            </View>
            <View style={styles.paymentInputWrap}>
              <Text style={styles.rupeeSign}>₹</Text>
              <BufferedTextInput
                style={styles.paymentInput}
                value={moneyText(tally.cigarettes ?? 0)}
                onChangeText={(text) => {
                  const n = parseFloat(text);
                  dispatch(setTallyCigarettes(isNaN(n) ? 0 : n));
                }}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={COLORS.muted}
              />
            </View>
          </View>
        </View>

        {/* Payment tally */}
        <Text style={[styles.sectionLabel, { marginTop: SPACING.xl }]}>{t('tallyPaymentTally')}</Text>
        <Text style={styles.sectionHint}>{t('tallyPaymentHint')}</Text>

        <View style={styles.paymentCard}>
          <View style={styles.paymentRow}>
            <View style={styles.paymentLabelCol}>
              <Text style={styles.paymentMode}>📱 UPI</Text>
              <Text style={styles.paymentSub}>{t('tallyUpiSub')}</Text>
            </View>
            <View style={styles.paymentInputWrap}>
              <Text style={styles.rupeeSign}>₹</Text>
              <BufferedTextInput
                style={styles.paymentInput}
                value={moneyText(tally.upi)}
                onChangeText={(t) => {
                  const n = parseFloat(t);
                  dispatch(setTallyUpi(isNaN(n) ? 0 : n));
                }}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={COLORS.muted}
              />
            </View>
          </View>

          <View style={styles.paymentDivider} />

          <View style={styles.paymentRow}>
            <View style={styles.paymentLabelCol}>
              <Text style={styles.paymentMode}>💵 Cash</Text>
              <Text style={styles.paymentSub}>{t('tallyCashSub')}</Text>
            </View>
            <View style={styles.paymentInputWrap}>
              <Text style={styles.rupeeSign}>₹</Text>
              <BufferedTextInput
                style={styles.paymentInput}
                value={moneyText(tally.cash)}
                onChangeText={(t) => {
                  const n = parseFloat(t);
                  dispatch(setTallyCash(isNaN(n) ? 0 : n));
                }}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={COLORS.muted}
              />
            </View>
          </View>

          {/* Mismatch warning */}
          {totalPayments > 0 && totalRevenue > 0 && Math.abs(totalPayments - totalRevenue) > 50 && (
            <View style={styles.mismatchRow}>
              <Text style={styles.mismatchText}>
                ⚠️ {t('tallyMismatchWarning')
                  .replace('{collected}', String(totalPayments))
                  .replace('{estimated}', String(totalRevenue))}
              </Text>
            </View>
          )}
        </View>

        {/* Notes */}
        <Text style={[styles.sectionLabel, { marginTop: SPACING.xl }]}>{t('tallyNotesSectionLabel')}</Text>
        {/* Buffered: the notes live in redux, and a plain controlled input
            reordered characters when typed at speed */}
        <BufferedTextInput
          style={styles.notesInput}
          value={tally.notes}
          onChangeText={(text) => dispatch(setTallyNotes(text))}
          placeholder={t('tallyNotesPlaceholder')}
          placeholderTextColor={COLORS.muted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + SPACING.md }]}>
        {(totalRevenue > 0 || milkCost > 0) && (
          <View style={styles.ctaSummary}>
            <Text style={styles.ctaSummaryText}>
              {totalCups > 0 ? `${totalCups} cups` : ''}
              {totalCups > 0 && totalMomoPlates > 0 ? ' · ' : ''}
              {totalMomoPlates > 0 ? `${totalMomoPlates} momo plates` : ''}
              {(totalCups > 0 || totalMomoPlates > 0) && cigaretteSales > 0 ? ' · ' : ''}
              {cigaretteSales > 0 ? `🚬 ₹${cigaretteSales}` : ''}
              {(totalCups > 0 || totalMomoPlates > 0 || cigaretteSales > 0) ? ` · ₹${totalRevenue} est` : ''}
              {(totalCups > 0 || totalMomoPlates > 0 || cigaretteSales > 0) && milkCost > 0 ? ' · ' : ''}
              {milkCost > 0 ? `🥛 ${tally.milkPackets}pkt ₹${milkCost} exp` : ''}
              {totalPayments > 0 ? ` · ₹${totalPayments} collected` : ''}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.ctaBtn, todayReport && styles.ctaBtnDone]}
          onPress={handleStartReport}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaBtnText}>
            {todayReport ? t('tallyReportDoneBtn') : t('tallyStartReportBtn')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>

    {/* Recipe Modal */}
    <Modal visible={!!recipeModal} transparent animationType="slide" onRequestClose={() => setRecipeModal(null)}>
      <View style={recipeModalStyles.overlay}>
        <View style={recipeModalStyles.sheet}>
          <View style={recipeModalStyles.handle} />
          <Text style={recipeModalStyles.title}>{recipeModal?.name}</Text>
          <View style={recipeModalStyles.badge}>
            <Text style={recipeModalStyles.badgeText}>📖 RECIPE</Text>
          </View>
          <ScrollView style={recipeModalStyles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={recipeModalStyles.recipeText}>{recipeModal?.recipe || 'No recipe added yet.'}</Text>
          </ScrollView>
          <TouchableOpacity style={recipeModalStyles.closeBtn} onPress={() => setRecipeModal(null)}>
            <Text style={recipeModalStyles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, overflow: 'hidden',
  },
  headerOrb: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: COLORS.primaryBg, top: -120, right: -60, opacity: 0.5,
  },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.black },
  headerDate: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 2 },
  resetBtn: {
    marginLeft: 'auto' as any, borderWidth: 1, borderColor: COLORS.danger,
    borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 6,
  },
  resetBtnText: { color: COLORS.danger, fontSize: FONT_SIZE.sm, fontWeight: '700' },

  totalsStrip: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  totalItem: { flex: 1, alignItems: 'center', paddingVertical: SPACING.md },
  totalValue: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.primary },
  totalLabel: { fontSize: 10, color: COLORS.muted, fontWeight: '600', letterSpacing: 0.8, marginTop: 2 },
  totalDivider: { width: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.sm },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.muted, letterSpacing: 1.5, marginBottom: 4,
  },
  sectionHint: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginBottom: SPACING.md },

  emptyMenuNote: {
    alignItems: 'center', paddingVertical: SPACING.xxxl,
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  emptyMenuIcon: { fontSize: 36, marginBottom: SPACING.md },
  emptyMenuText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.dark },
  emptyMenuSub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 4 },

  paymentCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm, overflow: 'hidden',
  },
  paymentRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg,
  },
  paymentLabelCol: { flex: 1 },
  paymentMode: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black },
  paymentSub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 2 },
  paymentInputWrap: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm, backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md, minWidth: 110, minHeight: 48,
  },
  rupeeSign: { fontSize: FONT_SIZE.md, color: COLORS.primaryLight, fontWeight: '700', marginRight: 4 },
  paymentInput: { flex: 1, fontSize: FONT_SIZE.lg, color: COLORS.black, fontWeight: '700' },
  paymentDivider: { height: 1, backgroundColor: COLORS.borderLight, marginHorizontal: SPACING.lg },
  mismatchRow: {
    backgroundColor: COLORS.warningBg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.warning,
  },
  mismatchText: { fontSize: FONT_SIZE.sm, color: COLORS.warning, fontWeight: '600' },

  notesInput: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.black, minHeight: 80, lineHeight: 22,
  },

  ctaBar: {
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.md,
  },
  ctaSummary: {
    backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm, alignItems: 'center', marginBottom: SPACING.sm,
  },
  ctaSummaryText: { fontSize: FONT_SIZE.sm, color: COLORS.primaryLight, fontWeight: '600' },
  ctaBtn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.primaryLight,
    shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 6, elevation: 3,
    minHeight: 56,
  },
  ctaBtnDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  ctaBtnText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '800' },
});

const counterStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  itemName: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.black },
  itemPrice: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 2 },
  recipeBtn: {
    backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: COLORS.border,
  },
  recipeBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  subtotalBadge: {
    backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  subtotalText: { fontSize: FONT_SIZE.md, fontWeight: '800', color: COLORS.primary },

  counterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },

  portionBlockSpaced: {
    marginTop: SPACING.lg, paddingTop: SPACING.lg,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  portionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm,
  },
  portionChip: {
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  portionChipActive: { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primary },
  portionChipText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.medium },
  portionChipTextActive: { color: COLORS.primary },
  portionPrice: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.dark },
  portionSubtotal: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginLeft: 'auto' as any },

  counterBtn: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
  },
  decrementBtn: {
    backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.border,
  },
  incrementBtn: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  counterBtnDisabled: { borderColor: COLORS.borderLight },
  counterBtnText: { fontSize: 28, fontWeight: '700', color: COLORS.dark },
  counterBtnTextPlus: { fontSize: 32, fontWeight: '700', color: '#fff' },

  countBox: { flex: 1, alignItems: 'center' },
  countText: { fontSize: 52, fontWeight: '900', color: COLORS.borderLight, letterSpacing: -2 },
  countTextActive: { color: COLORS.black },

  progressBar: {
    height: 4, backgroundColor: COLORS.borderLight, borderRadius: 2, marginTop: SPACING.md, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 2 },
});

const milkStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFBF0', borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, marginBottom: SPACING.md,
    borderWidth: 1.5, borderColor: '#F5C842', ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: '#7A5C00' },
  subtitle: { fontSize: FONT_SIZE.sm, color: '#B8860B', marginTop: 2 },
  infoBadge: {
    backgroundColor: '#FFF3CC', borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderWidth: 1, borderColor: '#F5C842', alignItems: 'center',
  },
  infoBadgeTop: { fontSize: FONT_SIZE.md, fontWeight: '900', color: '#7A5C00' },
  infoBadgeBot: { fontSize: 10, color: '#B8860B', fontWeight: '600', marginTop: 1 },
  decrementBtn: {
    backgroundColor: '#FFF3CC', borderWidth: 2, borderColor: '#F5C842',
  },
  incrementBtn: {
    backgroundColor: '#D4A017',
    shadowColor: '#7A5C00', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  progressBar: {
    height: 4, backgroundColor: '#F5E19A', borderRadius: 2, marginTop: SPACING.md, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#D4A017', borderRadius: 2 },
});

const recipeModalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, paddingBottom: 40, maxHeight: '70%',
  },
  handle: {
    width: 40, height: 4, backgroundColor: COLORS.borderLight,
    borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.lg,
  },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.black, marginBottom: SPACING.sm },
  badge: {
    backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: 4, alignSelf: 'flex-start',
    marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border,
  },
  badgeText: { fontSize: 11, color: COLORS.primaryLight, fontWeight: '700', letterSpacing: 0.5 },
  scroll: { marginBottom: SPACING.lg },
  recipeText: {
    fontSize: FONT_SIZE.md, color: COLORS.dark, lineHeight: 26,
  },
  closeBtn: {
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, paddingVertical: SPACING.md, alignItems: 'center',
  },
  closeBtnText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.medium },
});
