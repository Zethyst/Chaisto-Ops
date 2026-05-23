import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../constants';
import { StallConfig } from '../types';

const api = axios.create({ baseURL: API_CONFIG.BASE_URL, timeout: API_CONFIG.TIMEOUT });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('chaisto_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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
