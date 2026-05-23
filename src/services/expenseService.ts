import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../constants';
import { Expense } from '../types';

const api = axios.create({ baseURL: API_CONFIG.BASE_URL, timeout: API_CONFIG.TIMEOUT });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('chaisto_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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
