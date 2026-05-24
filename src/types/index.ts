export type UserRole = 'admin' | 'moderator' | 'staff';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  stallId?: string;
  stallName?: string;
  deviceId?: string;
  deviceName?: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  profilePhoto?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  deviceBound: boolean;
}

export interface Stall {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  staffIds: string[];
  moderatorId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minThreshold: number;
  lastUpdated: string;
  stallId: string;
}

export interface DailyReport {
  id: string;
  stallId: string;
  staffId: string;
  staffName: string;
  date: string;
  submittedAt: string;

  openingStock: {
    milk: number;        // litres
    sugar: number;       // kg
    teaLeaves: number;   // grams
    cups: number;        // paper cup count
    kulhadCups: number;  // kulhad cup count
  };

  purchases: {
    milk: number;        // litres
    snacks: number;      // ₹
  };

  sales: {
    regularCups: number;
    specialCups: number;
    kulhadCups: number;
    snacks: number;      // ₹
  };

  payments: {
    upi: number;         // ₹
    cash: number;        // ₹
  };

  closingStock: {
    milk: number;
    sugar: number;
    teaLeaves: number;
    cups: number;
    kulhadCups: number;
  };

  photos: {
    cash: string;
    cartClosing: string;
    stock: string;
    milkPacket: string;
  };

  location: {
    latitude: number;
    longitude: number;
  };

  computed: {
    totalRevenue: number;
    expectedCupsFromMilk: number;
    milkUsed: number;
    revenuePerCup: number;
    upiRatio: number;
  };

  flags: SuspicionFlag[];
  status: 'draft' | 'submitted' | 'reviewed' | 'flagged';
}

export interface SuspicionFlag {
  type: 'milk_mismatch' | 'revenue_mismatch' | 'low_upi' | 'sales_drop' | 'location_mismatch' | 'missing_report';
  severity: 'low' | 'medium' | 'high';
  message: string;
  value?: number;
  expectedValue?: number;
}

export interface PhotoCapture {
  uri: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  deviceId: string;
  stallName: string;
  category: 'cash' | 'cart_closing' | 'stock' | 'milk_packet';
  watermarked: boolean;
}

export interface AnalyticsSummary {
  totalCups: number;
  totalRevenue: number;
  upiRevenue: number;
  cashRevenue: number;
  avgCupsPerDay: number;
  avgRevenuePerDay: number;
  suspicionCount: number;
  reportsMissed: number;
  topStaff: { name: string; cups: number; revenue: number }[];
  dailyData: { date: string; cups: number; revenue: number }[];
}

export interface Notification {
  id: string;
  type: 'report_submitted' | 'suspicious_activity' | 'missing_report' | 'low_stock' | 'reminder';
  title: string;
  message: string;
  userId: string;
  stallId?: string;
  reportId?: string;
  read: boolean;
  createdAt: string;
}

export interface Expense {
  id: string;
  stallId: string;
  loggedBy: string;
  loggedByName: string;
  category: 'gas' | 'supplies' | 'maintenance' | 'equipment' | 'other';
  amount: number;
  description?: string;
  date: string;
  createdAt: string;
}

export interface WastageItem {
  item: 'milk' | 'sugar' | 'teaLeaves' | 'cups' | 'other';
  quantity: number;
  unit: string;
  reason: 'expired' | 'spilled' | 'unsold' | 'damaged' | 'other';
}

export interface WastageLog {
  id: string;
  stallId: string;
  loggedBy: string;
  loggedByName: string;
  date: string;
  items: WastageItem[];
  totalEstimatedLoss: number;
  notes?: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  stallId: string;
  date: string;
  status: 'present' | 'absent' | 'halfday' | 'leave';
  leaveType?: 'sick' | 'casual' | 'unpaid' | null;
  notes?: string;
  markedBy: string;
  markedByName: string;
}

export interface PayrollSummary {
  staffId: string;
  staffName: string;
  stallName?: string;
  baseSalary: number;
  totalCups: number;
  cupsIncentive: number;
  totalRevenue: number;
  reportCount: number;
  totalPay: number;
  month: string;
  attendance?: {
    presentDays: number;
    halfdayDays: number;
    leaveDays: number;
    absentDays: number;
  };
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, any>;
  ip?: string;
  createdAt: string;
}

export interface MenuItem {
  key: string;
  name: string;
  price: number;
  active: boolean;
  sortOrder: number;
  isDefault?: boolean;
  recipe?: string;
}

export interface StallConfig {
  stallId: string;
  milkMismatchThresholdPct: number;
  upiMinRatioPct: number;
  salesDropThresholdPct: number;
  locationRadiusMeters: number;
  missingReportAlertHour: number;
  cupsIncentivePerCup: number;
  menuItems?: MenuItem[];
  updatedByName?: string;
  updatedAt?: string;
}

export type RootStackParamList = {
  Login: undefined;
  AdminDashboard: undefined;
  ModeratorDashboard: undefined;
  StaffDashboard: undefined;
  DailyReport: undefined;
  CameraCapture: { category: PhotoCapture['category'] };
  StaffManagement: undefined;
  InventoryManagement: undefined;
  Analytics: undefined;
  StallMap: undefined;
  Notifications: undefined;
  Settings: undefined;
  ReportDetail: { reportId: string };
  AddStaff: undefined;
  ExpenseTracker: undefined;
  WastageLog: undefined;
  PnLReport: undefined;
  AuditLog: undefined;
  AlertsConfig: { stallId: string; stallName: string };
  Attendance: undefined;
  Payroll: undefined;
};
