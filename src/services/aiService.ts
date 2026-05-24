import axios from 'axios';
import { API_CONFIG } from '../constants';
import { authService } from './authService';
import { MenuItem } from '../types';

const api = axios.create({ baseURL: API_CONFIG.BASE_URL, timeout: 25000 });

api.interceptors.request.use(async (config) => {
  const token = await authService.getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const aiService = {
  async getDailyTip(stallId?: string): Promise<string> {
    const { data } = await api.post('/ai/daily-tip', { stallId });
    return data.tip as string;
  },

  async getFlagNarrative(reportId: string): Promise<string> {
    const { data } = await api.post('/ai/flag-narrative', { reportId });
    return data.narrative as string;
  },

  async getInventoryAlert(stallId?: string): Promise<{ alert: string; milkPacketsNeeded: number; avgPacketsPerDay: number }> {
    const { data } = await api.post('/ai/inventory-alert', { stallId });
    return data;
  },

  async getPriceOptimizations(stallId: string | undefined, menuItems: MenuItem[]): Promise<Array<{
    itemKey: string;
    itemName: string;
    currentPrice: number;
    suggestedPrice: number;
    reason: string;
  }>> {
    const { data } = await api.post('/ai/price-optimize', { stallId, menuItems });
    return data.suggestions ?? [];
  },
};
