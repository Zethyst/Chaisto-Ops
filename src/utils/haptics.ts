import { Vibration, Platform } from 'react-native';
import { trigger, HapticFeedbackTypes } from 'react-native-haptic-feedback';

const OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

function vibrateFallback(pattern: number | number[]) {
  if (Platform.OS === 'android') {
    Vibration.vibrate(Array.isArray(pattern) ? pattern : pattern);
    return;
  }
  Vibration.vibrate(Array.isArray(pattern) ? 10 : (pattern as number));
}

/** Core haptics where supported (iOS Taptic Engine, Android VibratorComposer); catches + vibrates on failure */
function pulse(type: (typeof HapticFeedbackTypes)[keyof typeof HapticFeedbackTypes]) {
  try {
    trigger(type, OPTIONS);
  } catch {
    // Rare native edge cases — keep tactile feedback roughly aligned
    if (type === HapticFeedbackTypes.selection) vibrateFallback(8);
    else if (type === HapticFeedbackTypes.impactLight) vibrateFallback(12);
    else if (type === HapticFeedbackTypes.impactMedium) vibrateFallback(22);
    else if (type === HapticFeedbackTypes.impactHeavy) vibrateFallback(40);
    else if (type === HapticFeedbackTypes.notificationSuccess) {
      vibrateFallback(Platform.OS === 'android' ? [0, 12, 60, 12] : 15);
    } else if (type === HapticFeedbackTypes.notificationError) {
      vibrateFallback(Platform.OS === 'android' ? [0, 40, 80, 40] : 35);
    }
  }
}

export const haptics = {
  /** Tab changes, filter chips, list item taps */
  selection: () => pulse(HapticFeedbackTypes.selection),
  /** Standard button presses */
  light: () => pulse(HapticFeedbackTypes.impactLight),
  /** Toggle switches, confirm actions */
  medium: () => pulse(HapticFeedbackTypes.impactMedium),
  /** Destructive or critical actions (logout, delete) */
  heavy: () => pulse(HapticFeedbackTypes.impactHeavy),
  /** Successful submission, creation */
  success: () => pulse(HapticFeedbackTypes.notificationSuccess),
  /** Validation error, failed action */
  error: () => pulse(HapticFeedbackTypes.notificationError),
};
