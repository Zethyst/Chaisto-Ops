import { createApiClient } from './apiClient';
import { Notification } from '../types';

const api = createApiClient();

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
