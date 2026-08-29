import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
   TextInput, ActivityIndicator, Switch, Modal, Image,
   Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform,
} from 'react-native';
import { showAlert } from '../../components/AppAlert';
import { launchImageLibrary, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { logoutUser, setUser } from '../../store/slices/authSlice';
import { authService } from '../../services/authService';
import DeviceInfo from 'react-native-device-info';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS, CLOUDINARY_CONFIG } from '../../constants';
import { haptics } from '../../utils/haptics';
import { useLanguage } from '../../i18n';
import axios from 'axios';

export default function SettingsScreen() {
  const { user } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch<AppDispatch>();

  const insets = useSafeAreaInsets();
  const { language, setLanguage, t } = useLanguage();
  const [showPwForm, setShowPwForm] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);

  const [deviceName, setDeviceName] = useState<string | null>(null);

  useEffect(() => {
    DeviceInfo.getDeviceName().then(setDeviceName).catch(() => {});
  }, []);

  // Edit profile
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name ?? '');
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const handleOpenEditProfile = () => {
    setEditName(user?.name ?? '');
    setPendingPhotoUri(null);
    setProfileError(null);
    haptics.selection();
    setShowEditProfile(true);
  };

  const uploadToCloudinary = async (uri: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', { uri, type: 'image/jpeg', name: 'profile.jpg' } as any);
    formData.append('upload_preset', CLOUDINARY_CONFIG.UPLOAD_PRESET);
    formData.append('folder', `${CLOUDINARY_CONFIG.FOLDER}/profiles`);
    const res = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/image/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data.secure_url;
  };

  const handlePickPhoto = () => {
    haptics.selection();
    launchImageLibrary(
      { mediaType: 'photo' as MediaType, quality: 0.7, selectionLimit: 1 },
      (res) => handlePickerResponse(res)
    );
  };

  const handlePickerResponse = async (res: ImagePickerResponse) => {
    if (res.didCancel) return;
    if (res.errorCode) {
      haptics.error();
      console.error('[Image picker error]', res.errorCode, res.errorMessage);
      setProfileError(
        res.errorCode === 'permission'
          ? 'Allow photo library access in your phone Settings to change your profile picture.'
          : (res.errorMessage || 'Could not open photos. Please try again.')
      );
      return;
    }
    const uri = res.assets?.[0]?.uri;
    if (!uri) {
      setProfileError('No photo selected. Please try again.');
      return;
    }
    setProfileError(null);
    setPhotoUploading(true);
    try {
      const url = await uploadToCloudinary(uri);
      setPendingPhotoUri(url);
      haptics.success();
    } catch (err: any) {
      haptics.error();
      const detail = err?.response?.data?.error?.message || err?.message || 'Unknown error';
      console.error('[Cloudinary upload error]', detail, err?.response?.data);
      setProfileError(`Upload failed: ${detail}`);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setProfileError('Please enter your name.');
      return;
    }
    setProfileError(null);
    haptics.medium();
    setProfileSaving(true);
    try {
      const updates: { name?: string; profilePhoto?: string } = {};
      if (editName.trim() !== user?.name) updates.name = editName.trim();
      if (pendingPhotoUri) updates.profilePhoto = pendingPhotoUri;
      if (!updates.name && !updates.profilePhoto) {
        setShowEditProfile(false);
        return;
      }
      const updated = await authService.updateProfile(user!.id, updates);
      dispatch(setUser({ ...user!, ...updates, name: updated.name, profilePhoto: updated.profilePhoto }));
      haptics.success();
      setShowEditProfile(false);
      showAlert('Saved', 'Profile updated successfully.');
    } catch (err: any) {
      haptics.error();
      setProfileError(err.response?.data?.error || 'Could not save profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogout = () => {
    haptics.heavy();
    showAlert(
      t('signOut'),
      t('signOutConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('signOut'),
          style: 'destructive',
          onPress: () => { haptics.heavy(); dispatch(logoutUser()); },
        },
      ]
    );
  };

  const handleChangePassword = async () => {
    if (!oldPw || !newPw || !confirmPw) {
      showAlert('Missing Fields', 'Please fill in all password fields.');
      return;
    }
    if (newPw.length < 8) {
      showAlert('Weak Password', 'New password must be at least 8 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      showAlert('Mismatch', 'New passwords do not match.');
      return;
    }
    haptics.medium();
    setPwLoading(true);
    try {
      await authService.changePassword(user!.id, oldPw, newPw);
      haptics.success();
      showAlert('Success', 'Password changed successfully.');
      setOldPw(''); setNewPw(''); setConfirmPw('');
      setShowPwForm(false);
    } catch (err: any) {
      haptics.error();
      showAlert('Error', err.response?.data?.error || 'Could not change password.');
    } finally {
      setPwLoading(false);
    }
  };

  const roleColor = { admin: COLORS.admin, moderator: COLORS.moderator, staff: COLORS.staff }[user?.role ?? 'staff'];
  const roleBg = { admin: COLORS.adminBg, moderator: COLORS.moderatorBg, staff: COLORS.staffBg }[user?.role ?? 'staff'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top }]}>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <TouchableOpacity onPress={handleOpenEditProfile} activeOpacity={0.85}>
          <View style={[styles.avatar, { backgroundColor: roleBg }]}>
            {user?.profilePhoto
              ? <Image source={{ uri: user.profilePhoto }} style={styles.avatarImage} />
              : <Text style={[styles.avatarText, { color: roleColor }]}>{user?.name?.charAt(0).toUpperCase() || 'U'}</Text>}
            <View style={styles.editPhotoOverlay}><Text style={styles.editPhotoIcon}>✏️</Text></View>
          </View>
        </TouchableOpacity>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName} numberOfLines={1}>{user?.name}</Text>
          <View style={styles.profileNameRow}>
            <View style={[styles.roleBadge, { backgroundColor: roleBg }]}>
              <Text style={[styles.roleText, { color: roleColor }]}>{user?.role?.toUpperCase()}</Text>
            </View>
            <TouchableOpacity style={styles.editProfileBtn} onPress={handleOpenEditProfile}>
              <Text style={styles.editProfileBtnText}>{t('editProfile')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.profilePhone}>+91 {user?.phone}</Text>
          {user?.stallName && <Text style={styles.profileStall}>📍 {user.stallName}</Text>}
        </View>
      </View>

      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>{t('security').toUpperCase()}</Text>

        <TouchableOpacity
          style={styles.row}
          onPress={() => setShowPwForm((v) => !v)}
        >
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>🔑</Text>
            <Text style={styles.rowLabel}>{t('changePassword')}</Text>
          </View>
          <Text style={styles.rowChevron}>{showPwForm ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showPwForm && (
          <View style={styles.pwForm}>
            <PwField label={t('currentPassword')} value={oldPw} onChange={setOldPw} />
            <PwField label={t('newPassword')} value={newPw} onChange={setNewPw} />
            <PwField label={t('confirmPassword')} value={confirmPw} onChange={setConfirmPw} />
            <TouchableOpacity
              style={[styles.pwBtn, pwLoading && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              disabled={pwLoading}
            >
              {pwLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.pwBtnText}>{t('updatePassword')}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>{t('notificationsSection').toUpperCase()}</Text>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>🔔</Text>
            <View>
              <Text style={styles.rowLabel}>{t('pushNotifications')}</Text>
              <Text style={styles.rowSub}>{t('pushNotificationsSub')}</Text>
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
        <Text style={styles.sectionHeader}>{t('accountSection').toUpperCase()}</Text>
        <View style={[styles.row, styles.rowDisabled]}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>📱</Text>
            <View>
              <Text style={styles.rowLabel}>{t('deviceBinding')}</Text>
              <Text style={styles.rowSub}>
                {user?.role === 'staff'
                  ? (user?.deviceId ? t('boundToDevice') : t('notBound'))
                  : 'Not required for admins'}
              </Text>
              {user?.role === 'staff' && user?.deviceId && deviceName ? (
                <Text style={[styles.rowSub, { color: COLORS.medium, marginTop: 1 }]}>{deviceName}</Text>
              ) : null}
            </View>
          </View>
          {user?.role === 'staff' ? (
            <View style={[styles.deviceBadge, { backgroundColor: user?.deviceId ? COLORS.successBg : COLORS.warningBg }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: user?.deviceId ? COLORS.success : COLORS.warning }}>
                {user?.deviceId ? 'ACTIVE' : 'UNBOUND'}
              </Text>
            </View>
          ) : (
            <View style={[styles.deviceBadge, { backgroundColor: COLORS.surface }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.muted }}>N/A</Text>
            </View>
          )}
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>{t('aboutSection').toUpperCase()}</Text>
        <View style={[styles.row, styles.rowDisabled]}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>ℹ️</Text>
            <Text style={styles.rowLabel}>ChaistoOps</Text>
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
        <Text style={styles.logoutText}>{t('signOut')}</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>{t('secured')}</Text>

      {/* ── Edit Profile Modal ─────────────────────────────────────────────── */}
      <Modal visible={showEditProfile} animationType="slide" transparent onRequestClose={() => setShowEditProfile(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('editProfile')}</Text>
              <TouchableOpacity onPress={() => setShowEditProfile(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {profileError && (
              <View style={styles.profileErrorBanner}>
                <Text style={styles.profileErrorText}>⚠️ {profileError}</Text>
              </View>
            )}

            {/* Avatar preview */}
            <View style={styles.editAvatarWrap}>
              <View style={[styles.editAvatar, { backgroundColor: roleBg }]}>
                {(pendingPhotoUri || user?.profilePhoto)
                  ? <Image source={{ uri: pendingPhotoUri ?? user!.profilePhoto! }} style={styles.editAvatarImage} />
                  : <Text style={[styles.editAvatarText, { color: roleColor }]}>{editName.charAt(0).toUpperCase() || 'U'}</Text>}
              </View>
              <TouchableOpacity style={styles.cameraBtn} onPress={handlePickPhoto} disabled={photoUploading}>
                {photoUploading
                  ? <ActivityIndicator color={COLORS.primary} size="small" />
                  : <Text style={styles.cameraBtnText}>📷  {t('changePhoto')}</Text>}
              </TouchableOpacity>
            </View>

            {/* Name field */}
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t('displayName')}</Text>
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                placeholder={t('displayName')}
                placeholderTextColor={COLORS.muted}
                autoCapitalize="words"
                maxLength={50}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, profileSaving && { opacity: 0.6 }]}
              onPress={handleSaveProfile}
              disabled={profileSaving}
            >
              {profileSaving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>{t('saveChanges')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
        </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

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

  avatarImage: { width: 64, height: 64, borderRadius: BORDER_RADIUS.full },
  editPhotoOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: COLORS.primary, borderRadius: 10, width: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  editPhotoIcon: { fontSize: 10 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4, flexWrap: 'wrap' },
  editProfileBtn: {
    backgroundColor: COLORS.primaryBg, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: COLORS.primary, transform: [{ translateY: -2 }],
  },
  editProfileBtnText: { fontSize: 11, color: COLORS.primary, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: SPACING.xl, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xl },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.black },
  modalClose: { fontSize: 20, color: COLORS.muted, fontWeight: '700' },

  profileErrorBanner: {
    backgroundColor: COLORS.dangerBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.danger,
  },
  profileErrorText: { fontSize: FONT_SIZE.sm, color: COLORS.danger, fontWeight: '600', lineHeight: 20 },

  editAvatarWrap: { alignItems: 'center', marginBottom: SPACING.xl },
  editAvatar: {
    width: 88, height: 88, borderRadius: BORDER_RADIUS.full,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md,
  },
  editAvatarImage: { width: 88, height: 88, borderRadius: BORDER_RADIUS.full },
  editAvatarText: { fontSize: 36, fontWeight: '800' },
  cameraBtn: {
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cameraBtnText: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '700' },

  editField: { marginBottom: SPACING.lg },
  editLabel: { fontSize: FONT_SIZE.sm, color: COLORS.dark, fontWeight: '600', marginBottom: 6 },
  editInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.md, color: COLORS.black, backgroundColor: COLORS.surface,
  },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.sm,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },

});
