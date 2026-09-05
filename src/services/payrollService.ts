import { createApiClient } from './apiClient';
import { PayrollSummary } from '../types';

const api = createApiClient();

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
