import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput,  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../components/AppAlert';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import {
  updateDraftSection, setStep, submitDailyReport,
} from '../../store/slices/reportSlice';
import { useDraftAutosave } from './useDraftAutosave';

import { deviceService } from '../../services/deviceService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS, REPORT_STEPS, PHOTO_CATEGORIES, REQUIRED_PHOTO_CATEGORIES } from '../../constants';
import { ITEM_KEY_TO_SALES_FIELD, MOMO_ITEM_KEYS, pricePerStockUnit } from '../../store/slices/menuSlice';
import { useSupplyUnits } from './useSupplyUnits';
import { DailyReport } from '../../types';
import { haptics } from '../../utils/haptics';

const STEP_ICONS = ['📦', '🛒', '☕', '💳', '📊', '📸', '✓'];

export default function DailyReportScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { currentDraft, currentStep, isSubmitting, draftSaveState } = useSelector((s: RootState) => s.reports);
  const dispatch = useDispatch<AppDispatch>();

  // Every field value and photo URL is saved to the server as it is entered
  useDraftAutosave();

  const handleNext = () => {
    haptics.light();
    if (currentStep < REPORT_STEPS.length - 1) dispatch(setStep(currentStep + 1));
  };

  const handleBack = () => {
    haptics.selection();
    if (currentStep > 0) dispatch(setStep(currentStep - 1));
    else {
      showAlert('Exit Report', 'Your progress is saved as draft. Exit?', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Exit', onPress: () => { navigation.goBack(); } },
      ]);
    }
  };

  const handleSubmit = async () => {
    const photos = currentDraft?.photos as any;
    const missingPhotos = REQUIRED_PHOTO_CATEGORIES.filter((c) => !photos?.[c.key]);
    if (missingPhotos.length > 0) {
      showAlert('Missing Photos', `Please capture: ${missingPhotos.map(p => p.label).join(', ')}`);
      return;
    }

    let location = { latitude: 0, longitude: 0 };
    try {
      location = await deviceService.getCurrentLocation();
    } catch {
      showAlert('Location Error', 'Could not get GPS location. Report will be flagged.');
    }

    const report: DailyReport = {
      ...currentDraft as DailyReport,
      submittedAt: new Date().toISOString(),
      location,
      status: 'submitted',
    };

    haptics.heavy();
    showAlert(
      'Submit Report',
      'Once submitted, you cannot edit this report. Continue?',
      [
        { text: 'Review', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            haptics.success();
            await dispatch(submitDailyReport(report));
            navigation.replace('StaffDashboard');
          },
        },
      ]
    );
  };

  if (!currentDraft) return null;

  const progress = ((currentStep + 1) / REPORT_STEPS.length) * 100;
  const capturedPhotos = (currentDraft.photos as any) || {};
  const allPhotosCaptured = REQUIRED_PHOTO_CATEGORIES.every((c) => !!capturedPhotos[c.key]);
  const isNextDisabled = currentStep === 5 && !allPhotosCaptured;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Progress Header */}
      <View style={[styles.progressHeader, { paddingTop: insets.top + SPACING.md }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.progressInfo}>
          <Text style={styles.stepLabel}>Step {currentStep + 1} of {REPORT_STEPS.length}</Text>
          <Text style={styles.stepName}>{STEP_ICONS[currentStep]} {REPORT_STEPS[currentStep]}</Text>
        </View>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>{currentStep + 1}/{REPORT_STEPS.length}</Text>
        </View>
      </View>

      {/* Autosave status */}
      <View style={styles.saveStatusBar}>
        <Text style={[styles.saveStatusText, draftSaveState === 'error' && styles.saveStatusError]}>
          {draftSaveState === 'saving' ? '⏳  Saving…'
            : draftSaveState === 'error' ? '⚠️  Saved on this phone only — will retry'
            : draftSaveState === 'saved' ? '✅  Saved — you can finish this later'
            : '📝  Entries save automatically as you go'}
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
      </View>

      {/* Step Dots */}
      <View style={styles.stepDots}>
        {REPORT_STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < currentStep && styles.dotDone,
              i === currentStep && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* Step Content */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {currentStep === 0 && <OpeningStockStep draft={currentDraft} dispatch={dispatch} />}
        {currentStep === 1 && <PurchasesStep draft={currentDraft} dispatch={dispatch} />}
        {currentStep === 2 && <SalesStep draft={currentDraft} dispatch={dispatch} />}
        {currentStep === 3 && <PaymentsStep draft={currentDraft} dispatch={dispatch} />}
        {currentStep === 4 && <ClosingStockStep draft={currentDraft} dispatch={dispatch} />}
        {currentStep === 5 && <PhotosStep draft={currentDraft} navigation={navigation} />}
        {currentStep === 6 && <ReviewStep draft={currentDraft} />}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {currentStep < REPORT_STEPS.length - 1 ? (
          <>
            <TouchableOpacity
              style={[styles.nextBtn, isNextDisabled && styles.nextBtnDisabled]}
              onPress={handleNext}
              disabled={isNextDisabled}
            >
              <Text style={styles.nextBtnText}>Continue →</Text>
            </TouchableOpacity>
            {isNextDisabled && (
              <Text style={styles.photoLockHint}>Capture all {REQUIRED_PHOTO_CATEGORIES.length} required photos to continue</Text>
            )}
          </>
        ) : (
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextBtnText}>✓ Submit Report</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Step Components ──────────────────────────────────────────────────────────

function NumberField({ label, value, onChange, unit, hint }: any) {
  const [raw, setRaw] = React.useState<string>(value === 0 ? '' : String(value));

  React.useEffect(() => {
    const parsed = parseFloat(raw);
    if (isNaN(parsed) || parsed !== value) {
      setRaw(value === 0 ? '' : String(value));
    }
  }, [value]);

  const handleChange = (t: string) => {
    setRaw(t);
    const num = parseFloat(t);
    if (!isNaN(num)) onChange(num);
    else if (t === '' || t === '.') onChange(0);
  };

  return (
    <View style={stepStyles.field}>
      <Text style={stepStyles.fieldLabel}>{label}</Text>
      {hint && <Text style={stepStyles.fieldHint}>{hint}</Text>}
      <View style={stepStyles.inputRow}>
        <TextInput
          style={stepStyles.input}
          keyboardType="decimal-pad"
          value={raw}
          onChangeText={handleChange}
          placeholder="0"
          placeholderTextColor={COLORS.muted}
        />
        <Text style={stepStyles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

// Entry field whose displayed unit differs from the stored unit — milk is
// stored in litres but counted in packets, momos are stored in plate-
// equivalents but counted in pieces.
function ScaledNumberField({ label, value, onChange, factor, unit, hint }: any) {
  const toDisplay = (stored: number) => Math.round((stored || 0) * factor * 100) / 100;
  const toStored = (displayed: number) => Math.round((displayed / factor) * 10000) / 10000;

  return (
    <NumberField
      label={label}
      value={toDisplay(value)}
      onChange={(v: number) => onChange(toStored(v))}
      unit={unit}
      hint={hint}
    />
  );
}

function StepCard({ title, children }: any) {
  return (
    <View style={stepStyles.card}>
      <Text style={stepStyles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function OpeningStockStep({ draft, dispatch }: any) {
  const s = draft.openingStock || {};
  const { milkPacketsPerLitre, momoPiecesPerPlateFactor, milkMlPerPacket } = useSupplyUnits();
  const update = (key: string, val: number) =>
    dispatch(updateDraftSection({ section: 'openingStock', data: { ...s, [key]: val } }));
  return (
    <StepCard title="📦 Opening Stock">
      <ScaledNumberField
        label="Milk"
        value={s.milk}
        onChange={(v: number) => update('milk', v)}
        factor={milkPacketsPerLitre}
        unit="packets"
        hint={`Count packets before starting · ${milkMlPerPacket}ml each`}
      />
      <NumberField label="Paper cups" value={s.cups} onChange={(v: number) => update('cups', v)} unit="count" />
      <NumberField label="Kulhad cups" value={s.kulhadCups} onChange={(v: number) => update('kulhadCups', v)} unit="count" />
      <ScaledNumberField
        label="Veg momos"
        value={s.vegMomoPackets}
        onChange={(v: number) => update('vegMomoPackets', v)}
        factor={momoPiecesPerPlateFactor}
        unit="pieces"
      />
      <ScaledNumberField
        label="Paneer momos"
        value={s.paneerMomoPackets}
        onChange={(v: number) => update('paneerMomoPackets', v)}
        factor={momoPiecesPerPlateFactor}
        unit="pieces"
      />
    </StepCard>
  );
}

function PurchasesStep({ draft, dispatch }: any) {
  const p = draft.purchases || {};
  const { milkPacketsPerLitre, momoPiecesPerPlateFactor, milkMlPerPacket } = useSupplyUnits();
  const update = (key: string, val: number) =>
    dispatch(updateDraftSection({ section: 'purchases', data: { ...p, [key]: val } }));
  return (
    <StepCard title="🛒 Purchases Today">
      <ScaledNumberField
        label="Milk purchased"
        value={p.milk}
        onChange={(v: number) => update('milk', v)}
        factor={milkPacketsPerLitre}
        unit="packets"
        hint={`Leave 0 if none · ${milkMlPerPacket}ml each`}
      />
      <ScaledNumberField
        label="Veg momos purchased"
        value={p.vegMomoPackets}
        onChange={(v: number) => update('vegMomoPackets', v)}
        factor={momoPiecesPerPlateFactor}
        unit="pieces"
        hint="Leave 0 if none"
      />
      <ScaledNumberField
        label="Paneer momos purchased"
        value={p.paneerMomoPackets}
        onChange={(v: number) => update('paneerMomoPackets', v)}
        factor={momoPiecesPerPlateFactor}
        unit="pieces"
        hint="Leave 0 if none"
      />
      <NumberField label="Snacks purchased" value={p.snacks} onChange={(v: number) => update('snacks', v)} unit="₹" hint="Total cost of snacks bought" />
      <NumberField label="Cigarettes purchased" value={p.cigarettes} onChange={(v: number) => update('cigarettes', v)} unit="₹" hint="Total cost of cigarette stock bought" />
    </StepCard>
  );
}

function SalesStep({ draft, dispatch }: any) {
  const s = draft.sales || {};
  const menuItems = useSelector((state: RootState) => state.menu.items);
  const { momoPiecesPerPlateFactor } = useSupplyUnits();
  const activeItems = menuItems.filter(i => i.active).sort((a, b) => a.sortOrder - b.sortOrder);

  const update = (key: string, val: number) =>
    dispatch(updateDraftSection({ section: 'sales', data: { ...s, [key]: val } }));

  // Sales are recorded in stock units (cups / packets), so plate-served items
  // are valued at their full-plate rate.
  const estimatedRevenue = activeItems.reduce((sum, item) => {
    const field = ITEM_KEY_TO_SALES_FIELD[item.key];
    const count = field ? (s[field] || 0) : 0;
    return sum + count * pricePerStockUnit(item);
  }, 0);

  const priceLine = activeItems
    .map(i => (i.portions?.length
      ? `${i.name.toLowerCase()} ${i.portions.map(p => `${p.name.toLowerCase()} ₹${p.price}`).join(' / ')}`
      : `₹${i.price} ${i.name.toLowerCase()}`))
    .join(' · ');

  return (
    <StepCard title="☕ Sales Entry">
      {activeItems.map((item) => {
        const field = ITEM_KEY_TO_SALES_FIELD[item.key] || item.key;
        if (MOMO_ITEM_KEYS.includes(item.key)) {
          return (
            <ScaledNumberField
              key={item.key}
              label={item.name}
              value={s[field] || 0}
              onChange={(v: number) => update(field, v)}
              factor={momoPiecesPerPlateFactor}
              unit="pieces"
              hint={`Total pieces sold · 1 full plate = ${momoPiecesPerPlateFactor} pieces`}
            />
          );
        }
        return (
          <NumberField
            key={item.key}
            label={item.name}
            value={s[field] || 0}
            onChange={(v: number) => update(field, v)}
            unit="cups"
          />
        );
      })}
      <NumberField label="Snacks sold" value={s.snacks} onChange={(v: number) => update('snacks', v)} unit="₹" hint="Total snack sales in ₹" />
      <NumberField label="Cigarettes sold" value={s.cigarettes} onChange={(v: number) => update('cigarettes', v)} unit="₹" hint="Total cigarette sales in ₹" />
      <View style={stepStyles.estimate}>
        <Text style={stepStyles.estimateLabel}>Estimated revenue from cups</Text>
        <Text style={stepStyles.estimateValue}>₹{Math.round(estimatedRevenue)}</Text>
        <Text style={stepStyles.estimateSub}>{priceLine}</Text>
      </View>
    </StepCard>
  );
}

function PaymentsStep({ draft, dispatch }: any) {
  const p = draft.payments || {};
  const update = (key: string, val: number) =>
    dispatch(updateDraftSection({ section: 'payments', data: { ...p, [key]: val } }));
  const total = (p.upi || 0) + (p.cash || 0);
  const upiPct = total > 0 ? Math.round(((p.upi || 0) / total) * 100) : 0;

  return (
    <StepCard title="💳 Payment Entry">
      <NumberField label="UPI amount received" value={p.upi} onChange={(v: number) => update('upi', v)} unit="₹" hint="From PhonePe, GPay, Paytm etc." />
      <NumberField label="Cash amount received" value={p.cash} onChange={(v: number) => update('cash', v)} unit="₹" />
      <View style={stepStyles.paymentSummary}>
        <View style={stepStyles.payRow}>
          <Text style={stepStyles.payLabel}>Total collected</Text>
          <Text style={[stepStyles.payValue, { color: COLORS.primary }]}>₹{total}</Text>
        </View>
        <View style={stepStyles.payRow}>
          <Text style={stepStyles.payLabel}>UPI ratio</Text>
          <Text style={[stepStyles.payValue, { color: upiPct < 20 ? COLORS.danger : COLORS.success }]}>
            {upiPct}%
          </Text>
        </View>
        {draft.computed?.totalRevenue > 0 && Math.abs(total - draft.computed.totalRevenue) > 50 && (
          <View style={stepStyles.mismatchAlert}>
            <Text style={stepStyles.mismatchText}>
              ⚠️ Collected ₹{total} vs expected ₹{draft.computed.totalRevenue} — check entries
            </Text>
          </View>
        )}
      </View>
    </StepCard>
  );
}

function ClosingStockStep({ draft, dispatch }: any) {
  const s = draft.closingStock || {};
  const { milkPacketsPerLitre, momoPiecesPerPlateFactor } = useSupplyUnits();
  const update = (key: string, val: number) =>
    dispatch(updateDraftSection({ section: 'closingStock', data: { ...s, [key]: val } }));
  return (
    <StepCard title="📊 Closing Stock">
      <Text style={stepStyles.note}>Count remaining stock carefully — this is verified against opening stock.</Text>
      <ScaledNumberField
        label="Milk remaining"
        value={s.milk}
        onChange={(v: number) => update('milk', v)}
        factor={milkPacketsPerLitre}
        unit="packets"
      />
      <NumberField label="Paper cups remaining" value={s.cups} onChange={(v: number) => update('cups', v)} unit="count" />
      <NumberField label="Kulhad cups remaining" value={s.kulhadCups} onChange={(v: number) => update('kulhadCups', v)} unit="count" />
      <ScaledNumberField
        label="Veg momos remaining"
        value={s.vegMomoPackets}
        onChange={(v: number) => update('vegMomoPackets', v)}
        factor={momoPiecesPerPlateFactor}
        unit="pieces"
      />
      <ScaledNumberField
        label="Paneer momos remaining"
        value={s.paneerMomoPackets}
        onChange={(v: number) => update('paneerMomoPackets', v)}
        factor={momoPiecesPerPlateFactor}
        unit="pieces"
      />
    </StepCard>
  );
}

function PhotosStep({ draft, navigation }: any) {
  const photos = draft.photos || {};
  return (
    <View>
      <Text style={stepStyles.photosTitle}>📸 Photos</Text>
      <Text style={stepStyles.photosNote}>
        You must capture the {REQUIRED_PHOTO_CATEGORIES.length} required photos using the camera below. Gallery uploads are disabled.
      </Text>
      {PHOTO_CATEGORIES.map((cat) => {
        const captured = !!photos[cat.key];
        return (
          <TouchableOpacity
            key={cat.key}
            style={[stepStyles.photoRow, captured && stepStyles.photoCaptured]}
            onPress={() => navigation.navigate('CameraCapture', { category: cat.key })}
          >
            <View style={[stepStyles.photoStatus, { backgroundColor: captured ? COLORS.successBg : COLORS.primaryBg }]}>
              <Text style={{ fontSize: 20 }}>{captured ? '✅' : '📷'}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={stepStyles.photoLabel}>{cat.label}</Text>
              <Text style={stepStyles.photoSub}>{captured ? 'Captured' : 'Tap to capture'}</Text>
            </View>
            {!captured && (
              <Text style={cat.required ? stepStyles.required : stepStyles.optional}>
                {cat.required ? 'Required' : 'Optional'}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ReviewStep({ draft }: any) {
  const cups = (draft.sales?.regularCups || 0) + (draft.sales?.specialCups || 0) + (draft.sales?.kulhadCups || 0);
  const momoPlates = (draft.sales?.vegMomoPackets || 0) + (draft.sales?.paneerMomoPackets || 0);
  const revenue = (draft.payments?.upi || 0) + (draft.payments?.cash || 0);
  const flags = draft.flags || [];
  const { milkPacketsPerLitre, momoPiecesPerPlateFactor } = useSupplyUnits();
  const capturedPhotos = REQUIRED_PHOTO_CATEGORIES.filter(c => !!(draft.photos || {})[c.key]).length;

  return (
    <View>
      <Text style={stepStyles.reviewTitle}>Review & Submit</Text>
      {flags.length > 0 && (
        <View style={stepStyles.flagsBox}>
          <Text style={stepStyles.flagsTitle}>⚠️ {flags.length} system alert(s)</Text>
          {flags.map((f: any, i: number) => (
            <Text key={i} style={stepStyles.flagItem}>• {f.message}</Text>
          ))}
          <Text style={stepStyles.flagsNote}>These will be reviewed by admin. If correct, submit anyway.</Text>
        </View>
      )}
      <View style={stepStyles.reviewCard}>
        <ReviewRow label="Cups sold" value={`${cups} cups`} />
        <ReviewRow label="Momos sold" value={`${Math.round(momoPlates * momoPiecesPerPlateFactor)} pieces`} />
        <ReviewRow label="Cigarettes sold" value={`₹${draft.sales?.cigarettes || 0}`} />
        <ReviewRow label="Total revenue" value={`₹${revenue}`} />
        <ReviewRow label="UPI" value={`₹${draft.payments?.upi || 0}`} />
        <ReviewRow label="Cash" value={`₹${draft.payments?.cash || 0}`} />
        <ReviewRow
          label="Milk used"
          value={`${((draft.computed?.milkUsed || 0) * milkPacketsPerLitre).toFixed(1)} packets`}
        />
        <ReviewRow label="Photos" value={`${capturedPhotos}/${REQUIRED_PHOTO_CATEGORIES.length} required`} />
      </View>
      <View style={stepStyles.lockNote}>
        <Text style={stepStyles.lockText}>🔒 Report is locked after submission. Ensure all entries are correct.</Text>
      </View>
    </View>
  );
}

function ReviewRow({ label, value }: any) {
  return (
    <View style={stepStyles.reviewRow}>
      <Text style={stepStyles.reviewLabel}>{label}</Text>
      <Text style={stepStyles.reviewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  progressHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { paddingRight: SPACING.md },
  backText: { color: COLORS.primaryLight, fontSize: FONT_SIZE.md, fontWeight: '700' },
  progressInfo: { flex: 1 },
  stepLabel: { fontSize: 11, color: COLORS.muted, fontWeight: '500' },
  stepName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black },
  stepBadge: {
    backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.border,
  },
  stepBadgeText: { fontSize: FONT_SIZE.sm, color: COLORS.primaryLight, fontWeight: '700' },

  saveStatusBar: {
    backgroundColor: COLORS.white, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm,
  },
  saveStatusText: { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  saveStatusError: { color: COLORS.warning },

  progressTrack: { height: 4, backgroundColor: COLORS.borderLight },
  progressFill: { height: '100%', backgroundColor: COLORS.primary },

  stepDots: {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    paddingVertical: SPACING.sm, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.borderLight },
  dotDone: { backgroundColor: COLORS.success },
  dotActive: { backgroundColor: COLORS.primary, width: 20, borderRadius: 4 },

  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.xl, paddingBottom: SPACING.xxxl },

  footer: {
    padding: SPACING.xl, backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  nextBtn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.primaryLight,
    shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  submitBtn: {
    backgroundColor: COLORS.success, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.success,
    shadowColor: COLORS.success, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  nextBtnText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '700' },
  nextBtnDisabled: { opacity: 0.4, backgroundColor: COLORS.medium },
  photoLockHint: { textAlign: 'center', marginTop: SPACING.sm, fontSize: FONT_SIZE.sm, color: COLORS.danger, fontWeight: '600' },
});

const stepStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl, ...SHADOWS.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.black, marginBottom: SPACING.lg },
  field: { marginBottom: SPACING.lg },
  fieldLabel: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.dark, marginBottom: 4 },
  fieldHint: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm, backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md,
    minHeight: 52,
  },
  input: { flex: 1, fontSize: FONT_SIZE.lg, color: COLORS.black, fontWeight: '600', paddingVertical: SPACING.md },
  unit: { fontSize: FONT_SIZE.md, color: COLORS.primaryLight, fontWeight: '600', marginLeft: SPACING.sm },

  estimate: {
    backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
    marginTop: SPACING.sm, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  estimateLabel: { fontSize: FONT_SIZE.sm, color: COLORS.medium },
  estimateValue: { fontSize: FONT_SIZE.xxxl, fontWeight: '800', color: COLORS.primary, marginVertical: 4 },
  estimateSub: { fontSize: 11, color: COLORS.muted },

  note: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginBottom: SPACING.lg, lineHeight: 20 },

  paymentSummary: {
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
    marginTop: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  payLabel: { fontSize: FONT_SIZE.md, color: COLORS.medium },
  payValue: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black },
  mismatchAlert: { backgroundColor: COLORS.warningBg, borderRadius: BORDER_RADIUS.sm, padding: SPACING.md, marginTop: SPACING.sm },
  mismatchText: { fontSize: FONT_SIZE.sm, color: COLORS.warning, fontWeight: '600' },

  photosTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.black, marginBottom: SPACING.sm },
  photosNote: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginBottom: SPACING.lg, lineHeight: 20 },
  photoRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  photoCaptured: { borderColor: COLORS.success },
  photoStatus: { width: 48, height: 48, borderRadius: BORDER_RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  photoLabel: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.black },
  photoSub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 2 },
  required: { fontSize: 11, color: COLORS.danger, fontWeight: '700', letterSpacing: 0.5 },
  optional: { fontSize: 11, color: COLORS.muted, fontWeight: '700', letterSpacing: 0.5 },

  reviewTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.black, marginBottom: SPACING.lg },
  flagsBox: {
    backgroundColor: COLORS.warningBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg, marginBottom: SPACING.lg, borderLeftWidth: 3, borderLeftColor: COLORS.warning,
  },
  flagsTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.warning, marginBottom: SPACING.sm },
  flagItem: { fontSize: FONT_SIZE.sm, color: COLORS.dark, marginBottom: 4 },
  flagsNote: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: SPACING.sm },

  reviewCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border,
  },
  reviewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  reviewLabel: { fontSize: FONT_SIZE.md, color: COLORS.medium },
  reviewValue: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primaryLight },

  lockNote: {
    backgroundColor: COLORS.dangerBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg, marginTop: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.danger,
  },
  lockText: { fontSize: FONT_SIZE.sm, color: COLORS.danger, fontWeight: '600', lineHeight: 20 },
});
