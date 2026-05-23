import axios from 'axios';
import { API_CONFIG } from '../constants';
import { WastageLog, WastageItem } from '../types';
import { authService } from './authService';

const api = axios.create({ baseURL: API_CONFIG.BASE_URL, timeout: API_CONFIG.TIMEOUT });

api.interceptors.request.use(async (config) => {
  const token = await authService.getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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
