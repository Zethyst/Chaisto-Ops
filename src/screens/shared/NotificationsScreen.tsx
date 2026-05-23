import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { notificationService } from '../../services/notificationService';
import { Notification } from '../../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants';
import { haptics } from '../../utils/haptics';
import { useLanguage } from '../../i18n';

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  report_submitted:   { icon: '📋', color: COLORS.info,    bg: COLORS.infoBg    },
  suspicious_activity:{ icon: '🚨', color: COLORS.danger,  bg: COLORS.dangerBg  },
  missing_report:     { icon: '⏰', color: COLORS.warning, bg: COLORS.warningBg },
  low_stock:          { icon: '📦', color: COLORS.warning, bg: COLORS.warningBg },
  reminder:           { icon: '🔔', color: COLORS.primary, bg: COLORS.primaryBg },
};

type Filter = 'all' | 'unread' | 'alerts';

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Show empty state on error
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleMarkRead = async (notif: Notification) => {
    if (notif.read) return;
    haptics.selection();
    await notificationService.markAsRead(notif.id);
    setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    haptics.medium();
    await notificationService.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'alerts') return n.type === 'suspicious_activity' || n.type === 'missing_report';
    return true;
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'unread', 'alerts'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => { haptics.selection(); setFilter(f); }}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? t('allFilter') : f === 'unread' ? `${t('unreadFilter')} (${unreadCount})` : t('alertsFilter')}
            </Text>
          </TouchableOpacity>
        ))}
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>{t('markAllRead')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔕</Text>
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySub}>You're all caught up</Text>
          </View>
        }
        renderItem={({ item }) => {
          const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.reminder;
          return (
            <TouchableOpacity
              style={[styles.card, !item.read && styles.cardUnread]}
              onPress={() => handleMarkRead(item)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
                <Text style={styles.icon}>{cfg.icon}</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {!item.read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.cardMsg} numberOfLines={2}>{item.message}</Text>
                <Text style={styles.cardTime}>{formatTime(item.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  filterRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    backgroundColor: COLORS.white, paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm,
  },
  filterTab: {
    paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: BORDER_RADIUS.full,
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterTabActive: { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primary },
  filterText: { fontSize: FONT_SIZE.sm, color: COLORS.muted, fontWeight: '600' },
  filterTextActive: { color: COLORS.primary },
  markAllBtn: { marginLeft: 'auto' as any },
  markAllText: { fontSize: FONT_SIZE.sm, color: COLORS.primaryLight, fontWeight: '600' },

  list: { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: 40 },

  card: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardUnread: { borderColor: COLORS.primaryLight, backgroundColor: COLORS.primaryBg },
  iconWrap: {
    width: 44, height: 44, borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md,
  },
  icon: { fontSize: 20 },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardTitle: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.dark, fontWeight: '600' },
  cardTitleUnread: { color: COLORS.black, fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginLeft: SPACING.sm },
  cardMsg: { fontSize: FONT_SIZE.sm, color: COLORS.medium, lineHeight: 18 },
  cardTime: { fontSize: 11, color: COLORS.muted, marginTop: 4 },

  empty: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.dark },
  emptySub: { fontSize: FONT_SIZE.md, color: COLORS.muted, marginTop: SPACING.sm },
});
