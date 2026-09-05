// The client is built from axios and the keychain, neither of which exists in a
// test runtime — stub both and drive the interceptor the instance registers.
const mockRequestHandlers: any[] = [];
const mockErrorHandlers: any[] = [];
const mockRequest = jest.fn();
const mockCreated: any[] = [];

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn((config: any) => {
      mockCreated.push(config);
      return {
        request: mockRequest,
        interceptors: {
          request: { use: (fn: any) => mockRequestHandlers.push(fn) },
          response: { use: (_ok: any, fn: any) => mockErrorHandlers.push(fn) },
        },
      };
    }),
  },
}));
jest.mock('../authToken', () => ({ getStoredToken: jest.fn(async () => 'jwt-token') }));

import { createApiClient } from '../apiClient';
import { API_CONFIG } from '../../constants';

const onError = () => mockErrorHandlers[mockErrorHandlers.length - 1];
const timedOut = (method = 'get') => ({ code: 'ECONNABORTED', config: { method, url: '/reports' } });

beforeEach(() => {
  mockRequestHandlers.length = 0;
  mockErrorHandlers.length = 0;
  mockCreated.length = 0;
  mockRequest.mockReset().mockResolvedValue({ data: 'ok' });
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

/** Runs the rejection handler, letting the retry's backoff timer fire. */
async function handle(error: any) {
  const pending = onError()(error);
  await Promise.resolve();
  jest.runAllTimers();
  return pending;
}

describe('request timeout', () => {
  it('leaves the configured timeout alone in development', () => {
    createApiClient();
    expect(mockCreated[0].timeout).toBe(API_CONFIG.TIMEOUT);
  });

  it('takes the caller\'s longer timeout when one is given', () => {
    createApiClient({ timeout: 25000 });
    expect(mockCreated[0].timeout).toBe(25000);
  });
});

describe('retrying a read', () => {
  it('retries a timed-out GET instead of surfacing the failure', async () => {
    createApiClient();
    await expect(handle(timedOut())).resolves.toEqual({ data: 'ok' });
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('retries a gateway that is still waking up', async () => {
    createApiClient();
    const error = { config: { method: 'get' }, response: { status: 503 } };
    await expect(handle(error)).resolves.toEqual({ data: 'ok' });
  });

  it('gives up after the configured number of attempts', async () => {
    createApiClient();
    const error: any = timedOut();
    error.config._retryCount = API_CONFIG.RETRY_ATTEMPTS;
    await expect(handle(error)).rejects.toBe(error);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('counts each attempt, so a retry loop cannot run forever', async () => {
    createApiClient();
    const error: any = timedOut();
    await handle(error);
    expect(error.config._retryCount).toBe(1);
  });
});

describe('not retried', () => {
  it('never replays a write — a resent report would be filed twice', async () => {
    createApiClient();
    const error = timedOut('post');
    await expect(handle(error)).rejects.toBe(error);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('passes a real answer from the server straight through', async () => {
    createApiClient();
    const error = { config: { method: 'get' }, response: { status: 404 } };
    await expect(handle(error)).rejects.toBe(error);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('passes an auth failure through rather than hammering the API', async () => {
    createApiClient();
    const error = { config: { method: 'get' }, response: { status: 401 } };
    await expect(handle(error)).rejects.toBe(error);
  });
});

describe('auth header', () => {
  it('attaches the stored token to every request', async () => {
    createApiClient();
    const config = await mockRequestHandlers[0]({ headers: {} });
    expect(config.headers.Authorization).toBe('Bearer jwt-token');
  });
});
