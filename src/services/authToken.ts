import * as Keychain from 'react-native-keychain';
import { Platform } from 'react-native';

// The JWT lives in the OS keychain and is read on every request, so it is kept
// in its own module: the API client needs it, and the API client is what
// authService is built on — importing authService from there would be a cycle.
const KEYCHAIN_SERVICE = 'com.chaisto.ops';

export async function storeToken(token: string): Promise<void> {
  // The JWT must be readable silently for the request interceptor. Biometric
  // `accessControl` requires NSFaceIDUsageDescription and prompts on read —
  // omit it; rely on OS keychain protection.
  await Keychain.setGenericPassword('chaisto_token', token, {
    service: KEYCHAIN_SERVICE,
    ...(Platform.OS === 'ios'
      ? { accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }
      : {}),
  });
}

export async function getStoredToken(): Promise<string | null> {
  try {
    const creds = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    return creds ? creds.password : null;
  } catch {
    return null;
  }
}

export async function clearToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
}
