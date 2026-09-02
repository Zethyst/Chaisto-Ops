import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../components/AppAlert';
import { authService } from '../../services/authService';
import { reportService } from '../../services/reportService';
import { User } from '../../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS, PHOTO_CATEGORIES } from '../../constants';
import DateStrip, { recentDates } from '../../components/DateStrip';
import ReportFiguresForm, { emptyFigures, ReportFigures, FigureSection } from '../../components/ReportFiguresForm';
import { haptics } from '../../utils/haptics';

const BACKFILL_DAYS = 14;

export default function BackfillReportScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const dates = useMemo(() => recentDates(BACKFILL_DAYS), []);

  const [staff, setStaff] = useState<User[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(dates[1]?.value ?? dates[0].value);
  const [saving, setSaving] = useState(false);

  // Hosted Cloudinary URLs, keyed by photo category
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  const [form, setForm] = useState<ReportFigures>(emptyFigures());

  useEffect(() => {
    authService.getUsers()
      .then((users) => setStaff(users.filter(u => u.role === 'staff' && u.isActive)))
      .catch(() => showAlert('Error', 'Could not load staff list.'))
      .finally(() => setLoadingStaff(false));
  }, []);

  const set = (section: FigureSection, key: string, value: number) =>
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }));

  const get = (section: FigureSection, key: string) => form[section][key] ?? 0;

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
        <DateStrip value={selectedDate} onChange={setSelectedDate} days={BACKFILL_DAYS} />

        <ReportFiguresForm values={form} onChange={set} />

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

  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },


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
