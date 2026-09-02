import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../components/AppAlert';
import { reportService } from '../../services/reportService';
import { DailyReport } from '../../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';
import { apiErrorMessage } from '../../utils/apiError';
import ReportFiguresForm, {
  emptyFigures, ReportFigures, FigureSection,
} from '../../components/ReportFiguresForm';

const SECTIONS: FigureSection[] = ['openingStock', 'purchases', 'sales', 'payments', 'closingStock'];

/** Pulls the editable numbers out of a fetched report, in stored units. */
function figuresFrom(report: DailyReport): ReportFigures {
  const figures = emptyFigures();
  SECTIONS.forEach((section) => {
    const stored = (report as any)[section] || {};
    Object.entries(stored).forEach(([key, value]) => {
      if (typeof value === 'number') figures[section][key] = value;
    });
  });
  return figures;
}

export default function EditReportScreen({ route, navigation }: any) {
  const { reportId } = route.params;
  const insets = useSafeAreaInsets();

  const [report, setReport] = useState<DailyReport | null>(null);
  const [original, setOriginal] = useState<ReportFigures>(emptyFigures());
  const [form, setForm] = useState<ReportFigures>(emptyFigures());
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reportService.getReportById(reportId)
      .then((r) => {
        setReport(r);
        setOriginal(figuresFrom(r));
        setForm(figuresFrom(r));
      })
      .catch(() => setError('Could not load this report.'))
      .finally(() => setLoading(false));
  }, [reportId]);

  const set = (section: FigureSection, key: string, value: number) =>
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }));

  // Compared in stored units, so a display-only rounding difference is not a change
  const changedFields = SECTIONS.flatMap((section) =>
    Object.keys({ ...original[section], ...form[section] })
      .filter((key) => (original[section][key] ?? 0) !== (form[section][key] ?? 0))
      .map((key) => `${section}.${key}`)
  );

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
        `This edits ${report?.staffName}'s submitted report for ${report?.date}.\n\n` +
        'The original figures are kept on the report and the change is recorded against your name. ' +
        'The report is re-checked afterwards, so its flags may change.',
      type: 'confirm',
      buttons: [
        {
          text: 'Save Changes',
          onPress: async () => {
            setSaving(true);
            try {
              const updated = await reportService.updateReportFigures(reportId, form, reason.trim() || undefined);
              haptics.success();
              const flagCount = updated.flags?.length ?? 0;
              showAlert(
                'Report Updated',
                flagCount > 0
                  ? `Saved. The report now raises ${flagCount} flag${flagCount === 1 ? '' : 's'}.`
                  : 'Saved. The report raises no flags.',
                [{ text: 'Done', onPress: () => navigation.goBack() }],
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

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  if (!report) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Report not found.'}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 140 }]}>
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>✏️</Text>
          <Text style={styles.bannerText}>
            Editing {report.staffName}'s report for {report.date}. The original figures are kept and
            the change is recorded against your name. Photos, GPS and who filed it cannot be changed.
          </Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ {error}</Text>
          </View>
        )}

        <ReportFiguresForm values={form} onChange={set} />

        <Text style={styles.sectionTitle}>REASON (OPTIONAL)</Text>
        <TextInput
          style={styles.reasonInput}
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Staff miscounted the closing stock"
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
              ? 'No changes yet'
              : `${changedFields.length} figure${changedFields.length === 1 ? '' : 's'} changed`}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, (saving || changedFields.length === 0) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || changedFields.length === 0}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
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
