import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../constants';
import { AuditLogEntry } from '../types';

const api = axios.create({ baseURL: API_CONFIG.BASE_URL, timeout: API_CONFIG.TIMEOUT });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('chaisto_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const auditService = {
  async getLogs(params: { action?: string; actorId?: string; page?: number }): Promise<{
    logs: AuditLogEntry[];
    total: number;
    page: number;
    pages: number;
  }> {
    const response = await api.get('/audit-logs', { params });
    return response.data;
  },
};
