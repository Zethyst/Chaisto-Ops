// authSlice reaches for the API and the keychain at import time — stub both and
// drive the thunk through the mocked service.
jest.mock('../../../services/authService', () => ({
  authService: {
    getStoredToken: jest.fn(),
    validateToken: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    bindDevice: jest.fn(),
    storeCredentials: jest.fn(),
  },
}));
jest.mock('../../../services/deviceService', () => ({
  deviceService: { getDeviceId: jest.fn(), getDeviceName: jest.fn() },
}));

import reducer, { refreshSession } from '../authSlice';
import { authService } from '../../../services/authService';

const svc = authService as jest.Mocked<any>;

const signedIn = {
  user: { id: 'u1', name: 'Ravi', role: 'staff' },
  token: 'stored-token',
  isAuthenticated: true,
  isLoading: false,
  error: null,
  deviceBound: true,
};

/** Runs the thunk against a state and returns the actions it dispatched. */
const runRefresh = async (state: any) => {
  const actions: any[] = [];
  const dispatch = (a: any) => (typeof a === 'function' ? a(dispatch, () => state, undefined) : (actions.push(a), a));
  await refreshSession()(dispatch, () => state, undefined);
  return actions;
};

/** An axios-shaped rejection, as the interceptor would surface it. */
const httpError = (status?: number) => Object.assign(new Error('request failed'), {
  isAxiosError: true,
  response: status ? { status, data: {} } : undefined,
});

beforeEach(() => jest.clearAllMocks());

describe('refreshSession', () => {
  it('refreshes the account details when the server confirms the token', async () => {
    svc.getStoredToken.mockResolvedValue('stored-token');
    svc.validateToken.mockResolvedValue({ id: 'u1', name: 'Ravi', role: 'staff', deviceId: 'd1' });

    const actions = await runRefresh(signedIn);
    const next = reducer(signedIn as any, actions[actions.length - 1]);

    expect(next.isAuthenticated).toBe(true);
    expect(next.user).toMatchObject({ name: 'Ravi' });
  });

  it('keeps the staff member signed in when the server cannot be reached', async () => {
    // A stall with no signal, or the first request of the day to a sleeping
    // server — neither says anything about whether the account is still good
    svc.getStoredToken.mockResolvedValue('stored-token');
    svc.validateToken.mockRejectedValue(httpError());

    const actions = await runRefresh(signedIn);
    const next = reducer(signedIn as any, actions[actions.length - 1]);

    expect(next.isAuthenticated).toBe(true);
    expect(next.token).toBe('stored-token');
  });

  it('keeps the session through a server error too', async () => {
    svc.getStoredToken.mockResolvedValue('stored-token');
    svc.validateToken.mockRejectedValue(httpError(500));

    const actions = await runRefresh(signedIn);
    expect(reducer(signedIn as any, actions[actions.length - 1]).isAuthenticated).toBe(true);
  });

  it('signs out when the server refuses the token', async () => {
    svc.getStoredToken.mockResolvedValue('stored-token');
    svc.validateToken.mockRejectedValue(httpError(401));

    const actions = await runRefresh(signedIn);
    const next = reducer(signedIn as any, actions[actions.length - 1]);

    expect(next.isAuthenticated).toBe(false);
    expect(next.user).toBeNull();
  });

  it('signs out when the account is disabled or the device no longer matches', async () => {
    svc.getStoredToken.mockResolvedValue('stored-token');
    svc.validateToken.mockRejectedValue(httpError(403));

    const actions = await runRefresh(signedIn);
    expect(reducer(signedIn as any, actions[actions.length - 1]).isAuthenticated).toBe(false);
  });

  it('signs out when there is no stored token at all', async () => {
    svc.getStoredToken.mockResolvedValue(null);

    const actions = await runRefresh(signedIn);
    const next = reducer(signedIn as any, actions[actions.length - 1]);

    expect(next.isAuthenticated).toBe(false);
    expect(svc.validateToken).not.toHaveBeenCalled();
  });
});
