import { createApiClient } from './apiClient';
import { InventoryItem } from '../types';

const api = createApiClient();

export interface InventoryTransaction {
  _id: string;
  type: 'supply' | 'usage' | 'adjustment';
  quantity: number;
  notes?: string;
  createdAt: string;
  itemId: { name: string; unit: string };
  createdBy: { name: string };
}

export const inventoryService = {
  async getItems(stallId: string): Promise<InventoryItem[]> {
    const response = await api.get(`/inventory/${stallId}`);
    return response.data;
  },

  async createItem(data: {
    stallId: string;
    name: string;
    unit: string;
    minThreshold: number;
    currentStock?: number;
  }): Promise<InventoryItem> {
    const response = await api.post('/inventory', data);
    return response.data;
  },

  async addSupply(itemId: string, quantity: number, notes?: string): Promise<InventoryItem> {
    const response = await api.post(`/inventory/${itemId}/supply`, { quantity, notes });
    return response.data;
  },

  async recordUsage(itemId: string, quantity: number, reportId?: string): Promise<InventoryItem> {
    const response = await api.post(`/inventory/${itemId}/usage`, { quantity, reportId });
    return response.data;
  },

  async getTransactions(stallId: string): Promise<InventoryTransaction[]> {
    const response = await api.get(`/inventory/${stallId}/transactions`);
    return response.data;
  },
};
