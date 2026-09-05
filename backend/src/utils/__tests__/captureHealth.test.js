const { captureHealth, isReporting, STALE_AFTER_HOURS } = require('../captureHealth');

const now = new Date('2026-09-05T18:00:00.000Z');
const hoursAgo = (h) => new Date(now.getTime() - h * 36e5);

describe('captureHealth', () => {
  it('is reporting when the phone is granted, bound and checking in', () => {
    expect(captureHealth(
      { enabled: true, listenerConnected: true, lastSyncAt: hoursAgo(1) }, now,
    )).toBe('reporting');
  });

  it('is blocked when notification access was switched off', () => {
    expect(captureHealth(
      { enabled: false, listenerConnected: false, lastSyncAt: hoursAgo(1) }, now,
    )).toBe('blocked');
  });

  it('is killed when the permission is granted but the service is not running', () => {
    // What a Redmi looks like once MIUI has cleaned the app out of memory
    expect(captureHealth(
      { enabled: true, listenerConnected: false, lastSyncAt: hoursAgo(1) }, now,
    )).toBe('killed');
  });

  it('is stale when the phone has stopped checking in', () => {
    expect(captureHealth(
      { enabled: true, listenerConnected: true, lastSyncAt: hoursAgo(STALE_AFTER_HOURS + 1) }, now,
    )).toBe('stale');
  });

  it('still counts a phone as reporting just inside the window', () => {
    expect(captureHealth(
      { enabled: true, listenerConnected: true, lastSyncAt: hoursAgo(STALE_AFTER_HOURS - 1) }, now,
    )).toBe('reporting');
  });

  it('is never for a phone that has not been set up', () => {
    expect(captureHealth(undefined, now)).toBe('never');
    expect(captureHealth({ enabled: false }, now)).toBe('never');
  });

  it('treats an older app that sends no connected flag as running', () => {
    // Only an explicit false means the service is down
    expect(captureHealth(
      { enabled: true, lastSyncAt: hoursAgo(1) }, now,
    )).toBe('reporting');
  });

  it('reports being switched off ahead of the service being down', () => {
    // Nothing was granted, so "killed" would be misleading
    expect(captureHealth(
      { enabled: false, listenerConnected: false, lastSyncAt: hoursAgo(1) }, now,
    )).toBe('blocked');
  });
});

describe('isReporting', () => {
  it('is true only when captures can be trusted to be complete', () => {
    expect(isReporting({ enabled: true, listenerConnected: true, lastSyncAt: hoursAgo(2) }, now)).toBe(true);
    expect(isReporting({ enabled: true, listenerConnected: false, lastSyncAt: hoursAgo(2) }, now)).toBe(false);
  });
});
