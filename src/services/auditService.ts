import { createApiClient } from './apiClient';
import { AuditLogEntry } from '../types';

const api = createApiClient();

export const auditService = {
  async getLogs(params: { action?: string; actorId?: string; page?: number }): Promise<{
    logs: AuditLogEntry[];
    total: number;
    page: number;
    pages: number;
  }> {
    const response = await api.get('/audit-logs', { params });
    return response.data;
  },
};
