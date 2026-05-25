import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { refreshSession } from '../store/slices/authSlice';
import { fcmService } from '../services/fcmService';
import { COLORS, FONT_SIZE } from '../constants';
import { useLanguage } from '../i18n';

// Auth
import LoginScreen from '../screens/auth/LoginScreen';

// Admin
import AdminDashboard from '../screens/admin/AdminDashboard';
import StaffManagementScreen from '../screens/admin/StaffManagementScreen';
import AnalyticsScreen from '../screens/admin/AnalyticsScreen';
import StallMapScreen from '../screens/admin/StallMapScreen';
import ReportDetailScreen from '../screens/admin/ReportDetailScreen';
import PnLReportScreen from '../screens/admin/PnLReportScreen';
import AuditLogScreen from '../screens/admin/AuditLogScreen';
import AlertsConfigScreen from '../screens/admin/AlertsConfigScreen';
import AttendanceScreen from '../screens/admin/AttendanceScreen';
import PayrollScreen from '../screens/admin/PayrollScreen';
import MenuPricingScreen from '../screens/admin/MenuPricingScreen';
import ReportsListScreen from '../screens/admin/ReportsListScreen';
import StallManagementScreen from '../screens/admin/StallManagementScreen';

// Staff
import StaffDashboard from '../screens/staff/StaffDashboard';
import TallyScreen from '../screens/staff/TallyScreen';
import DailyReportScreen from '../screens/staff/DailyReportScreen';
import CameraCaptureScreen from '../screens/staff/CameraCaptureScreen';

// Shared
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import InventoryManagementScreen from '../screens/shared/InventoryManagementScreen';
import ExpenseTrackerScreen from '../screens/shared/ExpenseTrackerScreen';
import WastageLogScreen from '../screens/shared/WastageLogScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{icon}</Text>;
}

function useTabBarScreenOptions() {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'android' ? Math.max(insets.bottom, 0) + 10 : 8;
  return {
    tabBarStyle: {
      backgroundColor: COLORS.white,
      borderTopWidth: 1,
      borderTopColor: COLORS.borderLight,
      height: 56 + bottomPad,
      paddingBottom: bottomPad,
      paddingTop: 4,
    },
    tabBarActiveTintColor: COLORS.primary,
    tabBarInactiveTintColor: COLORS.muted,
    headerShown: false,
  };
}

const headerOpts = { headerShown: true, headerTintColor: COLORS.primary, headerBackTitle: '' };

// ─── Admin Tabs ───────────────────────────────────────────────────────────────
function AdminTabs() {
  const { t } = useLanguage();
  const tabBarScreenOptions = useTabBarScreenOptions();
  return (
    <Tab.Navigator screenOptions={tabBarScreenOptions}>
      <Tab.Screen
        name="AdminDashboard"
        component={AdminDashboard}
        options={{ title: t('tabDashboard'), tabBarIcon: ({ focused }) => <TabIcon icon="📊" focused={focused} /> }}
      />
      <Tab.Screen
        name="StaffManagement"
        component={StaffManagementScreen}
        options={{ title: t('tabStaff'), tabBarIcon: ({ focused }) => <TabIcon icon="👥" focused={focused} /> }}
      />
      <Tab.Screen
        name="MenuPricingTab"
        component={MenuPricingScreen}
        options={{ title: 'Menu & Price', tabBarIcon: ({ focused }) => <TabIcon icon="☕" focused={focused} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: t('tabSettings'), tabBarIcon: ({ focused }) => <TabIcon icon="⚙️" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

// ─── Staff Tabs ───────────────────────────────────────────────────────────────
function StaffTabs() {
  const { t } = useLanguage();
  const tabBarScreenOptions = useTabBarScreenOptions();
  return (
    <Tab.Navigator screenOptions={tabBarScreenOptions}>
      <Tab.Screen
        name="StaffDashboard"
        component={StaffDashboard}
        options={{ title: t('tabHome'), tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} /> }}
      />
      <Tab.Screen
        name="Tally"
        component={TallyScreen}
        options={{ title: 'Tally', tabBarIcon: ({ focused }) => <TabIcon icon="☕" focused={focused} /> }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: t('tabAlerts'), tabBarIcon: ({ focused }) => <TabIcon icon="🔔" focused={focused} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: t('tabSettings'), tabBarIcon: ({ focused }) => <TabIcon icon="⚙️" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

// ─── Auth Stack ───────────────────────────────────────────────────────────────
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

// ─── Admin Stack ──────────────────────────────────────────────────────────────
function AdminStack() {
  const { t } = useLanguage();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminTabs" component={AdminTabs} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ ...headerOpts, title: t('screenAnalytics') }} />
      <Stack.Screen name="StallMap" component={StallMapScreen} options={{ ...headerOpts, title: t('screenStallMap') }} />
      <Stack.Screen name="ReportDetail" component={ReportDetailScreen} options={{ ...headerOpts, title: t('screenReportDetail') }} />
      <Stack.Screen name="InventoryManagement" component={InventoryManagementScreen} options={{ ...headerOpts, title: t('screenInventory') }} />
      <Stack.Screen name="ExpenseTracker" component={ExpenseTrackerScreen} options={{ ...headerOpts, title: t('screenExpenses') }} />
      <Stack.Screen name="WastageLog" component={WastageLogScreen} options={{ ...headerOpts, title: t('screenWastage') }} />
      <Stack.Screen name="PnLReport" component={PnLReportScreen} options={{ ...headerOpts, title: t('screenPnL') }} />
      <Stack.Screen name="AuditLog" component={AuditLogScreen} options={{ ...headerOpts, title: t('screenAuditLog') }} />
      <Stack.Screen name="AlertsConfig" component={AlertsConfigScreen} options={{ ...headerOpts, title: t('screenAlertsConfig') }} />
      <Stack.Screen name="Attendance" component={AttendanceScreen} options={{ ...headerOpts, title: t('screenAttendance') }} />
      <Stack.Screen name="Payroll" component={PayrollScreen} options={{ ...headerOpts, title: t('screenPayroll') }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ ...headerOpts, title: 'Notifications' }} />
      <Stack.Screen name="ReportsList" component={ReportsListScreen} options={{ ...headerOpts, title: 'Daily Reports' }} />
      <Stack.Screen name="StallManagement" component={StallManagementScreen} options={{ ...headerOpts, title: 'Stall Management' }} />
    </Stack.Navigator>
  );
}

// ─── Staff Stack ──────────────────────────────────────────────────────────────
function StaffStack() {
  const { t } = useLanguage();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StaffTabs" component={StaffTabs} />
      <Stack.Screen name="DailyReport" component={DailyReportScreen} />
      <Stack.Screen name="CameraCapture" component={CameraCaptureScreen} />
      <Stack.Screen name="InventoryManagement" component={InventoryManagementScreen} options={{ ...headerOpts, title: t('screenInventory') }} />
      <Stack.Screen name="ExpenseTracker" component={ExpenseTrackerScreen} options={{ ...headerOpts, title: t('screenExpenses') }} />
      <Stack.Screen name="WastageLog" component={WastageLogScreen} options={{ ...headerOpts, title: t('screenWastage') }} />
      <Stack.Screen name="Attendance" component={AttendanceScreen} options={{ ...headerOpts, title: t('screenMyAttendance') }} />
    </Stack.Navigator>
  );
}

// ─── Root Navigator ───────────────────────────────────────────────────────────
export default function AppNavigator() {
  const { isAuthenticated, user } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(refreshSession());
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fcmService.registerToken().catch(() => {});
    }
  }, [isAuthenticated]);

  const getStack = () => {
    if (!isAuthenticated) return <AuthStack />;
    switch (user?.role) {
      case 'admin':
      case 'moderator':
        return <AdminStack />;
      case 'staff':
        return <StaffStack />;
      default:
        return <AuthStack />;
    }
  };

  return (
    <NavigationContainer>{getStack()}</NavigationContainer>
  );
}
