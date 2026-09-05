// Only Platform and NativeModules are used from react-native here, so the
// module is stubbed rather than pulling the whole runtime into the test. The
// stubs are built inside the factories — a jest.mock factory runs while the
// imports below are still being resolved, before any const here is assigned.
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: {
    PaymentCapture: {
      isEnabled: jest.fn(),
      getListenerState: jest.fn(),
      isBatteryUnrestricted: jest.fn(),
      getPending: jest.fn(),
      clearPending: jest.fn(),
      openSettings: jest.fn(),
    },
  },
}));
jest.mock('../apiClient', () => {
  // One instance, shared with the test — the service builds its client at import
  const post = jest.fn();
  return { createApiClient: () => ({ post }), __post: post };
});
jest.mock('../deviceService', () => ({
  deviceService: { getDeviceId: jest.fn(async () => 'device-1') },
}));

import { NativeModules } from 'react-native';
import { paymentCaptureService } from '../paymentCaptureService';

const mockNative = (NativeModules as any).PaymentCapture;
const mockPost = (require('../apiClient') as any).__post;

// 4 Sept 2026, 3:06pm — a payment taken during a shift
const capturedAt = new Date(2026, 8, 4, 15, 6).getTime();
const capture = {
  id: 'com.phonepe.app_1_120',
  app: 'com.phonepe.app',
  amount: 120,
  title: 'Received ₹120',
  text: 'from a customer',
  capturedAt,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNative.isEnabled.mockResolvedValue(true);
  mockNative.getListenerState.mockResolvedValue({ connected: true, changedAt: 0 });
  mockNative.isBatteryUnrestricted.mockResolvedValue(true);
  mockNative.getPending.mockResolvedValue([capture]);
  mockNative.clearPending.mockResolvedValue(true);
  mockPost.mockResolvedValue({ data: { accepted: [capture.id] } });
});

describe('sync', () => {
  it('sends the captures held on the phone with the monitoring state', async () => {
    const result = await paymentCaptureService.sync();

    expect(mockPost).toHaveBeenCalledWith('/payment-captures', expect.objectContaining({
      enabled: true,
      connected: true,
      deviceId: 'device-1',
    }));
    expect(result).toEqual({ supported: true, enabled: true, connected: true, synced: 1 });
  });

  it('stamps each capture with the stall\'s own day, not a UTC one', async () => {
    await paymentCaptureService.sync();
    const [, body] = mockPost.mock.calls[0];
    expect(body.captures[0].date).toBe('2026-09-04');
    expect(body.captures[0].amount).toBe(120);
  });

  it('clears only what the server accepted', async () => {
    mockNative.getPending.mockResolvedValue([capture, { ...capture, id: 'other' }]);
    mockPost.mockResolvedValue({ data: { accepted: [capture.id] } });

    await paymentCaptureService.sync();

    expect(mockNative.clearPending).toHaveBeenCalledWith([capture.id]);
  });

  it('keeps the captures on the phone when the upload fails', async () => {
    mockPost.mockRejectedValue(new Error('offline'));

    const result = await paymentCaptureService.sync();

    expect(mockNative.clearPending).not.toHaveBeenCalled();
    expect(result.synced).toBe(0);
  });

  it('reports monitoring being switched off even with nothing to send', async () => {
    mockNative.isEnabled.mockResolvedValue(false);
    mockNative.getListenerState.mockResolvedValue({ connected: false, changedAt: 0 });
    mockNative.getPending.mockResolvedValue([]);
    mockPost.mockResolvedValue({ data: { accepted: [] } });

    const result = await paymentCaptureService.sync();

    expect(mockPost).toHaveBeenCalledWith('/payment-captures', expect.objectContaining({
      enabled: false,
      captures: [],
    }));
    expect(result.enabled).toBe(false);
  });

  it('treats a phone that cannot list its captures as having none', async () => {
    mockNative.getPending.mockRejectedValue(new Error('no service'));

    await paymentCaptureService.sync();

    expect(mockPost.mock.calls[0][1].captures).toEqual([]);
  });

  it('does not call clearPending when the server accepted nothing', async () => {
    mockPost.mockResolvedValue({ data: { accepted: [] } });
    await paymentCaptureService.sync();
    expect(mockNative.clearPending).not.toHaveBeenCalled();
  });
});

describe('a phone that killed the listener', () => {
  it('reports granted-but-not-running, so a silent day is not mistaken for a clean one', async () => {
    // MIUI keeps the permission and stops the service; the phone must say so
    mockNative.getListenerState.mockResolvedValue({ connected: false, changedAt: 0 });
    mockNative.getPending.mockResolvedValue([]);
    mockPost.mockResolvedValue({ data: { accepted: [] } });

    const result = await paymentCaptureService.sync();

    expect(mockPost).toHaveBeenCalledWith('/payment-captures', expect.objectContaining({
      enabled: true,
      connected: false,
    }));
    expect(result.connected).toBe(false);
  });

  it('treats the listener state being unreadable as not running', async () => {
    mockNative.getListenerState.mockRejectedValue(new Error('no service'));
    expect((await paymentCaptureService.health()).connected).toBe(false);
  });
});

describe('isEnabled', () => {
  it('is false when the native side cannot answer', async () => {
    mockNative.isEnabled.mockRejectedValue(new Error('boom'));
    expect(await paymentCaptureService.isEnabled()).toBe(false);
  });
});

describe('on a platform without capture', () => {
  it('does nothing and says so, rather than failing', async () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'ios' }, NativeModules: {} }));

    const { paymentCaptureService: iosService } = require('../paymentCaptureService');

    expect(iosService.isSupported()).toBe(false);
    expect(await iosService.sync()).toEqual({
      supported: false, enabled: false, connected: false, synced: 0,
    });
    expect(await iosService.isEnabled()).toBe(false);
    expect(mockPost).not.toHaveBeenCalled();
  });
});
