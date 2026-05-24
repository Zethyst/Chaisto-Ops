import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  PermissionsAndroid, Platform,
} from 'react-native';
import { showAlert } from '../../components/AppAlert';
import { launchCamera } from 'react-native-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { addPhoto } from '../../store/slices/reportSlice';
import { reportService } from '../../services/reportService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants';
import { haptics } from '../../utils/haptics';

const CATEGORY_LABELS: Record<string, string> = {
  cash: 'Cash Photo',
  cartClosing: 'Cart Closing Photo',
  stock: 'Stock Photo',
  milkPacket: 'Milk Packet Photo',
};

const CATEGORY_HINTS: Record<string, string> = {
  cash: 'Capture the cash tray/drawer clearly',
  cartClosing: 'Show the cart is locked and closed',
  stock: 'All remaining stock items in frame',
  milkPacket: 'Milk packets with quantities visible',
};

export default function CameraCaptureScreen({ navigation, route }: any) {
  const { category } = route.params;
  const { user } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch();
  const [uploading, setUploading] = useState(false);

  const capturePhoto = async () => {
    haptics.medium();

    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'ChaistoOps needs camera access to capture report photos.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        showAlert('Camera Permission', 'Please allow camera access in Settings to capture photos.', [{ text: 'OK' }]);
        return;
      }
    }

    try {
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        saveToPhotos: false,
        includeBase64: false,
        cameraType: 'back',
      });

      if (result.didCancel) return;

      if (result.errorCode) {
        if (result.errorCode === 'camera_unavailable') {
          showAlert('Camera Unavailable', 'No camera found on this device.');
        } else if (result.errorCode === 'permission') {
          showAlert('Camera Permission', 'Please allow camera access in Settings to capture photos.', [
            { text: 'OK' },
          ]);
        } else {
          showAlert('Camera Error', result.errorMessage || 'Could not open camera. Try again.');
        }
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        showAlert('Capture Failed', 'No photo was captured. Please try again.');
        return;
      }

      haptics.heavy();
      setUploading(true);

      const uploadedUrl = await reportService.uploadPhoto(
        asset.uri,
        category,
        user?.stallName || 'Chaisto'
      );

      dispatch(addPhoto({ category, uri: uploadedUrl }));
      haptics.success();
      showAlert('Photo Captured!', `${CATEGORY_LABELS[category]} saved successfully.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      haptics.error();
      showAlert('Upload Failed', err.message || 'Could not save photo. Check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => { haptics.light(); navigation.goBack(); }}
          disabled={uploading}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{CATEGORY_LABELS[category]?.toUpperCase()}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>📷</Text>
        </View>
        <Text style={styles.title}>{CATEGORY_LABELS[category]}</Text>
        <Text style={styles.hint}>{CATEGORY_HINTS[category] || 'Take a clear photo'}</Text>

        <View style={styles.rulesBox}>
          <Text style={styles.rulesTitle}>PHOTO GUIDELINES</Text>
          <Text style={styles.rule}>• Ensure good lighting before capturing</Text>
          <Text style={styles.rule}>• Keep the camera steady to avoid blur</Text>
          <Text style={styles.rule}>• Include all relevant items in frame</Text>
          <Text style={styles.rule}>• Gallery uploads are disabled for security</Text>
        </View>
      </View>

      {/* Capture Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.captureBtn, uploading && styles.captureBtnDisabled]}
          onPress={capturePhoto}
          disabled={uploading}
          activeOpacity={0.85}
        >
          {uploading ? (
            <>
              <ActivityIndicator color="#fff" size="small" style={{ marginRight: SPACING.sm }} />
              <Text style={styles.captureBtnText}>Uploading photo...</Text>
            </>
          ) : (
            <Text style={styles.captureBtnText}>📷  Open Camera</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: 50, paddingBottom: SPACING.lg,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: COLORS.dark, fontSize: 22, fontWeight: '700' },
  categoryBadge: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: 6,
  },
  categoryText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  icon: { fontSize: 48, textAlign: 'center', lineHeight: 64 },
  title: {
    fontSize: FONT_SIZE.xxl, fontWeight: '800', color: COLORS.black,
    marginBottom: SPACING.sm, textAlign: 'center',
  },
  hint: {
    fontSize: FONT_SIZE.md, color: COLORS.medium, textAlign: 'center',
    marginBottom: SPACING.xl, lineHeight: 22,
  },
  rulesBox: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, width: '100%', borderWidth: 1, borderColor: COLORS.border,
  },
  rulesTitle: {
    fontSize: 11, fontWeight: '700', color: COLORS.primaryLight,
    marginBottom: SPACING.md, letterSpacing: 1.5,
  },
  rule: { fontSize: FONT_SIZE.sm, color: COLORS.medium, marginBottom: 6, lineHeight: 20 },
  footer: {
    padding: SPACING.xl, backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  captureBtn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', minHeight: 56,
    borderWidth: 1, borderColor: COLORS.primaryLight,
    shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 6, elevation: 3,
  },
  captureBtnDisabled: { opacity: 0.5 },
  captureBtnText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '800' },
});
