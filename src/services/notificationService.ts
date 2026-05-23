import axios from 'axios';
import { API_CONFIG } from '../constants';
import { Notification } from '../types';
import { authService } from './authService';

const api = axios.create({ baseURL: API_CONFIG.BASE_URL, timeout: API_CONFIG.TIMEOUT });

api.interceptors.request.use(async (config) => {
  const token = await authService.getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const notificationService = {
  async getNotifications(): Promise<{ notifications: Notification[]; unreadCount: number }> {
    const response = await api.get('/notifications');
    return response.data;
  },

  async markAsRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await api.patch('/notifications/read-all');
  },

  async updateFCMToken(token: string): Promise<void> {
    await api.patch('/auth/fcm-token', { fcmToken: token });
  },
};
