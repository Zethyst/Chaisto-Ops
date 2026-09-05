import { createApiClient } from './apiClient';
import { StallConfig } from '../types';

const api = createApiClient();

export const stallConfigService = {
  async getConfig(stallId: string): Promise<StallConfig> {
    const response = await api.get(`/stall-config/${stallId}`);
    return response.data;
  },

  async updateConfig(stallId: string, data: Partial<Omit<StallConfig, 'stallId'>>): Promise<StallConfig> {
    const response = await api.patch(`/stall-config/${stallId}`, data);
    return response.data;
  },
};
