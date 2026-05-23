import axios from 'axios';
import { API_CONFIG } from '../constants';
import { AttendanceRecord } from '../types';
import { authService } from './authService';

const api = axios.create({ baseURL: API_CONFIG.BASE_URL, timeout: API_CONFIG.TIMEOUT });

api.interceptors.request.use(async (config) => {
  const token = await authService.getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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
