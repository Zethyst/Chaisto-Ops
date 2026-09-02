import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, TextInput, Image, Modal, Dimensions, StatusBar,
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
import { showAlert } from '../../components/AppAlert';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { reportService } from '../../services/reportService';
import { aiService } from '../../services/aiService';
import { DailyReport, SuspicionFlag } from '../../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';

export default function ReportDetailScreen({ route, navigation }: any) {
  const { reportId } = route.params;
  const { user } = useSelector((s: RootState) => s.auth);
  const isAdmin = user?.role === 'admin';

  const [report, setReport] = useState<DailyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ uri: string; label: string } | null>(null);
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadReport = () => reportService.getReportById(reportId)
    .then(setReport)
    .catch(() => showAlert('Error', 'Could not load report.'))
    .finally(() => setIsLoading(false));

  useEffect(() => { loadReport(); }, [reportId]);

  // Coming back from the edit screen, the figures on screen are stale
  useEffect(() => navigation.addListener('focus', loadReport), [navigation, reportId]);

  const handleReview = async (status: 'reviewed' | 'flagged') => {
    haptics.heavy();
    setReviewing(true);
    try {
      const api = require('axios').default.create({
        baseURL: require('../../constants').API_CONFIG.BASE_URL,
        timeout: 15000,
      });
      const { authService } = require('../../services/authService');
      const token = await authService.getStoredToken();
      await api.patch(`/reports/${reportId}/review`, { status, adminNotes: reviewNote }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReport((r) => r ? { ...r, status } : r);
      showAlert('Done', `Report marked as ${status}.`);
    } catch {
      showAlert('Error', 'Could not update report status.');
    } finally {
      setReviewing(false);
    }
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }
  if (!report) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyText}>Report not found</Text>
      </View>
    );
  }

  const totalCups = (report.sales?.regularCups || 0) + (report.sales?.specialCups || 0) + (report.sales?.kulhadCups || 0);
  const totalMomoPackets = (report.sales?.vegMomoPackets || 0) + (report.sales?.paneerMomoPackets || 0);
  const totalRevenue = (report.payments?.upi || 0) + (report.payments?.cash || 0);
  const upiPct = totalRevenue > 0 ? Math.round((report.payments?.upi / totalRevenue) * 100) : 0;

  const statusColor = { submitted: COLORS.info, reviewed: COLORS.success, flagged: COLORS.danger, draft: COLORS.muted };
  const statusBg = { submitted: COLORS.infoBg, reviewed: COLORS.successBg, flagged: COLORS.dangerBg, draft: COLORS.surface };

  const PHOTO_LABELS: Record<string, string> = {
    cash: 'Cash Tray',
    stock: 'Stock',
    milkPacket: 'Milk Packet',
    cartClosing: 'Cart Closing',
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.staffName}>{report.staffName}</Text>
          <Text style={styles.date}>
            {new Date(report.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusBg[report.status] }]}>
          <Text style={[styles.statusText, { color: statusColor[report.status] }]}>
            {report.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Backfill provenance — this report was not filed by the staff member */}
      {report.isBackfill && (
        <View style={styles.backfillBanner}>
          <Text style={styles.backfillIcon}>🗓</Text>
          <Text style={styles.backfillText}>
            Entered after the fact by {report.enteredByName || 'an admin'} — there is no GPS for it,
            and any photos were uploaded from a gallery rather than captured live, so location and
            photo checks do not apply.
          </Text>
        </View>
      )}

      {/* Summary KPIs */}
      <View style={styles.kpiRow}>
        <MiniKpi label="Cups" value={String(totalCups)} icon="☕" color={COLORS.primary} />
        <MiniKpi label="Momo Plates" value={String(totalMomoPackets)} icon="🥟" color={COLORS.primary} />
        <MiniKpi label="Revenue" value={`₹${totalRevenue}`} icon="💰" color={COLORS.success} />
        <MiniKpi label="UPI" value={`${upiPct}%`} icon="📱" color={COLORS.info} />
        <MiniKpi label="Flags" value={String(report.flags?.length || 0)} icon="🚩" color={COLORS.danger} />
      </View>

      {/* Flags */}
      {report.flags?.length > 0 && (
        <Section title="🚨 Suspicion Flags">
          {report.flags.map((flag, i) => <FlagRow key={i} flag={flag} />)}
          {/* AI Narrative */}
          {aiNarrative ? (
            <View style={styles.aiNarrativeBox}>
              <Text style={styles.aiNarrativeLabel}>🤖 AI Analysis</Text>
              <Text style={styles.aiNarrativeText}>{aiNarrative}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.aiAnalyzeBtn}
              onPress={async () => {
                setAiLoading(true);
                try {
                  const narrative = await aiService.getFlagNarrative(reportId);
                  setAiNarrative(narrative);
                } catch {
                  setAiNarrative('Could not generate analysis. Check your connection.');
                } finally {
                  setAiLoading(false);
                }
              }}
              disabled={aiLoading}
            >
              {aiLoading
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : <Text style={styles.aiAnalyzeBtnText}>🤖 Generate AI Analysis</Text>
              }
            </TouchableOpacity>
          )}
        </Section>
      )}

      {/* Sales */}
      <Section title="☕ Sales">
        <DataRow label="Regular Chai" value={`${report.sales?.regularCups || 0} cups`} />
        <DataRow label="Special Chai" value={`${report.sales?.specialCups || 0} cups`} />
        <DataRow label="Kulhad Chai" value={`${report.sales?.kulhadCups || 0} cups`} />
        <DataRow label="Veg Momo" value={`${report.sales?.vegMomoPackets || 0} plates`} />
        <DataRow label="Paneer Momo" value={`${report.sales?.paneerMomoPackets || 0} plates`} />
        <DataRow label="Snack Sales" value={`₹${report.sales?.snacks || 0}`} />
        <DataRow label="Cigarette Sales" value={`₹${report.sales?.cigarettes || 0}`} />
        <DataRow label="Total Cups" value={`${totalCups} cups`} bold />
        <DataRow label="Total Momo Plates" value={`${totalMomoPackets} plates`} bold />
        <DataRow label="Est. Revenue" value={`₹${report.computed?.totalRevenue || 0}`} bold />
      </Section>

      {/* Purchases */}
      <Section title="🛒 Purchases Today">
        <DataRow label="Milk Purchased" value={`${report.purchases?.milk || 0} L`} />
        <DataRow label="Veg Momo Purchased" value={`${report.purchases?.vegMomoPackets || 0} plates`} />
        <DataRow label="Paneer Momo Purchased" value={`${report.purchases?.paneerMomoPackets || 0} plates`} />
        <DataRow label="Snacks Purchased" value={`₹${report.purchases?.snacks || 0}`} />
        <DataRow label="Cigarettes Purchased" value={`₹${report.purchases?.cigarettes || 0}`} />
      </Section>

      {/* Payments */}
      <Section title="💳 Payments">
        <DataRow label="UPI Received" value={`₹${report.payments?.upi || 0}`} />
        <DataRow label="Cash Received" value={`₹${report.payments?.cash || 0}`} />
        <DataRow label="Total Collected" value={`₹${totalRevenue}`} bold />
        <DataRow label="UPI Ratio" value={`${upiPct}%`} color={upiPct < 20 ? COLORS.danger : COLORS.success} />
      </Section>

      {/* Opening Stock */}
      <Section title="📦 Opening Stock">
        <DataRow label="Milk" value={`${report.openingStock?.milk || 0} L`} />
        <DataRow label="Paper Cups" value={String(report.openingStock?.cups || 0)} />
        <DataRow label="Kulhad Cups" value={String(report.openingStock?.kulhadCups || 0)} />
        <DataRow label="Veg Momo" value={`${report.openingStock?.vegMomoPackets || 0} plates`} />
        <DataRow label="Paneer Momo" value={`${report.openingStock?.paneerMomoPackets || 0} plates`} />
      </Section>

      {/* Closing Stock */}
      <Section title="📊 Closing Stock">
        <DataRow label="Milk" value={`${report.closingStock?.milk || 0} L`} />
        <DataRow label="Paper Cups" value={String(report.closingStock?.cups || 0)} />
        <DataRow label="Kulhad Cups" value={String(report.closingStock?.kulhadCups || 0)} />
        <DataRow label="Veg Momo" value={`${report.closingStock?.vegMomoPackets || 0} plates`} />
        <DataRow label="Paneer Momo" value={`${report.closingStock?.paneerMomoPackets || 0} plates`} />
      </Section>

      {/* Computed */}
      <Section title="🔢 Computed Metrics">
        <DataRow label="Milk Used" value={`${(report.computed?.milkUsed || 0).toFixed(2)} L`} />
        <DataRow label="Expected Cups (from milk)" value={String(Math.round(report.computed?.expectedCupsFromMilk || 0))} />
        <DataRow label="Expected Momo Packets (from stock)" value={String(Math.round(report.computed?.expectedMomoFromStock || 0))} />
        <DataRow label="Revenue per Cup" value={`₹${(report.computed?.revenuePerCup || 0).toFixed(1)}`} />
        <DataRow label="Revenue per Momo Packet" value={`₹${(report.computed?.revenuePerMomoPacket || 0).toFixed(1)}`} />
      </Section>

      {/* Location */}
      <Section title="📍 Location">
        <DataRow label="Latitude" value={(report.location?.latitude || 0).toFixed(5)} />
        <DataRow label="Longitude" value={(report.location?.longitude || 0).toFixed(5)} />
        <DataRow
          label="Submitted At"
          value={report.submittedAt
            ? new Date(report.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : '—'}
        />
      </Section>

      {/* Photos */}
      <Section title="📸 Evidence Photos">
        <View style={styles.photoGrid}>
          {Object.entries(report.photos || {}).map(([key, url]) => url ? (
            <TouchableOpacity
              key={key}
              style={styles.photoItem}
              onPress={() => setLightboxPhoto({ uri: url as string, label: PHOTO_LABELS[key] || key })}
              activeOpacity={0.85}
            >
              <Image source={{ uri: url as string }} style={styles.photo} resizeMode="cover" />
              <View style={styles.photoLabelOverlay}>
                <Text style={styles.photoLabel}>{PHOTO_LABELS[key] || key.replace(/([A-Z])/g, ' $1').trim()}</Text>
                <Text style={styles.photoTap}>Tap to expand</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View key={key} style={[styles.photoItem, styles.photoMissing]}>
              <Text style={styles.photoMissingIcon}>📷</Text>
              <Text style={styles.photoMissingText}>{PHOTO_LABELS[key] || key}</Text>
              <Text style={styles.photoMissingSub}>Not captured</Text>
            </View>
          ))}
        </View>
      </Section>

      {/* Corrections made after submission */}
      {!!report.editHistory?.length && (
        <Section title="✏️ Edit History">
          {report.editHistory.map((entry, i) => (
            <View key={i} style={styles.editEntry}>
              <Text style={styles.editEntryHead}>
                {entry.editedByName || 'An admin'}
                {entry.editedAt
                  ? ` · ${new Date(entry.editedAt).toLocaleString('en-IN', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}`
                  : ''}
              </Text>
              {!!entry.reason && <Text style={styles.editReason}>“{entry.reason}”</Text>}
              {entry.changes.map((c, j) => (
                <Text key={j} style={styles.editChange}>
                  {c.field}: {c.from} → {c.to}
                </Text>
              ))}
            </View>
          ))}
        </Section>
      )}

      {/* Correct the figures */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => { haptics.light(); navigation.navigate('EditReport', { reportId }); }}
        >
          <Text style={styles.editBtnText}>✏️  Edit Figures</Text>
        </TouchableOpacity>
      )}

      {/* Admin Review */}
      {isAdmin && report.status !== 'reviewed' && (
        <Section title="Admin Review">
          <TextInput
            style={styles.reviewInput}
            placeholder="Add review notes (optional)..."
            placeholderTextColor={COLORS.muted}
            value={reviewNote}
            onChangeText={setReviewNote}
            multiline
            numberOfLines={3}
          />
          <View style={styles.reviewBtns}>
            <TouchableOpacity
              style={[styles.reviewBtn, styles.approveBtn, reviewing && { opacity: 0.5 }]}
              onPress={() => handleReview('reviewed')}
              disabled={reviewing}
            >
              <Text style={styles.reviewBtnText}>✓ Mark Reviewed</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reviewBtn, styles.flagBtn, reviewing && { opacity: 0.5 }]}
              onPress={() => handleReview('flagged')}
              disabled={reviewing}
            >
              <Text style={[styles.reviewBtnText, { color: COLORS.danger }]}>🚨 Flag Report</Text>
            </TouchableOpacity>
          </View>
        </Section>
      )}
    </ScrollView>

    {/* Photo Lightbox */}
    <Modal visible={!!lightboxPhoto} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setLightboxPhoto(null)}>
      <View style={styles.lightboxOverlay}>
        <StatusBar hidden />
        <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxPhoto(null)}>
          <Text style={styles.lightboxCloseText}>✕</Text>
        </TouchableOpacity>
        {lightboxPhoto && (
          <Image
            source={{ uri: lightboxPhoto.uri }}
            style={styles.lightboxImage}
            resizeMode="contain"
          />
        )}
        {lightboxPhoto && (
          <View style={styles.lightboxLabel}>
            <Text style={styles.lightboxLabelText}>{lightboxPhoto.label}</Text>
          </View>
        )}
      </View>
    </Modal>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function DataRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={[styles.dataValue, bold && styles.dataValueBold, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

function MiniKpi({ label, value, icon, color }: any) {
  return (
    <View style={[styles.miniKpi, { borderTopColor: color, borderTopWidth: 2 }]}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={[styles.miniKpiValue, { color }]}>{value}</Text>
      <Text style={styles.miniKpiLabel}>{label}</Text>
    </View>
  );
}

function FlagRow({ flag }: { flag: SuspicionFlag }) {
  const colors = { high: COLORS.danger, medium: COLORS.warning, low: COLORS.info };
  const bgs = { high: COLORS.dangerBg, medium: COLORS.warningBg, low: COLORS.infoBg };
  const c = colors[flag.severity];
  const bg = bgs[flag.severity];
  return (
    <View style={[styles.flagRow, { backgroundColor: bg, borderLeftColor: c }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.flagMsg, { color: c }]}>{flag.message}</Text>
      </View>
      <View style={[styles.sevBadge, { backgroundColor: c }]}>
        <Text style={styles.sevText}>{flag.severity.toUpperCase()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 56, marginBottom: SPACING.md },
  emptyText: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.dark },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', padding: SPACING.xl,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  staffName: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.black },
  date: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 4 },
  statusBadge: { borderRadius: BORDER_RADIUS.full, paddingHorizontal: 12, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  editBtn: {
    marginHorizontal: SPACING.lg, marginTop: SPACING.md,
    borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center',
  },
  editBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: FONT_SIZE.md },

  editEntry: {
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  editEntryHead: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.dark },
  editReason: { fontSize: FONT_SIZE.sm, color: COLORS.muted, fontStyle: 'italic', marginTop: 2 },
  editChange: { fontSize: FONT_SIZE.sm, color: COLORS.medium, marginTop: 2 },

  backfillBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: COLORS.warningBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginHorizontal: SPACING.lg, marginTop: SPACING.md,
    borderWidth: 1, borderColor: COLORS.warning,
  },
  backfillIcon: { fontSize: 16, marginTop: 1 },
  backfillText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.warning, lineHeight: 20, fontWeight: '600' },

  kpiRow: { flexDirection: 'row', padding: SPACING.lg, gap: SPACING.sm },
  miniKpi: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm, alignItems: 'center', ...SHADOWS.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  miniKpiValue: { fontSize: FONT_SIZE.lg, fontWeight: '800', marginTop: 4 },
  miniKpiLabel: { fontSize: 10, color: COLORS.muted, marginTop: 2 },

  section: { padding: SPACING.xl, paddingBottom: 0 },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black, marginBottom: SPACING.sm },
  sectionCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border,
  },
  dataRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.borderLight,
  },
  dataLabel: { fontSize: FONT_SIZE.sm, color: COLORS.medium },
  dataValue: { fontSize: FONT_SIZE.sm, color: COLORS.dark, fontWeight: '600' },
  dataValueBold: { fontWeight: '800', color: COLORS.black, fontSize: FONT_SIZE.md },

  flagRow: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.md,
    borderLeftWidth: 3, marginHorizontal: SPACING.sm, marginVertical: 4, borderRadius: BORDER_RADIUS.sm,
  },
  flagMsg: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  sevBadge: { borderRadius: BORDER_RADIUS.full, paddingHorizontal: 8, paddingVertical: 3, marginLeft: SPACING.sm },
  sevText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, padding: SPACING.md },
  photoItem: { width: '47%', borderRadius: BORDER_RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.borderLight },
  photo: { width: '100%', height: 140, borderRadius: BORDER_RADIUS.md },
  photoLabelOverlay: {
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: SPACING.sm, paddingVertical: 6,
  },
  photoLabel: { fontSize: 12, color: '#fff', fontWeight: '700', textTransform: 'capitalize' },
  photoTap: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  photoMissing: {
    height: 140, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed',
  },
  photoMissingIcon: { fontSize: 24, opacity: 0.3, marginBottom: 4 },
  photoMissingText: { fontSize: FONT_SIZE.sm, color: COLORS.muted, fontWeight: '600' },
  photoMissingSub: { fontSize: 10, color: COLORS.muted, marginTop: 2 },

  lightboxOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.96)',
    alignItems: 'center', justifyContent: 'center',
  },
  lightboxClose: {
    position: 'absolute', top: 50, right: 20, zIndex: 10,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  lightboxCloseText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  lightboxImage: { width: SCREEN_W, height: SCREEN_H * 0.75 },
  lightboxLabel: {
    position: 'absolute', bottom: 60, left: 0, right: 0,
    alignItems: 'center',
  },
  lightboxLabelText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '700', letterSpacing: 0.5 },

  reviewInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md, color: COLORS.black, fontSize: FONT_SIZE.md,
    backgroundColor: COLORS.surface, minHeight: 80, textAlignVertical: 'top',
    marginBottom: SPACING.md,
  },
  reviewBtns: { flexDirection: 'row', gap: SPACING.md },
  reviewBtn: {
    flex: 1, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md,
    alignItems: 'center', borderWidth: 1,
  },
  approveBtn: { backgroundColor: COLORS.successBg, borderColor: COLORS.success },
  flagBtn: { backgroundColor: COLORS.dangerBg, borderColor: COLORS.danger },
  reviewBtnText: { fontWeight: '700', fontSize: FONT_SIZE.md, color: COLORS.success },

  aiAnalyzeBtn: {
    marginTop: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  aiAnalyzeBtnText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.primary },
  aiNarrativeBox: {
    marginTop: SPACING.md, backgroundColor: COLORS.primaryBg,
    borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  aiNarrativeLabel: { fontSize: 12, fontWeight: '800', color: COLORS.primaryDark, marginBottom: 6 },
  aiNarrativeText: { fontSize: FONT_SIZE.sm, color: COLORS.dark, lineHeight: 20 },
});
