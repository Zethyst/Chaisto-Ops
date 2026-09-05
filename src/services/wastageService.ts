import { createApiClient } from './apiClient';
import { WastageLog, WastageItem } from '../types';

const api = createApiClient();

export const wastageService = {
  async getWastageLogs(params: { stallId?: string; month?: string }): Promise<WastageLog[]> {
    const response = await api.get('/wastage', { params });
    return response.data ?? [];
  },

  async logWastage(data: {
    stallId: string;
    date: string;
    items: WastageItem[];
    notes?: string;
  }): Promise<WastageLog> {
    const response = await api.post('/wastage', data);
    return response.data;
  },

  async updateEstimatedLoss(id: string, totalEstimatedLoss: number): Promise<WastageLog> {
    const response = await api.patch(`/wastage/${id}/loss`, { totalEstimatedLoss });
    return response.data;
  },
};
