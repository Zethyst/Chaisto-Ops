import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { refreshSession } from '../store/slices/authSlice';
import { COLORS, FONT_SIZE } from '../constants';

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

// Staff
import StaffDashboard from '../screens/staff/StaffDashboard';
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

const tabBarOptions = {
  tabBarStyle: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    height: 64,
    paddingBottom: 10,
    paddingTop: 4,
  },
  tabBarActiveTintColor: COLORS.primary,
  tabBarInactiveTintColor: COLORS.muted,
  headerShown: false,
};

const headerOpts = { headerShown: true, headerTintColor: COLORS.primary, headerBackTitle: '' };

// ─── Admin Tabs ───────────────────────────────────────────────────────────────
function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={tabBarOptions}>
      <Tab.Screen
        name="AdminDashboard"
        component={AdminDashboard}
        options={{ title: 'Dashboard', tabBarIcon: ({ focused }) => <TabIcon icon="📊" focused={focused} /> }}
      />
      <Tab.Screen
        name="StaffManagement"
        component={StaffManagementScreen}
        options={{ title: 'Staff', tabBarIcon: ({ focused }) => <TabIcon icon="👥" focused={focused} /> }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Alerts', tabBarIcon: ({ focused }) => <TabIcon icon="🔔" focused={focused} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings', tabBarIcon: ({ focused }) => <TabIcon icon="⚙️" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

// ─── Staff Tabs ───────────────────────────────────────────────────────────────
function StaffTabs() {
  return (
    <Tab.Navigator screenOptions={tabBarOptions}>
      <Tab.Screen
        name="StaffDashboard"
        component={StaffDashboard}
        options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} /> }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Alerts', tabBarIcon: ({ focused }) => <TabIcon icon="🔔" focused={focused} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings', tabBarIcon: ({ focused }) => <TabIcon icon="⚙️" focused={focused} /> }}
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
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminTabs" component={AdminTabs} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ ...headerOpts, title: 'Analytics' }} />
      <Stack.Screen name="StallMap" component={StallMapScreen} options={{ ...headerOpts, title: 'Stall Map' }} />
      <Stack.Screen name="ReportDetail" component={ReportDetailScreen} options={{ ...headerOpts, title: 'Report Detail' }} />
      <Stack.Screen name="InventoryManagement" component={InventoryManagementScreen} options={{ ...headerOpts, title: 'Inventory' }} />
      <Stack.Screen name="ExpenseTracker" component={ExpenseTrackerScreen} options={{ ...headerOpts, title: 'Expenses' }} />
      <Stack.Screen name="WastageLog" component={WastageLogScreen} options={{ ...headerOpts, title: 'Wastage Log' }} />
      <Stack.Screen name="PnLReport" component={PnLReportScreen} options={{ ...headerOpts, title: 'P&L Report' }} />
      <Stack.Screen name="AuditLog" component={AuditLogScreen} options={{ ...headerOpts, title: 'Audit Log' }} />
      <Stack.Screen name="AlertsConfig" component={AlertsConfigScreen} options={{ ...headerOpts, title: 'Alerts Config' }} />
      <Stack.Screen name="Attendance" component={AttendanceScreen} options={{ ...headerOpts, title: 'Attendance' }} />
      <Stack.Screen name="Payroll" component={PayrollScreen} options={{ ...headerOpts, title: 'Payroll' }} />
    </Stack.Navigator>
  );
}

// ─── Staff Stack ──────────────────────────────────────────────────────────────
function StaffStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StaffTabs" component={StaffTabs} />
      <Stack.Screen name="DailyReport" component={DailyReportScreen} />
      <Stack.Screen name="CameraCapture" component={CameraCaptureScreen} />
      <Stack.Screen name="InventoryManagement" component={InventoryManagementScreen} options={{ ...headerOpts, title: 'Inventory' }} />
      <Stack.Screen name="ExpenseTracker" component={ExpenseTrackerScreen} options={{ ...headerOpts, title: 'Expenses' }} />
      <Stack.Screen name="WastageLog" component={WastageLogScreen} options={{ ...headerOpts, title: 'Wastage Log' }} />
      <Stack.Screen name="Attendance" component={AttendanceScreen} options={{ ...headerOpts, title: 'My Attendance' }} />
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
