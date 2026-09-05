import { User } from '../types';
import { createApiClient } from './apiClient';
import { storeToken, getStoredToken, clearToken } from './authToken';

const api = createApiClient();

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

  // The keychain itself lives in authToken, so the API client can read the JWT
  // without importing this module
  storeCredentials: storeToken,

  getStoredToken,

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {}
    await clearToken();
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

  async updateStaffStall(userId: string, stallId: string | null, stallName: string | null): Promise<void> {
    await api.patch(`/users/${userId}`, { stallId: stallId ?? '', stallName: stallName ?? '' });
  },

  async createStall(data: { name: string; address?: string; latitude: number; longitude: number; allowedRadiusMeters?: number }): Promise<{ id: string; name: string }> {
    const response = await api.post('/stalls', data);
    return response.data;
  },

  async updateStall(id: string, data: Partial<{ name: string; address: string; latitude: number; longitude: number; allowedRadiusMeters: number; isActive: boolean }>): Promise<void> {
    await api.patch(`/stalls/${id}`, data);
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
