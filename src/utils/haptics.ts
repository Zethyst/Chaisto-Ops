import { Vibration, Platform } from 'react-native';

// Dynamic require so a missing native module (not yet pod-installed) never crashes the app at import time.
let _trigger: ((type: string, opts?: object) => void) | null = null;
let _types: Record<string, string> | null = null;
try {
  const mod = require('react-native-haptic-feedback');
  _trigger = mod.trigger;
  _types = mod.HapticFeedbackTypes;
} catch {}

const OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

function vibrateFallback(pattern: number | number[]) {
  Vibration.vibrate(Array.isArray(pattern) ? pattern : pattern as number);
}

function pulse(type: string, fallbackMs: number | number[]) {
  try {
    if (_trigger && _types) {
      _trigger(_types[type] ?? type, OPTIONS);
      return;
    }
  } catch {}
  vibrateFallback(fallbackMs);
}

export const haptics = {
  selection: () => pulse('selection', Platform.OS === 'android' ? 8 : 8),
  light:     () => pulse('impactLight', 12),
  medium:    () => pulse('impactMedium', 22),
  heavy:     () => pulse('impactHeavy', 40),
  success:   () => pulse('notificationSuccess', Platform.OS === 'android' ? [0, 12, 60, 12] : 15),
  error:     () => pulse('notificationError', Platform.OS === 'android' ? [0, 40, 80, 40] : 35),
};
