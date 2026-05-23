import { Vibration, Platform } from 'react-native';

// On Android, Vibration works with distinct durations.
// On iOS, Vibration always produces the same buzz — for proper Taptic Engine
// feedback, install react-native-haptic-feedback and swap the body below.
const vibe = (ms: number | number[]) => {
  if (Platform.OS === 'android') {
    Vibration.vibrate(ms as number);
  } else {
    Vibration.vibrate(Array.isArray(ms) ? 10 : ms);
  }
};

export const haptics = {
  /** Tab changes, filter chips, list item taps */
  selection: () => vibe(8),
  /** Standard button presses */
  light: () => vibe(12),
  /** Toggle switches, confirm actions */
  medium: () => vibe(22),
  /** Destructive or critical actions (logout, delete) */
  heavy: () => vibe(40),
  /** Successful submission, creation */
  success: () => vibe(Platform.OS === 'android' ? [0, 12, 60, 12] : 15),
  /** Validation error, failed action */
  error: () => vibe(Platform.OS === 'android' ? [0, 40, 80, 40] : 35),
};
