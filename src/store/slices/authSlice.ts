import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { AuthState, User } from '../../types';
import { API_CONFIG } from '../../constants';
import { authService } from '../../services/authService';
import { deviceService } from '../../services/deviceService';

function loginErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : 'Login failed';
  }
  if (!error.response) {
    if (__DEV__) {
      return `Cannot reach the API at ${API_CONFIG.BASE_URL}. Check: backend is running, Mac firewall allows inbound, and on a physical phone you are on the same Wi-Fi with the correct LAN IP.`;
    }
    if (error.code === 'ECONNABORTED') {
      return 'The server is taking too long to respond. It may be starting up — please wait a moment and try again.';
    }
    return 'Cannot reach the server. Please check your internet connection and try again.';
  }
  const data = error.response.data as { error?: string; errors?: { msg?: string }[] };
  if (typeof data?.error === 'string') return data.error;
  const first = data?.errors?.[0]?.msg;
  if (first) return first;
  return error.message || 'Login failed';
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  deviceBound: false,
};

export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ phone, password }: { phone: string; password: string }, { rejectWithValue }) => {
    try {
      const [deviceId, deviceName] = await Promise.all([
        deviceService.getDeviceId(),
        deviceService.getDeviceName(),
      ]);
      const result = await authService.login(phone, password, deviceId);

      // Device binding check for staff
      if (result.user.role === 'staff') {
        if (result.user.deviceId && result.user.deviceId !== deviceId) {
          return rejectWithValue('This account is bound to another device. Contact admin.');
        }
        // Bind device on first login, then reflect it locally so Redux Persist stores the right value
        if (!result.user.deviceId) {
          await authService.bindDevice(result.user.id, deviceId, result.token, deviceName);
          result.user = { ...result.user, deviceId, deviceName };
        }
      }

      await authService.storeCredentials(result.token);
      return { ...result, deviceId };
    } catch (error: unknown) {
      return rejectWithValue(loginErrorMessage(error));
    }
  }
);

export const logoutUser = createAsyncThunk('auth/logout', async (_, { getState }) => {
  await authService.logout();
  return null;
});

export const refreshSession = createAsyncThunk('auth/refresh', async (_, { rejectWithValue }) => {
  try {
    const token = await authService.getStoredToken();
    if (!token) throw new Error('No session found');
    const user = await authService.validateToken(token);
    return { user, token };
  } catch {
    return rejectWithValue('Session expired');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    setUser: (state, action: PayloadAction<User>) => { state.user = action.payload; },
    updateDeviceBound: (state, action: PayloadAction<boolean>) => {
      state.deviceBound = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.deviceBound = !!action.payload.user.deviceId;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        return initialState;
      })
      .addCase(refreshSession.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.deviceBound = !!action.payload.user.deviceId;
      })
      .addCase(refreshSession.rejected, (state) => {
        return initialState;
      });
  },
});

export const { clearError, setUser, updateDeviceBound } = authSlice.actions;
export default authSlice.reducer;
