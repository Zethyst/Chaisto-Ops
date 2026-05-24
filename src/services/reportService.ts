import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, CLOUDINARY_CONFIG } from '../constants';
import { DailyReport } from '../types';

import { authService } from './authService';

const api = axios.create({ baseURL: API_CONFIG.BASE_URL, timeout: API_CONFIG.TIMEOUT });

api.interceptors.request.use(async (config) => {
  const token = await authService.getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const OFFLINE_QUEUE_KEY = 'chaisto_offline_queue';
const REPORT_CACHE_KEY = 'chaisto_report_cache';
const REPORT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const reportService = {
  async submitReport(report: DailyReport): Promise<DailyReport> {
    const response = await api.post('/reports', report);
    return response.data;
  },

  async getReportsByDate(date: string): Promise<DailyReport[]> {
    const response = await api.get('/reports', { params: { date, limit: 100 } });
    return response.data?.reports ?? response.data ?? [];
  },

  async getReports({ stallId, days, staffId }: { stallId?: string; days?: number; staffId?: string }): Promise<DailyReport[]> {
    const cacheKey = `${REPORT_CACHE_KEY}_${staffId || ''}_${stallId || ''}_${days || 30}`;
    try {
      const params: any = { days };
      if (stallId) params.stallId = stallId;
      if (staffId) params.staffId = staffId;
      const response = await api.get('/reports', { params });
      const reports = response.data?.reports ?? response.data ?? [];
      // Cache successful response
      await AsyncStorage.setItem(cacheKey, JSON.stringify({ reports, cachedAt: Date.now() }));
      return reports;
    } catch {
      // Network failed — try cache
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const { reports, cachedAt } = JSON.parse(cached);
          if (Date.now() - cachedAt < REPORT_CACHE_TTL_MS * 48) { // 24h stale tolerance
            return reports;
          }
        }
      } catch {}
      return [];
    }
  },

  async getReportsCached(staffId: string, days: number = 30): Promise<{ reports: DailyReport[]; fromCache: boolean }> {
    const cacheKey = `${REPORT_CACHE_KEY}_${staffId}_${days}`;
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const { reports, cachedAt } = JSON.parse(cached);
        const stale = Date.now() - cachedAt > REPORT_CACHE_TTL_MS;
        if (!stale) return { reports, fromCache: true };
      }
    } catch {}
    try {
      const reports = await this.getReports({ staffId, days });
      return { reports, fromCache: false };
    } catch {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const { reports } = JSON.parse(cached);
          return { reports, fromCache: true };
        }
      } catch {}
      return { reports: [], fromCache: false };
    }
  },

  async getTodayReport(staffId: string): Promise<DailyReport | null> {
    const today = new Date().toISOString().split('T')[0];
    const response = await api.get(`/reports/today`, { params: { staffId, date: today } });
    return response.data || null;
  },

  async getReportById(reportId: string): Promise<DailyReport> {
    const response = await api.get(`/reports/${reportId}`);
    return response.data;
  },

  async uploadPhoto(uri: string, category: string, stallName: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', { uri, type: 'image/jpeg', name: `${category}_${Date.now()}.jpg` } as any);
    formData.append('upload_preset', CLOUDINARY_CONFIG.UPLOAD_PRESET);
    formData.append('folder', `${CLOUDINARY_CONFIG.FOLDER}/${stallName}`);
    formData.append('tags', [category, stallName, new Date().toISOString().split('T')[0]].join(','));

    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/image/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.secure_url;
  },

  async queueOfflineReport(report: DailyReport): Promise<void> {
    const existing = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: DailyReport[] = existing ? JSON.parse(existing) : [];
    queue.push(report);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  },

  async syncOfflineReports(): Promise<number> {
    const existing = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!existing) return 0;
    const queue: DailyReport[] = JSON.parse(existing);
    let synced = 0;

    for (const report of queue) {
      try {
        await api.post('/reports', report);
        synced++;
      } catch {}
    }

    if (synced > 0) {
      const remaining = queue.slice(synced);
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    }
    return synced;
  },

  async getAnalytics(params: { stallId?: string; days: number }): Promise<any> {
    const response = await api.get('/reports/analytics/summary', { params });
    return response.data;
  },

  async getSuspicionAlerts(stallId?: string): Promise<any[]> {
    const response = await api.get('/reports/flags', { params: { stallId } });
    return response.data;
  },
};
