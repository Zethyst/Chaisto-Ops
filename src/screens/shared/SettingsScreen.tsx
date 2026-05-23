import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, TextInput, ActivityIndicator, Switch,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { logoutUser } from '../../store/slices/authSlice';
import { authService } from '../../services/authService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';
import { useLanguage } from '../../i18n';

export default function SettingsScreen() {
  const { user } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch<AppDispatch>();

  const { language, setLanguage, t } = useLanguage();
  const [showPwForm, setShowPwForm] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);

  const handleLogout = () => {
    haptics.heavy();
    Alert.alert(
      'Sign Out',
      'You will need to sign back in to access the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => { haptics.heavy(); dispatch(logoutUser()); },
        },
      ]
    );
  };

  const handleChangePassword = async () => {
    if (!oldPw || !newPw || !confirmPw) {
      Alert.alert('Missing Fields', 'Please fill in all password fields.');
      return;
    }
    if (newPw.length < 8) {
      Alert.alert('Weak Password', 'New password must be at least 8 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }
    haptics.medium();
    setPwLoading(true);
    try {
      await authService.changePassword(user!.id, oldPw, newPw);
      haptics.success();
      Alert.alert('Success', 'Password changed successfully.');
      setOldPw(''); setNewPw(''); setConfirmPw('');
      setShowPwForm(false);
    } catch (err: any) {
      haptics.error();
      Alert.alert('Error', err.response?.data?.error || 'Could not change password.');
    } finally {
      setPwLoading(false);
    }
  };

  const roleColor = { admin: COLORS.admin, moderator: COLORS.moderator, staff: COLORS.staff }[user?.role ?? 'staff'];
  const roleBg = { admin: COLORS.adminBg, moderator: COLORS.moderatorBg, staff: COLORS.staffBg }[user?.role ?? 'staff'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: roleBg }]}>
          <Text style={[styles.avatarText, { color: roleColor }]}>
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleBg }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{user?.role?.toUpperCase()}</Text>
          </View>
          <Text style={styles.profilePhone}>+91 {user?.phone}</Text>
          {user?.stallName && <Text style={styles.profileStall}>📍 {user.stallName}</Text>}
        </View>
      </View>

      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>SECURITY</Text>

        <TouchableOpacity
          style={styles.row}
          onPress={() => setShowPwForm((v) => !v)}
        >
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>🔑</Text>
            <Text style={styles.rowLabel}>Change Password</Text>
          </View>
          <Text style={styles.rowChevron}>{showPwForm ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showPwForm && (
          <View style={styles.pwForm}>
            <PwField label="Current password" value={oldPw} onChange={setOldPw} />
            <PwField label="New password" value={newPw} onChange={setNewPw} />
            <PwField label="Confirm new password" value={confirmPw} onChange={setConfirmPw} />
            <TouchableOpacity
              style={[styles.pwBtn, pwLoading && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              disabled={pwLoading}
            >
              {pwLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.pwBtnText}>Update Password</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>NOTIFICATIONS</Text>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>🔔</Text>
            <View>
              <Text style={styles.rowLabel}>Push Notifications</Text>
              <Text style={styles.rowSub}>Receive alerts and reminders</Text>
            </View>
          </View>
          <Switch
            value={notifEnabled}
            onValueChange={setNotifEnabled}
            trackColor={{ false: COLORS.borderLight, true: COLORS.successBg }}
            thumbColor={notifEnabled ? COLORS.success : COLORS.muted}
          />
        </View>
      </View>

      {/* Language Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>LANGUAGE / भाषा</Text>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>🌐</Text>
            <View>
              <Text style={styles.rowLabel}>{t('language')}</Text>
              <Text style={styles.rowSub}>{t('languageSub')}</Text>
            </View>
          </View>
          <View style={styles.langToggle}>
            <TouchableOpacity
              style={[styles.langOption, language === 'en' && styles.langOptionActive]}
              onPress={() => { haptics.selection(); setLanguage('en'); }}
            >
              <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>EN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langOption, language === 'hi' && styles.langOptionActive]}
              onPress={() => { haptics.selection(); setLanguage('hi'); }}
            >
              <Text style={[styles.langText, language === 'hi' && styles.langTextActive]}>हि</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={[styles.row, styles.rowDisabled]}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>📱</Text>
            <View>
              <Text style={styles.rowLabel}>Device Binding</Text>
              <Text style={styles.rowSub}>{user?.deviceId ? 'Bound to this device' : 'Not bound'}</Text>
            </View>
          </View>
          <View style={[styles.deviceBadge, { backgroundColor: user?.deviceId ? COLORS.successBg : COLORS.warningBg }]}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: user?.deviceId ? COLORS.success : COLORS.warning }}>
              {user?.deviceId ? 'ACTIVE' : 'UNBOUND'}
            </Text>
          </View>
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>ABOUT</Text>
        <View style={[styles.row, styles.rowDisabled]}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>ℹ️</Text>
            <Text style={styles.rowLabel}>ChaistOps</Text>
          </View>
          <Text style={styles.rowValue}>v1.0</Text>
        </View>
        <View style={[styles.row, styles.rowDisabled]}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>📍</Text>
            <Text style={styles.rowLabel}>Civil Lines, Prayagraj</Text>
          </View>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>🔒 Secured · GPS-tracked · Device-bound</Text>
    </ScrollView>
  );
}

function PwField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.pwField}>
      <Text style={styles.pwLabel}>{label}</Text>
      <View style={styles.pwInput}>
        <TextInput
          style={{ flex: 1, fontSize: FONT_SIZE.md, color: COLORS.black, paddingVertical: SPACING.sm }}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          placeholderTextColor={COLORS.muted}
          placeholder="••••••••"
        />
        <TouchableOpacity onPress={() => setShow((v) => !v)}>
          <Text style={{ fontSize: 16 }}>{show ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { paddingBottom: 60 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    padding: SPACING.xl, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 64, height: 64, borderRadius: BORDER_RADIUS.full,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: FONT_SIZE.xxl, fontWeight: '800' },
  profileInfo: { marginLeft: SPACING.lg, flex: 1 },
  profileName: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.black, marginBottom: 6 },
  roleBadge: { alignSelf: 'flex-start', borderRadius: BORDER_RADIUS.full, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 6 },
  roleText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  profilePhone: { fontSize: FONT_SIZE.sm, color: COLORS.medium },
  profileStall: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 2 },

  section: { marginTop: SPACING.xl },
  sectionHeader: {
    fontSize: 11, fontWeight: '700', color: COLORS.muted, letterSpacing: 1.5,
    paddingHorizontal: SPACING.xl, marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: COLORS.borderLight,
  },
  rowDisabled: { opacity: 1 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowIcon: { fontSize: 20, marginRight: SPACING.md },
  rowLabel: { fontSize: FONT_SIZE.md, color: COLORS.dark, fontWeight: '500' },
  rowSub: { fontSize: FONT_SIZE.sm, color: COLORS.muted, marginTop: 2 },
  rowChevron: { fontSize: FONT_SIZE.sm, color: COLORS.muted },
  rowValue: { fontSize: FONT_SIZE.sm, color: COLORS.muted },
  deviceBadge: { borderRadius: BORDER_RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },

  pwForm: {
    backgroundColor: COLORS.white, padding: SPACING.xl,
    borderTopWidth: 0.5, borderTopColor: COLORS.borderLight,
  },
  pwField: { marginBottom: SPACING.md },
  pwLabel: { fontSize: FONT_SIZE.sm, color: COLORS.dark, fontWeight: '600', marginBottom: 6 },
  pwInput: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.md, backgroundColor: COLORS.surface,
  },
  pwBtn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.md,
  },
  pwBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },

  logoutBtn: {
    marginHorizontal: SPACING.xl, marginTop: SPACING.xl * 2,
    backgroundColor: COLORS.dangerBg, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.danger,
  },
  logoutText: { color: COLORS.danger, fontSize: FONT_SIZE.lg, fontWeight: '700' },

  footer: { textAlign: 'center', marginTop: SPACING.xl, fontSize: 12, color: COLORS.muted },

  langToggle: { flexDirection: 'row', gap: 6 },
  langOption: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md, paddingVertical: 6, backgroundColor: COLORS.surface,
  },
  langOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  langText: { fontSize: FONT_SIZE.sm, color: COLORS.medium, fontWeight: '700' },
  langTextActive: { color: COLORS.primary },
});
