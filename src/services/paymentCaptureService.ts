import { NativeModules, Platform } from 'react-native';
import { createApiClient } from './apiClient';
import { deviceService } from './deviceService';
import { toISODate } from '../utils/date';

const api = createApiClient();

/**
 * UPI payments seen arriving on this phone.
 *
 * The Android side reads payment-app notifications and keeps only the ones that
 * say money was received; nothing else on the phone is looked at or stored.
 * There is no iOS equivalent — iOS gives no app access to another app's
 * notifications or to SMS — so everything here is a no-op there.
 */
const native = Platform.OS === 'android' ? NativeModules.PaymentCapture : null;

export interface CapturedPayment {
  id: string;
  app: string;
  amount: number;
  title: string;
  text: string;
  /** Epoch milliseconds, from the phone that saw the notification */
  capturedAt: number;
}

export interface PaymentSyncResult {
  supported: boolean;
  enabled: boolean;
  /** Whether Android actually has the listener bound right now */
  connected: boolean;
  synced: number;
}

export interface PaymentCaptureHealth {
  supported: boolean;
  /** Notification access granted */
  enabled: boolean;
  /** The service is bound — on MIUI this can be false while enabled is true */
  connected: boolean;
  /** The phone has been told not to put Chaisto to sleep */
  batteryUnrestricted: boolean;
}

export const paymentCaptureService = {
  /** Whether this build and platform can capture payments at all. */
  isSupported(): boolean {
    return !!native;
  },

  /**
   * Whether the staff member has granted notification access. Android has no
   * API to grant it, so the app can only ever ask and then check.
   */
  async isEnabled(): Promise<boolean> {
    if (!native) return false;
    try {
      return await native.isEnabled();
    } catch {
      return false;
    }
  },

  /**
   * What is actually working, as opposed to what has been granted. MIUI and
   * other aggressive builds keep the permission while killing the service, so
   * the two are asked separately.
   */
  async health(): Promise<PaymentCaptureHealth> {
    if (!native) {
      return { supported: false, enabled: false, connected: false, batteryUnrestricted: false };
    }
    const [enabled, listener, batteryUnrestricted] = await Promise.all([
      this.isEnabled(),
      native.getListenerState().catch(() => ({ connected: false })),
      native.isBatteryUnrestricted().catch(() => false),
    ]);
    return {
      supported: true,
      enabled,
      connected: enabled && !!listener?.connected,
      batteryUnrestricted: !!batteryUnrestricted,
    };
  },

  /** Asks the phone to stop putting Chaisto to sleep. */
  async requestBatteryUnrestricted(): Promise<void> {
    if (!native) return;
    try {
      await native.requestBatteryUnrestricted();
    } catch {
      // Some builds refuse the screen — the autostart page is the other route
    }
  },

  /** Opens the vendor's autostart list (MIUI's Security app and equivalents). */
  async openAutostartSettings(): Promise<void> {
    if (!native) return;
    try {
      await native.openAutostartSettings();
    } catch {
      // Vendor screen missing — nothing further to try
    }
  },

  /** Opens Android's notification-access screen. */
  async openSettings(): Promise<void> {
    if (!native) return;
    try {
      await native.openSettings();
    } catch {
      // The screen is missing on some builds of Android — nothing to recover
    }
  },

  /**
   * Sends the captures held on the device, and reports whether monitoring is
   * still switched on. Only what the server confirms is cleared from the phone,
   * so a failed sync leaves the captures to go again next time.
   */
  async sync(): Promise<PaymentSyncResult> {
    if (!native) return { supported: false, enabled: false, connected: false, synced: 0 };

    const { enabled, connected } = await this.health();

    let pending: CapturedPayment[] = [];
    try {
      pending = (await native.getPending()) ?? [];
    } catch {
      pending = [];
    }

    const captures = pending.map((c) => ({
      ...c,
      // The stall's own day, taken from the phone that saw the payment — the
      // server must not re-derive it from a UTC clock
      date: toISODate(new Date(c.capturedAt)),
    }));

    try {
      const deviceId = await deviceService.getDeviceId();
      const { data } = await api.post('/payment-captures', {
        enabled, connected, captures, deviceId,
      });
      const accepted: string[] = data?.accepted ?? [];
      if (accepted.length) await native.clearPending(accepted);
      return { supported: true, enabled, connected, synced: accepted.length };
    } catch {
      // Nothing is cleared, so the captures are still on the phone to retry
      return { supported: true, enabled, connected, synced: 0 };
    }
  },
};
