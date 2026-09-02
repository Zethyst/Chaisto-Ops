import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

export const COLORS = {
  // Brand
  primary: '#C17B2F',
  primaryDark: '#8B5E1A',
  primaryLight: '#E8C27A',
  primaryBg: '#FBF6EE',

  // Semantic
  success: '#1D9E75',
  successBg: '#E1F5EE',
  danger: '#E24B4A',
  dangerBg: '#FCEBEB',
  warning: '#BA7517',
  warningBg: '#FAEEDA',
  info: '#378ADD',
  infoBg: '#E6F1FB',

  // Neutrals
  black: '#1A1A1A',
  dark: '#2C2C2A',
  medium: '#5F5E5A',
  muted: '#888780',
  border: '#D3D1C7',
  borderLight: '#F1EFE8',
  surface: '#F8F6F2',
  white: '#FFFFFF',

  // Role colors
  admin: '#533AB7',
  adminBg: '#EEEDFE',
  moderator: '#0F6E56',
  moderatorBg: '#E1F5EE',
  staff: '#185FA5',
  staffBg: '#E6F1FB',
};

export const DARK_COLORS = {
  primary: '#E8C27A',
  primaryDark: '#C17B2F',
  primaryLight: '#8B5E1A',
  primaryBg: '#2C1A08',
  black: '#F5F2EC',
  dark: '#E8E6E0',
  medium: '#B4B2A9',
  muted: '#888780',
  border: '#444441',
  borderLight: '#2C2C2A',
  surface: '#1E1D1A',
  white: '#0F0E0C',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 40,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
};

// Chai brewing constants for anti-cheat (kept in its own file — see brew.ts)
export { BREW_CONSTANTS } from './brew';

export const ADMIN_CREDENTIALS = {
  phone: '8318876136',
  // Password set during onboarding — NOT hardcoded here
  // Default password emailed/shown once on first login
  defaultPassword: 'Chaisto@Admin2024',
  role: 'admin' as const,
};

/** Backend port (match `PORT` in backend `.env`). */
const DEV_API_PORT = 8000;

/**
 * Your dev machine LAN IP — used **only on physical phones** when they need to reach `localhost` on
 * your PC (same Wi‑Fi). Example: `192.168.1.3`.
 *
 * Simulators/emulators ignore this automatically: Android emulator → `10.0.2.2`, iOS Simulator → `localhost`.
 */
export const DEV_API_LAN_HOST = '192.168.1.3';

function resolveDevApiBaseUrl(): string {
  const path = `/v1`;
  const lan = DEV_API_LAN_HOST.trim();
  /** Simulators cannot use your PC's LAN IP; Android emulator maps the host loopback to 10.0.2.2. */
  const onSimulatorOrEmulator = DeviceInfo.isEmulatorSync();

  if (Platform.OS === 'android') {
    if (onSimulatorOrEmulator) {
      return `http://10.0.2.2:${DEV_API_PORT}${path}`;
    }
    return lan.length > 0
      ? `http://${lan}:${DEV_API_PORT}${path}`
      : `http://10.0.2.2:${DEV_API_PORT}${path}`;
  }

  // iOS: simulator uses Mac localhost; physical device needs LAN IP of the dev machine.
  if (onSimulatorOrEmulator) {
    return `http://localhost:${DEV_API_PORT}${path}`;
  }
  return lan.length > 0
    ? `http://${lan}:${DEV_API_PORT}${path}`
    : `http://localhost:${DEV_API_PORT}${path}`;
}

export const API_CONFIG = {
  BASE_URL: __DEV__ ? resolveDevApiBaseUrl() : 'https://chaisto-ops.onrender.com/v1',
  TIMEOUT: 15000,
  RETRY_ATTEMPTS: 3,
};

export const CLOUDINARY_CONFIG = {
  CLOUD_NAME: 'chaisto',
  UPLOAD_PRESET: 'chaisto_reports',
  FOLDER: 'daily-reports',
};

export const REPORT_STEPS = [
  'Opening Stock',
  'Purchases',
  'Sales Entry',
  'Payments',
  'Closing Stock',
  'Photos',
  'Submit',
];

export const PHOTO_CATEGORIES = [
  { key: 'cash', label: 'Cash Photo', icon: 'cash', required: true },
  { key: 'stock', label: 'Stock Photo', icon: 'package', required: true },
  { key: 'milkPacket', label: 'Milk Packets', icon: 'droplets', required: true },
  { key: 'cartClosing', label: 'Cart Closing', icon: 'store', required: false },
] as const;

export const REQUIRED_PHOTO_CATEGORIES = PHOTO_CATEGORIES.filter(c => c.required);
