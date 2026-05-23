import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Platform,
} from 'react-native';
import { RNCamera } from 'react-native-camera';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { addPhoto } from '../../store/slices/reportSlice';
import { deviceService } from '../../services/deviceService';
import { reportService } from '../../services/reportService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants';
import { haptics } from '../../utils/haptics';

const CATEGORY_LABELS: Record<string, string> = {
  cash: 'Cash Photo',
  cartClosing: 'Cart Closing Photo',
  stock: 'Stock Photo',
  milkPacket: 'Milk Packet Photo',
};

export default function CameraCaptureScreen({ navigation, route }: any) {
  const { category } = route.params;
  const cameraRef = useRef<RNCamera>(null);
  const { user } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch();
  const [capturing, setCapturing] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    (async () => {
      const granted = await deviceService.requestCameraPermission();
      setHasPermission(granted);
      if (!granted) Alert.alert('Camera Required', 'Please enable camera permission in Settings.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    })();
  }, []);

  const capturePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    haptics.heavy();
    setCapturing(true);

    try {
      const location = await deviceService.getCurrentLocation().catch(() => ({ latitude: 0, longitude: 0 }));
      const deviceId = await deviceService.getDeviceId();
      const now = new Date();
      const timestamp = now.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });

      // Capture with watermark text overlay (drawn via camera overlay)
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: true,
        fixOrientation: true,
      });

      // Upload to Cloudinary with metadata
      const uploadedUrl = await reportService.uploadPhoto(
        photo.uri,
        category,
        user?.stallName || 'Chaisto'
      );

      dispatch(addPhoto({ category, uri: uploadedUrl }));
      haptics.success();
      Alert.alert('Photo Captured!', `${CATEGORY_LABELS[category]} saved successfully.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      haptics.error();
      Alert.alert('Capture Failed', err.message || 'Could not save photo. Try again.');
    } finally {
      setCapturing(false);
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.permError}>
        <Text style={styles.permText}>Camera permission denied</Text>
      </View>
    );
  }

  const now = new Date();
  const watermarkDate = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const watermarkTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.container}>
      <RNCamera
        ref={cameraRef}
        style={styles.camera}
        type={RNCamera.Constants.Type.back}
        flashMode={RNCamera.Constants.FlashMode.auto}
        captureAudio={false}
        androidCameraPermissionOptions={{
          title: 'Camera Required',
          message: 'ChaistOps needs camera access to capture report photos.',
          buttonPositive: 'Allow',
        }}
      >
        {/* Top overlay */}
        <View style={styles.topOverlay}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => { haptics.light(); navigation.goBack(); }}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{CATEGORY_LABELS[category]?.toUpperCase()}</Text>
          </View>
        </View>

        {/* Watermark */}
        <View style={styles.watermarkOverlay}>
          <Text style={styles.watermarkText}>CHAISTO OPS | {user?.stallName || 'Civil Lines'}</Text>
          <Text style={styles.watermarkText}>{watermarkDate}  {watermarkTime}</Text>
          <Text style={styles.watermarkText}>{CATEGORY_LABELS[category]}</Text>
        </View>

        {/* Frame guide — gold corners */}
        <View style={styles.frameGuide}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        {/* Capture button */}
        <View style={styles.captureArea}>
          <Text style={styles.captureHint}>Gallery uploads are disabled for security</Text>
          <TouchableOpacity
            style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
            onPress={capturePhoto}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </TouchableOpacity>
          <Text style={styles.captureHint}>Tap to capture</Text>
        </View>
      </RNCamera>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  permError: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  permText: { color: '#fff', fontSize: FONT_SIZE.lg },
  topOverlay: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: 50, paddingBottom: SPACING.lg,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  categoryBadge: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: 6,
  },
  categoryText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  watermarkOverlay: {
    position: 'absolute', bottom: 140, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  watermarkText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontFamily: 'monospace', letterSpacing: 0.5 },
  frameGuide: { position: 'absolute', top: 120, left: 40, right: 40, bottom: 200 },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: COLORS.primary, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  captureArea: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 40, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)',
  },
  captureHint: { color: 'rgba(255,255,255,0.7)', fontSize: FONT_SIZE.sm, marginVertical: SPACING.sm },
  captureBtn: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  captureBtnDisabled: { opacity: 0.5 },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
});
