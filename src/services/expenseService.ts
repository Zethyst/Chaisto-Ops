import { createApiClient } from './apiClient';
import { Expense } from '../types';

const api = createApiClient();

export const expenseService = {
  async getExpenses(params: { stallId?: string; month?: string }): Promise<Expense[]> {
    const response = await api.get('/expenses', { params });
    return response.data ?? [];
  },

  async logExpense(data: {
    stallId: string;
    category: Expense['category'];
    amount: number;
    description?: string;
    date: string;
  }): Promise<Expense> {
    const response = await api.post('/expenses', data);
    return response.data;
  },

  async deleteExpense(id: string): Promise<void> {
    await api.delete(`/expenses/${id}`);
  },
};
