import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { auditService } from '../../services/auditService';
import { AuditLogEntry } from '../../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants';
import { haptics } from '../../utils/haptics';

const ACTION_META: Record<string, { icon: string; color: string; label: string }> = {
  user_created: { icon: '👤', color: COLORS.success, label: 'User Created' },
  user_disabled: { icon: '🚫', color: COLORS.danger, label: 'User Disabled' },
  user_enabled: { icon: '✅', color: COLORS.success, label: 'User Enabled' },
  user_password_reset: { icon: '🔑', color: COLORS.warning, label: 'Password Reset' },
  device_reset: { icon: '📱', color: COLORS.warning, label: 'Device Reset' },
  report_reviewed: { icon: '✔️', color: COLORS.success, label: 'Report Reviewed' },
  report_flagged: { icon: '🚩', color: COLORS.danger, label: 'Report Flagged' },
  report_cleared: { icon: '🟢', color: COLORS.success, label: 'Report Cleared' },
  report_backfilled: { icon: '🗓️', color: COLORS.info, label: 'Past Report Filed' },
  report_edited: { icon: '✏️', color: COLORS.warning, label: 'Report Edited' },
  report_photo_added: { icon: '📸', color: COLORS.info, label: 'Photo Added' },
  report_draft_edited: { icon: '✏️', color: COLORS.warning, label: 'Draft Edited' },
  report_draft_submitted: { icon: '📤', color: COLORS.success, label: 'Draft Filed' },
  config_changed: { icon: '⚙️', color: COLORS.info, label: 'Config Changed' },
  attendance_marked: { icon: '📅', color: COLORS.info, label: 'Attendance Marked' },
  expense_deleted: { icon: '💸', color: COLORS.danger, label: 'Expense Deleted' },
  stall_created: { icon: '🏪', color: COLORS.success, label: 'Stall Created' },
  stall_updated: { icon: '🏪', color: COLORS.warning, label: 'Stall Updated' },
  inventory_updated: { icon: '📦', color: COLORS.primary, label: 'Inventory Updated' },
};

const ACTION_FILTERS = [
  { key: '', label: 'All' },
  { key: 'user_created', label: 'Users' },
  { key: 'report_reviewed', label: 'Reports' },
  { key: 'config_changed', label: 'Config' },
  { key: 'device_reset', label: 'Devices' },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AuditLogScreen() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  const load = async (reset = false) => {
    const p = reset ? 1 : page;
    try {
      const result = await auditService.getLogs({ action: actionFilter || undefined, page: p });
      if (reset) {
        setLogs(result.logs);
        setPage(2);
      } else {
        setLogs((prev) => [...prev, ...result.logs]);
        setPage(p + 1);
      }
      setHasMore(p < result.pages);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setPage(1);
    load(true);
  }, [actionFilter]);

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    load(false);
  };

  const renderItem = ({ item }: { item: AuditLogEntry }) => {
    const meta = ACTION_META[item.action] || { icon: '📝', color: COLORS.muted, label: item.action };
    const eid = (item as any)._id || item.id;
    return (
      <View style={styles.logRow}>
        <View style={[styles.actionIcon, { backgroundColor: `${meta.color}20` }]}>
          <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <View style={styles.logHeader}>
            <Text style={[styles.actionLabel, { color: meta.color }]}>{meta.label}</Text>
            <Text style={styles.timeAgo}>{timeAgo(item.createdAt)}</Text>
          </View>
          <Text style={styles.actorText}>
            {item.actorName} <Text style={styles.rolePill}>({item.actorRole})</Text>
          </Text>
          {item.details && Object.keys(item.details).length > 0 && (
            <Text style={styles.details} numberOfLines={2}>
              {Object.entries(item.details)
                .filter(([k]) => !['previous', '__v'].includes(k))
                .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                .join(' · ')}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter pills */}
      <View style={styles.filterRow}>
        {ACTION_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterPill, actionFilter === f.key && styles.filterPillActive]}
            onPress={() => { haptics.selection(); setActionFilter(f.key); }}
          >
            <Text style={[styles.filterText, actionFilter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => (item as any)._id || item.id || Math.random().toString()}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={COLORS.primaryLight} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 40 }}>📋</Text>
              <Text style={styles.emptyText}>No audit logs found</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.primary} style={{ padding: SPACING.xl }} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  filterRow: {
    flexDirection: 'row', backgroundColor: COLORS.white, paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm,
  },
  filterPill: {
    borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  filterPillActive: { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primary },
  filterText: { fontSize: FONT_SIZE.xs, color: COLORS.medium, fontWeight: '600' },
  filterTextActive: { color: COLORS.primary },

  listContent: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl },

  logRow: {
    flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  actionIcon: { width: 42, height: 42, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  actionLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  timeAgo: { fontSize: 11, color: COLORS.muted },
  actorText: { fontSize: FONT_SIZE.sm, color: COLORS.dark, marginBottom: 2 },
  rolePill: { fontSize: 11, color: COLORS.muted },
  details: { fontSize: 11, color: COLORS.muted, lineHeight: 16 },

  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxxl },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.muted, marginTop: SPACING.md },
});
