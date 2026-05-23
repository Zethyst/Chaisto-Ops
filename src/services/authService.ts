import axios from 'axios';
import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { API_CONFIG } from '../constants';
import { User } from '../types';

const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: __DEV__ ? API_CONFIG.TIMEOUT : 60000, // 60s in prod to survive Render cold starts
});

// Attach token to every request
api.interceptors.request.use(async (config) => {
  const token = await authService.getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authService = {
  async login(phone: string, password: string, deviceId: string): Promise<{ user: User; token: string }> {
    const response = await api.post('/auth/login', { phone, password, deviceId });
    return response.data;
  },

  async bindDevice(userId: string, deviceId: string, token: string, deviceName?: string): Promise<void> {
    await api.post('/auth/bind-device', { userId, deviceId, deviceName }, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  async validateToken(token: string): Promise<User> {
    const response = await api.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  async storeCredentials(token: string): Promise<void> {
    // JWT must be readable silently for axios interceptors. Biometric `accessControl`
    // requires NSFaceIDUsageDescription and prompts on read — omit it; rely on OS keychain.
    await Keychain.setGenericPassword('chaisto_token', token, {
      service: 'com.chaisto.ops',
      ...(Platform.OS === 'ios'
        ? { accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }
        : {}),
    });
  },

  async getStoredToken(): Promise<string | null> {
    try {
      const creds = await Keychain.getGenericPassword({ service: 'com.chaisto.ops' });
      return creds ? creds.password : null;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {}
    await Keychain.resetGenericPassword({ service: 'com.chaisto.ops' });
  },

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { userId, oldPassword, newPassword });
  },

  async updateProfile(userId: string, data: { name?: string; profilePhoto?: string }): Promise<User> {
    const response = await api.patch(`/users/${userId}/profile`, data);
    return response.data;
  },

  async createStaffAccount(data: {
    name: string;
    phone: string;
    role: string;
    stallId: string;
    password: string;
  }): Promise<User> {
    const response = await api.post('/auth/create-user', data);
    return response.data;
  },

  async toggleUserStatus(userId: string, isActive: boolean): Promise<void> {
    await api.patch(`/users/${userId}`, { isActive });
  },

  async getUsers(): Promise<User[]> {
    const response = await api.get('/users');
    return response.data;
  },

  async getStalls(): Promise<{ id: string; name: string; address?: string }[]> {
    const response = await api.get('/stalls');
    return response.data;
  },

  async resetDevice(userId: string): Promise<void> {
    await api.post('/auth/reset-device', { userId });
  },

  async updateFCMToken(token: string): Promise<void> {
    await api.patch('/auth/fcm-token', { fcmToken: token });
  },
};
