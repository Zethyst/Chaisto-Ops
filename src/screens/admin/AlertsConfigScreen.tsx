import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { stallConfigService } from '../../services/stallConfigService';
import { StallConfig } from '../../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';

interface Props {
  route: { params: { stallId: string; stallName: string } };
  navigation: any;
}

type ConfigKey = keyof Omit<StallConfig, 'stallId' | 'updatedByName' | 'updatedAt'>;

const CONFIG_FIELDS: {
  key: ConfigKey;
  label: string;
  sub: string;
  unit: string;
  icon: string;
  min: number;
  max: number;
  step: number;
}[] = [
  {
    key: 'milkMismatchThresholdPct',
    label: 'Milk Mismatch Threshold',
    sub: 'Flag if cups deviate from milk-expected cups by this %',
    unit: '%',
    icon: '🥛',
    min: 5,
    max: 50,
    step: 5,
  },
  {
    key: 'upiMinRatioPct',
    label: 'Min UPI Ratio',
    sub: 'Alert if UPI payments fall below this % of revenue',
    unit: '%',
    icon: '📱',
    min: 0,
    max: 60,
    step: 5,
  },
  {
    key: 'salesDropThresholdPct',
    label: 'Sales Drop Alert',
    sub: 'Flag if daily cups drop this % below 7-day average',
    unit: '%',
    icon: '📉',
    min: 10,
    max: 90,
    step: 10,
  },
  {
    key: 'locationRadiusMeters',
    label: 'Allowed GPS Radius',
    sub: 'Max distance from stall GPS allowed at submission',
    unit: 'm',
    icon: '📍',
    min: 50,
    max: 1000,
    step: 50,
  },
  {
    key: 'missingReportAlertHour',
    label: 'Missing Report Alert Hour',
    sub: 'Send alert if no report submitted by this hour (24h)',
    unit: ':00',
    icon: '⏰',
    min: 17,
    max: 23,
    step: 1,
  },
  {
    key: 'cupsIncentivePerCup',
    label: 'Cup Incentive Rate',
    sub: '₹ paid to staff per cup sold (shown on their dashboard)',
    unit: '₹/cup',
    icon: '☕',
    min: 0,
    max: 10,
    step: 0.5,
  },
];

export default function AlertsConfigScreen({ route, navigation }: Props) {
  const { stallId, stallName } = route.params;
  const [config, setConfig] = useState<StallConfig | null>(null);
  const [draft, setDraft] = useState<Partial<StallConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    stallConfigService.getConfig(stallId).then((c) => {
      setConfig(c);
      setDraft({ ...c });
      setLoading(false);
    }).catch(() => {
      Alert.alert('Error', 'Could not load config');
      setLoading(false);
    });
  }, [stallId]);

  const setValue = (key: ConfigKey, value: number) => {
    haptics.selection();
    setDraft((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    haptics.medium();
    setSaving(true);
    try {
      const updated = await stallConfigService.updateConfig(stallId, draft);
      setConfig(updated);
      setHasChanges(false);
      haptics.success();
      Alert.alert('Saved', 'Alert thresholds updated successfully.');
    } catch (err: any) {
      haptics.error();
      Alert.alert('Error', err.response?.data?.error || 'Could not save config');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!config) return;
    setDraft({ ...config });
    setHasChanges(false);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alerts Config</Text>
        <Text style={styles.headerSub}>📍 {stallName}</Text>
        {config?.updatedByName && (
          <Text style={styles.lastUpdated}>Last updated by {config.updatedByName}</Text>
        )}
      </View>

      {/* Config fields */}
      {CONFIG_FIELDS.map((field) => {
        const current = (draft[field.key] as number) ?? (config?.[field.key] as number) ?? 0;
        return (
          <View key={field.key} style={styles.fieldCard}>
            <View style={styles.fieldHeader}>
              <Text style={{ fontSize: 22 }}>{field.icon}</Text>
              <View style={{ flex: 1, marginLeft: SPACING.md }}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <Text style={styles.fieldSub}>{field.sub}</Text>
              </View>
              <Text style={styles.fieldValue}>{current}{field.unit}</Text>
            </View>

            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setValue(field.key, Math.max(field.min, +(current - field.step).toFixed(1)))}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.stepInput}
                value={String(current)}
                onChangeText={(v) => {
                  const n = parseFloat(v);
                  if (!isNaN(n) && n >= field.min && n <= field.max) setValue(field.key, n);
                }}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setValue(field.key, Math.min(field.max, +(current + field.step).toFixed(1)))}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.rangeBar}>
              <Text style={styles.rangeText}>Min: {field.min}{field.unit}</Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${((current - field.min) / (field.max - field.min)) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.rangeText}>Max: {field.max}{field.unit}</Text>
            </View>
          </View>
        );
      })}

      {/* Actions */}
      <View style={styles.actionRow}>
        {hasChanges && (
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.saveBtn, (!hasChanges || saving) && { opacity: 0.5 }, !hasChanges && { flex: 0.5 }]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveBtnText}>{hasChanges ? 'Save Changes' : 'No Changes'}</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    padding: SPACING.xl, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: SPACING.md,
  },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.black },
  headerSub: { fontSize: FONT_SIZE.md, color: COLORS.medium, marginTop: 4 },
  lastUpdated: { fontSize: FONT_SIZE.xs, color: COLORS.muted, marginTop: 4 },

  fieldCard: {
    backgroundColor: COLORS.white, marginHorizontal: SPACING.xl, marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  fieldLabel: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black },
  fieldSub: { fontSize: FONT_SIZE.xs, color: COLORS.muted, marginTop: 2, lineHeight: 16 },
  fieldValue: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.primary, minWidth: 60, textAlign: 'right' },

  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md, gap: SPACING.md },
  stepBtn: {
    width: 40, height: 40, borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.primaryLight,
  },
  stepBtnText: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.primary },
  stepInput: {
    width: 80, textAlign: 'center', fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.black,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.sm,
    paddingVertical: SPACING.sm,
  },

  rangeBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  rangeText: { fontSize: 11, color: COLORS.muted, minWidth: 50 },
  progressTrack: { flex: 1, height: 4, backgroundColor: COLORS.borderLight, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: COLORS.primary, borderRadius: 2 },

  actionRow: { flexDirection: 'row', marginHorizontal: SPACING.xl, marginTop: SPACING.xl, gap: SPACING.md },
  resetBtn: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md, alignItems: 'center',
  },
  resetText: { fontSize: FONT_SIZE.md, color: COLORS.medium, fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
});
