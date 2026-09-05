import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../components/AppAlert';
import { reportService } from '../../services/reportService';
import { DailyReport } from '../../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS, PHOTO_CATEGORIES } from '../../constants';
import { haptics } from '../../utils/haptics';
import { apiErrorMessage } from '../../utils/apiError';
import ReportFiguresForm, {
  emptyFigures, figuresFrom, changedFigureFields, ReportFigures, FigureSection,
} from '../../components/ReportFiguresForm';

/**
 * An unfinished report — one a staff member started and never submitted. The
 * admin can correct the figures (the staff member then picks the draft up with
 * the corrected numbers) or file it as a report when it is clear nobody is
 * coming back to finish it.
 */
export default function EditDraftScreen({ route, navigation }: any) {
  const { draftId } = route.params;
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState<DailyReport | null>(null);
  const [original, setOriginal] = useState<ReportFigures>(emptyFigures());
  const [form, setForm] = useState<ReportFigures>(emptyFigures());
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filing, setFiling] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyDraft = (d: DailyReport) => {
    setDraft(d);
    setOriginal(figuresFrom(d));
    setForm(figuresFrom(d));
  };

  useEffect(() => {
    reportService.getDraftById(draftId)
      .then(applyDraft)
      .catch(() => setError('Could not load this draft.'))
      .finally(() => setLoading(false));
  }, [draftId]);

  const set = (section: FigureSection, key: string, value: number) =>
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }));

  const photos = (draft?.photos ?? {}) as Record<string, string>;

  /**
   * Fills a photo the staff member never got in. Gallery rather than camera —
   * the day being documented has already passed — and the upload is tagged with
   * that day, not today.
   */
  const pickPhoto = async (category: string) => {
    if (photos[category]) return; // theirs, and not ours to replace
    haptics.light();
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo', quality: 0.7, maxWidth: 1600, maxHeight: 1600, selectionLimit: 1,
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
        draft?.stallName || 'Chaisto',
        { date: draft?.date, source: 'gallery' },
      );
      applyDraft(await reportService.addDraftPhoto(draftId, category, url));
      haptics.success();
    } catch (err: any) {
      haptics.error();
      setError(apiErrorMessage(err, 'Could not add the photo.'));
    } finally {
      setUploading(null);
    }
  };

  const changedFields = changedFigureFields(original, form);
  const busy = saving || filing;

  const savedAt = draft?.updatedAt
    ? new Date(draft.updatedAt).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : null;

  const handleSave = () => {
    if (changedFields.length === 0) {
      setError('Nothing has been changed yet.');
      return;
    }
    setError(null);
    haptics.heavy();
    showAlert({
      title: `Change ${changedFields.length} figure${changedFields.length === 1 ? '' : 's'}?`,
      message:
        `This edits ${draft?.staffName}'s unfinished report for ${draft?.date}.\n\n` +
        'It stays a draft — the change is recorded against your name, and the staff member ' +
        'picks the report up with the corrected figures.',
      type: 'confirm',
      buttons: [
        {
          text: 'Save Changes',
          onPress: async () => {
            setSaving(true);
            try {
              const updated = await reportService.updateDraftFigures(draftId, form, reason.trim() || undefined);
              applyDraft(updated);
              setReason('');
              haptics.success();
              const flagCount = updated.flags?.length ?? 0;
              showAlert(
                'Draft Updated',
                flagCount > 0
                  ? `Saved. The figures now raise ${flagCount} flag${flagCount === 1 ? '' : 's'}.`
                  : 'Saved. The figures raise no flags.',
              );
            } catch (err: any) {
              haptics.error();
              setError(apiErrorMessage(err, 'Could not save the changes.'));
            } finally {
              setSaving(false);
            }
          },
        },
        { text: 'Review', style: 'cancel' },
      ],
    });
  };

  const handleFile = () => {
    setError(null);
    haptics.heavy();
    const pending = changedFields.length > 0
      ? '\n\nYour unsaved edits are not included — save them first if you want them filed.'
      : '';
    // Filing without the day's photos is allowed, but it should be a decision
    // rather than something noticed afterwards
    const missing = PHOTO_CATEGORIES
      .filter((c) => c.required && !photos[c.key])
      .map((c) => c.label);
    const missingNote = missing.length
      ? `\n\nNo ${missing.join(', ')} on this report. You can add photos above before filing.`
      : '';
    showAlert({
      title: 'File this as a report?',
      message:
        `${draft?.staffName} · ${draft?.date}\n\n` +
        'The draft becomes a submitted report on record and is no longer editable by the staff member. ' +
        'It is recorded as filed by you.' +
        missingNote +
        pending,
      type: 'confirm',
      buttons: [
        {
          text: 'File Report',
          onPress: async () => {
            setFiling(true);
            try {
              const report = await reportService.submitDraft(draftId);
              haptics.success();
              const flagCount = report.flags?.length ?? 0;
              showAlert(
                'Report Filed',
                flagCount > 0
                  ? `On record. It raises ${flagCount} flag${flagCount === 1 ? '' : 's'}.`
                  : 'On record. It raises no flags.',
                [{ text: 'Done', onPress: () => navigation.goBack() }],
              );
            } catch (err: any) {
              haptics.error();
              setError(apiErrorMessage(err, 'Could not file this draft.'));
            } finally {
              setFiling(false);
            }
          },
        },
        { text: 'Not Yet', style: 'cancel' },
      ],
    });
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  if (!draft) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Draft not found.'}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 200 }]}>
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>📝</Text>
          <Text style={styles.bannerText}>
            {draft.staffName} started this report for {draft.date} and never submitted it
            {savedAt ? `. Last saved ${savedAt}` : ''}. You can correct the figures, or file it as a
            report if nobody is coming back to finish it.
          </Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ {error}</Text>
          </View>
        )}

        {(draft.flags?.length ?? 0) > 0 && (
          <View style={styles.flagsCard}>
            <Text style={styles.flagsTitle}>
              {draft.flags.length} FLAG{draft.flags.length === 1 ? '' : 'S'} ON THESE FIGURES
            </Text>
            {draft.flags.map((flag, i) => (
              <Text key={`${flag.type}_${i}`} style={styles.flagLine}>• {flag.message}</Text>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>PHOTOS</Text>
        <Text style={styles.photoIntro}>
          Photos {draft.staffName} already took cannot be changed. Any they never got in can be
          added from your gallery, and will be filed with the report.
        </Text>
        <View style={styles.photoCard}>
          {PHOTO_CATEGORIES.map((cat) => {
            const url = photos[cat.key];
            const busy = uploading === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={styles.photoRow}
                onPress={() => pickPhoto(cat.key)}
                disabled={busy || !!url}
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
                  <Text style={styles.photoLabel}>
                    {cat.label}{cat.required ? '' : ' (optional)'}
                  </Text>
                  <Text style={styles.photoSub}>
                    {busy ? 'Uploading…'
                      : url ? 'Taken by staff · locked'
                      : 'Missing · tap to add from gallery'}
                  </Text>
                </View>
                {!!url && <Text style={styles.photoTick}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        <ReportFiguresForm values={form} onChange={set} />

        <Text style={styles.sectionTitle}>REASON (OPTIONAL)</Text>
        <TextInput
          style={styles.reasonInput}
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Staff called in the closing stock over the phone"
          placeholderTextColor={COLORS.muted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          maxLength={300}
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <View style={styles.footerSummary}>
          <Text style={styles.footerSummaryText}>
            {changedFields.length === 0
              ? 'No unsaved changes'
              : `${changedFields.length} figure${changedFields.length === 1 ? '' : 's'} changed`}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, (busy || changedFields.length === 0) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={busy || changedFields.length === 0}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fileBtn, busy && styles.saveBtnDisabled]}
          onPress={handleFile}
          disabled={busy}
        >
          {filing
            ? <ActivityIndicator color={COLORS.primary} />
            : <Text style={styles.fileBtnText}>File as Report</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  errorText: { fontSize: FONT_SIZE.md, color: COLORS.muted, textAlign: 'center' },
  scroll: { padding: SPACING.xl },

  banner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  bannerIcon: { fontSize: 16, marginTop: 1 },
  bannerText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.primaryLight, lineHeight: 20 },

  errorBanner: {
    backgroundColor: COLORS.dangerBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginTop: SPACING.md,
    borderWidth: 1, borderColor: COLORS.danger,
  },
  errorBannerText: { fontSize: FONT_SIZE.sm, color: COLORS.danger, fontWeight: '600', lineHeight: 20 },

  flagsCard: {
    backgroundColor: COLORS.warningBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginTop: SPACING.md,
    borderLeftWidth: 3, borderLeftColor: COLORS.warning,
  },
  flagsTitle: {
    fontSize: 10, fontWeight: '800', color: COLORS.warning,
    letterSpacing: 1, marginBottom: SPACING.sm,
  },
  flagLine: { fontSize: FONT_SIZE.sm, color: COLORS.dark, lineHeight: 20 },

  photoIntro: {
    fontSize: FONT_SIZE.xs, color: COLORS.muted,
    lineHeight: 17, marginBottom: SPACING.md,
  },
  photoCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
    paddingHorizontal: SPACING.md,
  },
  photoRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  photoThumb: { width: 44, height: 44, borderRadius: BORDER_RADIUS.sm },
  photoPlaceholder: {
    width: 44, height: 44, borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed',
  },
  photoLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.black },
  photoSub: { fontSize: FONT_SIZE.xs, color: COLORS.muted, marginTop: 1 },
  photoTick: { fontSize: FONT_SIZE.md, color: COLORS.success, fontWeight: '800' },

  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: COLORS.muted, letterSpacing: 1.5,
    marginBottom: SPACING.md, marginTop: SPACING.lg,
  },
  reasonInput: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.black, minHeight: 80, lineHeight: 22,
  },

  footer: {
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, ...SHADOWS.sm,
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
  fileBtn: {
    marginTop: SPACING.sm, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.primary,
    paddingVertical: SPACING.md, alignItems: 'center', minHeight: 48, justifyContent: 'center',
  },
  fileBtnText: { color: COLORS.primary, fontSize: FONT_SIZE.md, fontWeight: '800' },
});
