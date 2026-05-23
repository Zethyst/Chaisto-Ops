import { Platform } from 'react-native';
import { notificationService } from './notificationService';

// Lazy-load to avoid crashes when Firebase isn't fully configured
let messagingModule: any = null;
const getMessaging = () => {
  if (!messagingModule) {
    try {
      messagingModule = require('@react-native-firebase/messaging').default;
    } catch {
      return null;
    }
  }
  return messagingModule;
};

export const fcmService = {
  async requestPermission(): Promise<boolean> {
    const messaging = getMessaging();
    if (!messaging) return false;
    try {
      if (Platform.OS === 'ios') {
        const status = await messaging().requestPermission();
        return (
          status === messaging.AuthorizationStatus.AUTHORIZED ||
          status === messaging.AuthorizationStatus.PROVISIONAL
        );
      }
      return true;
    } catch {
      return false;
    }
  },

  async getToken(): Promise<string | null> {
    const messaging = getMessaging();
    if (!messaging) return null;
    try {
      return await messaging().getToken();
    } catch {
      return null;
    }
  },

  async registerToken(): Promise<void> {
    const granted = await fcmService.requestPermission();
    if (!granted) return;
    const token = await fcmService.getToken();
    if (token) {
      try {
        await notificationService.updateFCMToken(token);
      } catch {
        // Fails silently if backend isn't available — token will be registered next time
      }
    }
  },

  onMessage(handler: (notification: { title?: string; body?: string; data?: any }) => void) {
    const messaging = getMessaging();
    if (!messaging) return () => {};
    return messaging().onMessage(async (msg: any) => {
      handler({
        title: msg.notification?.title,
        body: msg.notification?.body,
        data: msg.data,
      });
    });
  },

  setupBackgroundHandler() {
    const messaging = getMessaging();
    if (!messaging) return;
    try {
      messaging().setBackgroundMessageHandler(async () => {});
    } catch {}
  },
};
