import axios from 'axios';
import { API_CONFIG } from '../constants';
import { PayrollSummary } from '../types';
import { authService } from './authService';

const api = axios.create({ baseURL: API_CONFIG.BASE_URL, timeout: API_CONFIG.TIMEOUT });

api.interceptors.request.use(async (config) => {
  const token = await authService.getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const payrollService = {
  async getMyPayroll(month: string): Promise<PayrollSummary> {
    const response = await api.get('/payroll/me', { params: { month } });
    return response.data;
  },

  async getAllPayroll(params: { month: string; stallId?: string }): Promise<PayrollSummary[]> {
    const response = await api.get('/payroll', { params });
    return response.data ?? [];
  },

  async setSalary(userId: string, monthlySalary: number): Promise<{ id: string; name: string; monthlySalary: number }> {
    const response = await api.patch(`/payroll/salary/${userId}`, { monthlySalary });
    return response.data;
  },
};
