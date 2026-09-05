import { createApiClient } from './apiClient';

const api = createApiClient();

export interface CapturedPaymentRow {
  _id: string;
  app: string;
  amount: number;
  title?: string;
  text?: string;
  capturedAt: string;
}

export interface StaffPaymentSummary {
  staffId: string;
  staffName: string;
  hasReport: boolean;
  monitoring: {
    enabled: boolean;
    lastSyncAt: string | null;
    /** Granted is not the same as running — see the backend's captureHealth */
    health: 'reporting' | 'blocked' | 'killed' | 'stale' | 'never';
    healthLabel: string;
  };
  /** What the staff phone recorded receiving */
  capturedTotal: number;
  capturedCount: number;
  /** What that day's report says was taken by UPI */
  declaredUpi: number;
  /** Captured minus declared — positive means money the report leaves out */
  undeclared: number;
  mismatch: boolean;
  captures: CapturedPaymentRow[];
}

export interface PaymentDaySummary {
  date: string;
  staff: StaffPaymentSummary[];
  totals: {
    captured: number;
    declared: number;
    unaccounted: number;
    notReporting: number;
  };
}

/** The admin's view of UPI collected on staff phones vs what the reports declare. */
export const paymentMonitorService = {
  async getDaySummary(date: string, stallId?: string): Promise<PaymentDaySummary> {
    const { data } = await api.get('/payment-captures/summary', { params: { date, stallId } });
    return data;
  },
};
