import { createApiClient } from './apiClient';
import { AttendanceRecord } from '../types';

const api = createApiClient();

export const attendanceService = {
  async getAttendance(params: { stallId?: string; userId?: string; month?: string }): Promise<AttendanceRecord[]> {
    const response = await api.get('/attendance', { params });
    return response.data ?? [];
  },

  async getAttendanceSummary(params: { stallId?: string; month: string }): Promise<any[]> {
    const response = await api.get('/attendance/summary', { params });
    return response.data ?? [];
  },

  async markAttendance(data: {
    userId: string;
    userName: string;
    stallId: string;
    date: string;
    status: AttendanceRecord['status'];
    leaveType?: AttendanceRecord['leaveType'];
    notes?: string;
  }): Promise<AttendanceRecord> {
    const response = await api.post('/attendance', data);
    return response.data;
  },

  async updateAttendance(id: string, data: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    const response = await api.patch(`/attendance/${id}`, data);
    return response.data;
  },
};
