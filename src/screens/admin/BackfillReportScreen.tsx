import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { showAlert } from '../../components/AppAlert';
import { authService } from '../../services/authService';
import { reportService } from '../../services/reportService';
import { User } from '../../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS, PHOTO_CATEGORIES } from '../../constants';
import { haptics } from '../../utils/haptics';

const BACKFILL_DAYS = 14;

/** The last N days, newest first, excluding today's date at index 0's label. */
function recentDates(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return {
      value: d.toISOString().split('T')[0],
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      isToday: i === 0,
    };
  });
}

type Section = 'openingStock' | 'purchases' | 'sales' | 'payments' | 'closingStock';

export default function BackfillReportScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { milkMlPerPacket, momoPiecesPerPlate } = useSelector((s: RootState) => s.menu);
  const milkPacketsPerLitre = milkMlPerPacket > 0 ? 1000 / milkMlPerPacket : 2;
  const piecesPerPlate = momoPiecesPerPlate > 0 ? momoPiecesPerPlate : 1;

  const dates = useMemo(() => recentDates(BACKFILL_DAYS), []);

  const [staff, setStaff] = useState<User[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(dates[1]?.value ?? dates[0].value);
  const [saving, setSaving] = useState(false);

  // Hosted Cloudinary URLs, keyed by photo category
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  const [form, setForm] = useState<Record<Section, Record<string, number>>>({
    openingStock: {},
    purchases: {},
    sales: {},
    payments: {},
    closingStock: {},
  });

  useEffect(() => {
    authService.getUsers()
      .then((users) => setStaff(users.filter(u => u.role === 'staff' && u.isActive)))
      .catch(() => showAlert('Error', 'Could not load staff list.'))
      .finally(() => setLoadingStaff(false));
  }, []);

  const set = (section: Section, key: string, value: number) =>
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }));

  const get = (section: Section, key: string) => form[section][key] ?? 0;

  const totalCups = get('sales', 'regularCups') + get('sales', 'specialCups') + get('sales', 'kulhadCups');
  const collected = get('payments', 'upi') + get('payments', 'cash');

  const pickPhoto = async (category: string) => {
    if (!selectedStaff) {
      showAlert('Pick a staff member first', 'Photos are filed against a staff member and stall.');
      return;
    }
    haptics.light();
    try {
      // Gallery, not camera — a photo for a past day was taken before now.
      // Staff submissions still block the gallery; this path is admin-only.
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.7,
        maxWidth: 1600,
        maxHeight: 1600,
        selectionLimit: 1,
      });

      if (result.didCancel) return;
      if (result.errorCode) {
        showAlert('Could Not Open Gallery', result.errorMessage || 'Check photo permissions in Settings.');
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      setUploading(category);
      const url = await reportService.uploadPhoto(
        asset.uri,
        category,
        selectedStaff.stallName || 'Chaisto',
        { date: selectedDate, source: 'gallery' },
      );
      setPhotos(prev => ({ ...prev, [category]: url }));
      haptics.success();
    } catch (err: any) {
      haptics.error();
      showAlert('Upload Failed', err.message || 'Could not upload the photo. Check your connection.');
    } finally {
      setUploading(null);
    }
  };

  const handleSave = () => {
    if (!selectedStaff) {
      showAlert('Pick a staff member', 'Choose whose report you are entering.');
      return;
    }
    if (!selectedStaff.stallId) {
      showAlert('No stall assigned', `${selectedStaff.name} is not assigned to a stall, so the report has nowhere to go.`);
      return;
    }
    if (collected === 0 && totalCups === 0) {
      showAlert('Nothing entered', 'Enter at least the sales or the cash collected for that day.');
      return;
    }

    const dateLabel = dates.find(d => d.value === selectedDate)?.label ?? selectedDate;
    const photoCount = Object.values(photos).filter(Boolean).length;
    haptics.heavy();
    showAlert({
      title: 'File this report?',
      message: `${selectedStaff.name} · ${dateLabel}\n₹${collected} collected · ${totalCups} cups · ${photoCount} photo${photoCount === 1 ? '' : 's'}\n\nIt will be recorded as entered by you.`,
      type: 'confirm',
      buttons: [
        {
          text: 'File Report',
          onPress: async () => {
            setSaving(true);
            try {
              await reportService.backfillReport({
                staffId: selectedStaff.id,
                stallId: selectedStaff.stallId!,
                date: selectedDate,
                openingStock: form.openingStock as any,
                purchases: form.purchases as any,
                sales: form.sales as any,
                payments: form.payments as any,
                closingStock: form.closingStock as any,
                photos: photos as any,
              });
              haptics.success();
              showAlert('Report Filed', `${selectedStaff.name}'s report for ${dateLabel} is now on record.`, [
                { text: 'Done', onPress: () => navigation.goBack() },
              ]);
            } catch (err: any) {
              haptics.error();
              showAlert('Could Not File', err.response?.data?.error || 'Something went wrong. Try again.');
            } finally {
              setSaving(false);
            }
          },
        },
        { text: 'Review', style: 'cancel' },
      ],
    });
  };

  // A render helper, deliberately not a component — a component declared inside
  // the screen would be a new type on every render, remounting each input and
  // dropping keyboard focus mid-entry.
  const field = (section: Section, name: string, label: string, unit: string, factor?: number) => (
    <NumField
      key={`${section}.${name}`}
      label={label}
      unit={unit}
      value={factor ? get(section, name) * factor : get(section, name)}
      onChange={(v) => set(section, name, factor ? v / factor : v)}
    />
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}>
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>🗓</Text>
          <Text style={styles.bannerText}>
            For days a staff member never filed a report. There is no GPS for a past day, and any
            photos come from the gallery rather than a live capture — the report is stamped with
            your name so it reads as entered after the fact.
          </Text>
        </View>

        {/* Staff */}
        <Text style={styles.sectionTitle}>STAFF MEMBER</Text>
        {loadingStaff ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.lg }} />
        ) : staff.length === 0 ? (
          <Text style={styles.empty}>No active staff found.</Text>
        ) : (
          <View style={styles.chipWrap}>
            {staff.map((u) => {
              const active = selectedStaff?.id === u.id;
              return (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => { haptics.selection(); setSelectedStaff(u); }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{u.name}</Text>
                  {!!u.stallName && (
                    <Text style={[styles.chipSub, active && styles.chipSubActive]}>{u.stallName}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Date */}
        <Text style={styles.sectionTitle}>DATE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateStrip}>
          {dates.map((d) => {
            const active = selectedDate === d.value;
            return (
              <TouchableOpacity
                key={d.value}
                style={[styles.dateChip, active && styles.dateChipActive]}
                onPress={() => { haptics.selection(); setSelectedDate(d.value); }}
              >
                <Text style={[styles.dateWeekday, active && styles.dateTextActive]}>
                  {d.isToday ? 'Today' : d.weekday}
                </Text>
                <Text style={[styles.dateLabel, active && styles.dateTextActive]}>{d.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sales */}
        <Text style={styles.sectionTitle}>SALES</Text>
        <View style={styles.card}>
          {field("sales", "regularCups", "Regular chai", "cups")}
          {field("sales", "specialCups", "Special chai", "cups")}
          {field("sales", "kulhadCups", "Kulhad chai", "cups")}
          {field("sales", "vegMomoPackets", "Veg momos", "pieces", piecesPerPlate)}
          {field("sales", "paneerMomoPackets", "Paneer momos", "pieces", piecesPerPlate)}
          {field("sales", "snacks", "Snacks sold", "₹")}
          {field("sales", "cigarettes", "Cigarettes sold", "₹")}
        </View>

        {/* Payments */}
        <Text style={styles.sectionTitle}>PAYMENTS COLLECTED</Text>
        <View style={styles.card}>
          {field("payments", "upi", "UPI", "₹")}
          {field("payments", "cash", "Cash", "₹")}
        </View>

        {/* Stock */}
        <Text style={styles.sectionTitle}>OPENING STOCK</Text>
        <View style={styles.card}>
          {field("openingStock", "milk", "Milk", "packets", milkPacketsPerLitre)}
          {field("openingStock", "cups", "Paper cups", "count")}
          {field("openingStock", "kulhadCups", "Kulhad cups", "count")}
          {field("openingStock", "vegMomoPackets", "Veg momos", "pieces", piecesPerPlate)}
          {field("openingStock", "paneerMomoPackets", "Paneer momos", "pieces", piecesPerPlate)}
        </View>

        <Text style={styles.sectionTitle}>PURCHASES</Text>
        <View style={styles.card}>
          {field("purchases", "milk", "Milk purchased", "packets", milkPacketsPerLitre)}
          {field("purchases", "vegMomoPackets", "Veg momos purchased", "pieces", piecesPerPlate)}
          {field("purchases", "paneerMomoPackets", "Paneer momos purchased", "pieces", piecesPerPlate)}
          {field("purchases", "snacks", "Snacks purchased", "₹")}
          {field("purchases", "cigarettes", "Cigarettes purchased", "₹")}
        </View>

        {/* Photos — optional, uploaded from the gallery since the day has passed */}
        <Text style={styles.sectionTitle}>PHOTOS (OPTIONAL)</Text>
        <View style={styles.card}>
          <Text style={styles.photoNote}>
            Pick from the gallery if you have that day's photos — from the staff member over
            WhatsApp, or your own. Leave blank if none exist.
          </Text>
          {PHOTO_CATEGORIES.map((cat) => {
            const url = photos[cat.key];
            const busy = uploading === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[styles.photoRow, !!url && styles.photoRowDone]}
                onPress={() => pickPhoto(cat.key)}
                disabled={busy}
                activeOpacity={0.8}
              >
                {url ? (
                  <Image source={{ uri: url }} style={styles.photoThumb} resizeMode="cover" />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    {busy
                      ? <ActivityIndicator size="small" color={COLORS.primary} />
                      : <Text style={{ fontSize: 18 }}>🖼</Text>}
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.photoLabel}>{cat.label}</Text>
                  <Text style={styles.photoSub}>
                    {busy ? 'Uploading…' : url ? 'Uploaded · tap to replace' : 'Tap to choose from gallery'}
                  </Text>
                </View>
                {!!url && <Text style={styles.photoTick}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>CLOSING STOCK</Text>
        <View style={styles.card}>
          {field("closingStock", "milk", "Milk remaining", "packets", milkPacketsPerLitre)}
          {field("closingStock", "cups", "Paper cups remaining", "count")}
          {field("closingStock", "kulhadCups", "Kulhad cups remaining", "count")}
          {field("closingStock", "vegMomoPackets", "Veg momos remaining", "pieces", piecesPerPlate)}
          {field("closingStock", "paneerMomoPackets", "Paneer momos remaining", "pieces", piecesPerPlate)}
        </View>
      </ScrollView>

      {/* Sticky action */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <View style={styles.footerSummary}>
          <Text style={styles.footerSummaryText}>
            {selectedStaff ? selectedStaff.name : 'No staff selected'}
            {' · '}
            {dates.find(d => d.value === selectedDate)?.label}
            {collected > 0 ? ` · ₹${collected}` : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, (saving || !selectedStaff) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || !selectedStaff}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>File Report</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Kept outside the screen so re-rendering the form does not remount inputs. */
function NumField({ label, value, onChange, unit }: {
  label: string; value: number; onChange: (v: number) => void; unit: string;
}) {
  const [raw, setRaw] = useState(value === 0 ? '' : String(value));

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={raw}
          onChangeText={(t) => {
            setRaw(t);
            const n = parseFloat(t);
            onChange(isNaN(n) ? 0 : n);
          }}
          placeholder="0"
          placeholderTextColor={COLORS.muted}
        />
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: SPACING.xl },

  banner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.border,
  },
  bannerIcon: { fontSize: 16, marginTop: 1 },
  bannerText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.primaryLight, lineHeight: 20 },

  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: COLORS.muted, letterSpacing: 1.5,
    marginBottom: SPACING.md, marginTop: SPACING.lg,
  },
  empty: { fontSize: FONT_SIZE.sm, color: COLORS.muted, paddingVertical: SPACING.md },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.dark },
  chipTextActive: { color: '#fff' },
  chipSub: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  chipSubActive: { color: 'rgba(255,255,255,0.8)' },

  dateStrip: { flexGrow: 0 },
  dateChip: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border, marginRight: SPACING.sm,
    alignItems: 'center', minWidth: 64,
  },
  dateChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dateWeekday: { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  dateLabel: { fontSize: FONT_SIZE.md, fontWeight: '800', color: COLORS.black, marginTop: 1 },
  dateTextActive: { color: '#fff' },

  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },

  field: { marginBottom: SPACING.md },
  fieldLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.dark, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md, minHeight: 48,
  },
  input: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.black, fontWeight: '600' },
  unit: { fontSize: FONT_SIZE.sm, color: COLORS.primaryLight, fontWeight: '700' },

  photoNote: { fontSize: FONT_SIZE.sm, color: COLORS.muted, lineHeight: 20, marginBottom: SPACING.md },
  photoRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm, marginBottom: SPACING.sm, backgroundColor: COLORS.surface,
  },
  photoRowDone: { borderColor: COLORS.success, backgroundColor: COLORS.successBg },
  photoThumb: { width: 44, height: 44, borderRadius: BORDER_RADIUS.sm },
  photoPlaceholder: {
    width: 44, height: 44, borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center',
  },
  photoLabel: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black },
  photoSub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 1 },
  photoTick: { fontSize: 18, color: COLORS.success, fontWeight: '800', marginRight: SPACING.sm },

  footer: {
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.md,
  },
  footerSummary: {
    backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm, alignItems: 'center', marginBottom: SPACING.sm,
  },
  footerSummaryText: { fontSize: FONT_SIZE.sm, color: COLORS.primaryLight, fontWeight: '600' },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg, alignItems: 'center', minHeight: 56, justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '800' },
});
