import { createApiClient } from './apiClient';
import { MenuItem } from '../types';

// AI answers are slow by nature, so the floor is higher than the app default
const api = createApiClient({ timeout: 25000 });

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
