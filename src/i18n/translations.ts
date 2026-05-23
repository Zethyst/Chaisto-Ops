export type Language = 'en' | 'hi';

export const translations = {
  en: {
    // ── Greetings ──────────────────────────────────────────────────────────────
    goodMorning: 'Good morning',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',

    // ── Tab bar ────────────────────────────────────────────────────────────────
    tabDashboard: 'Dashboard',
    tabStaff: 'Staff',
    tabAlerts: 'Alerts',
    tabSettings: 'Settings',
    tabHome: 'Home',

    // ── Common actions ─────────────────────────────────────────────────────────
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    submit: 'Submit',
    edit: 'Edit',
    close: 'Close',
    confirm: 'Confirm',
    loading: 'Loading…',
    refresh: 'Refresh',
    noData: 'No data available',
    error: 'Something went wrong',

    // ── Staff Dashboard ────────────────────────────────────────────────────────
    dailyReportPending: 'Daily Report Pending',
    reportSubmitted: 'Report Submitted!',
    submitBeforeClosing: 'Submit before closing time tonight',
    submittedAt: 'Submitted at',
    startDailyReport: 'Start Daily Closing Report',
    startDailyReportSub: 'Step-by-step · 7 minutes · Required daily',
    todaySummary: "Today's Summary",
    cupsSold: 'Cups Sold',
    revenue: 'Revenue',
    flagsRaised: 'flag(s) raised — admin will review',

    // ── Quick actions (staff) ──────────────────────────────────────────────────
    quickActions: 'Quick Actions',
    camera: 'Camera',
    takePhotos: 'Take photos',
    inventory: 'Inventory',
    checkStock: 'Check stock',
    expenses: 'Expenses',
    logExpense: 'Log expense',
    wastage: 'Wastage',
    logWastage: 'Log wastage',

    // ── Recent reports ─────────────────────────────────────────────────────────
    recentReports: 'Recent Reports',
    today: 'Today',
    yesterday: 'Yesterday',
    pending: 'Pending',
    submitted: 'Submitted',
    flagged: 'Flagged',
    noReport: 'No report',
    missed: 'Missed',
    reviewed: 'Reviewed',

    // ── Income card ────────────────────────────────────────────────────────────
    monthlyEarnings: "This Month's Earnings",
    baseSalary: 'Base salary',
    cupBonus: 'Cup bonus',
    cups: 'cups',
    totalPay: 'Total',
    perCup: '₹1 per cup',

    // ── Admin Dashboard ────────────────────────────────────────────────────────
    suspicionAlerts: '🚨 Suspicion Alerts',
    noSuspicionAlerts: '✅ No active suspicion alerts',
    staffPerformance: 'Staff Performance',
    noPerformanceData: 'No performance data yet for this period',
    thisWeek: '7 Days',
    thisMonth: '30 Days',
    reportsThisPeriod: 'Reports',
    cupsTotal: 'Cups',
    revenueTotal: 'Revenue',
    flaggedReports: 'Alerts',

    // ── Notifications ──────────────────────────────────────────────────────────
    notifications: 'Notifications',
    allFilter: 'All',
    unreadFilter: 'Unread',
    alertsFilter: 'Alerts',
    markAllRead: 'Mark all read',
    noNotifications: 'All clear — no notifications',
    justNow: 'just now',
    minutesAgo: 'min ago',
    hoursAgo: 'hr ago',
    daysAgo: 'day ago',

    // ── Settings ──────────────────────────────────────────────────────────────
    language: 'Language',
    languageSub: 'App display language',
    english: 'English',
    hindi: 'Hindi',
    security: 'SECURITY',
    changePassword: 'Change Password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    updatePassword: 'Update Password',
    notificationsSection: 'NOTIFICATIONS',
    pushNotifications: 'Push Notifications',
    pushNotificationsSub: 'Receive alerts and reminders',
    accountSection: 'ACCOUNT',
    deviceBinding: 'Device Binding',
    boundToDevice: 'Bound to this device',
    notBound: 'Not bound',
    aboutSection: 'ABOUT',
    signOut: 'Sign Out',
    signOutConfirm: 'You will need to sign back in to access the app.',
    secured: '🔒 Secured · GPS-tracked · Device-bound',

    // ── Screen titles (header bars) ────────────────────────────────────────────
    screenInventory: 'Inventory',
    screenAnalytics: 'Analytics',
    screenStallMap: 'Stall Map',
    screenReportDetail: 'Report Detail',
    screenExpenses: 'Expenses',
    screenWastage: 'Wastage Log',
    screenPnL: 'P&L Report',
    screenAuditLog: 'Audit Log',
    screenAlertsConfig: 'Alerts Config',
    screenAttendance: 'Attendance',
    screenPayroll: 'Payroll',
    screenMyAttendance: 'My Attendance',

    // ── Tip ───────────────────────────────────────────────────────────────────
    dailyTip: 'Daily tip',
    tipText: 'Always enter milk purchases first — it helps the system calculate expected cups accurately.',

    // ── Offline / cache ────────────────────────────────────────────────────────
    offlineQueued: 'Offline — report queued for sync',
    cachedData: 'Showing cached data',
  },

  hi: {
    // ── Greetings ──────────────────────────────────────────────────────────────
    goodMorning: 'सुप्रभात',
    goodAfternoon: 'शुभ दोपहर',
    goodEvening: 'शुभ संध्या',

    // ── Tab bar ────────────────────────────────────────────────────────────────
    tabDashboard: 'डैशबोर्ड',
    tabStaff: 'स्टाफ',
    tabAlerts: 'अलर्ट',
    tabSettings: 'सेटिंग',
    tabHome: 'होम',

    // ── Common actions ─────────────────────────────────────────────────────────
    save: 'सहेजें',
    cancel: 'रद्द करें',
    delete: 'हटाएं',
    submit: 'जमा करें',
    edit: 'संपादित करें',
    close: 'बंद करें',
    confirm: 'पुष्टि करें',
    loading: 'लोड हो रहा है…',
    refresh: 'ताज़ा करें',
    noData: 'कोई डेटा उपलब्ध नहीं',
    error: 'कुछ गलत हुआ',

    // ── Staff Dashboard ────────────────────────────────────────────────────────
    dailyReportPending: 'दैनिक रिपोर्ट बाकी है',
    reportSubmitted: 'रिपोर्ट जमा हो गई!',
    submitBeforeClosing: 'आज रात बंद करने से पहले जमा करें',
    submittedAt: 'जमा किया',
    startDailyReport: 'दैनिक क्लोजिंग रिपोर्ट शुरू करें',
    startDailyReportSub: 'चरण-दर-चरण · 7 मिनट · रोज़ जरूरी',
    todaySummary: 'आज का सारांश',
    cupsSold: 'कप बिके',
    revenue: 'कमाई',
    flagsRaised: 'संदिग्ध गतिविधि — एडमिन जांच करेगा',

    // ── Quick actions (staff) ──────────────────────────────────────────────────
    quickActions: 'त्वरित कार्य',
    camera: 'कैमरा',
    takePhotos: 'फोटो लें',
    inventory: 'स्टॉक',
    checkStock: 'स्टॉक देखें',
    expenses: 'खर्च',
    logExpense: 'खर्च दर्ज करें',
    wastage: 'बर्बादी',
    logWastage: 'बर्बादी दर्ज करें',

    // ── Recent reports ─────────────────────────────────────────────────────────
    recentReports: 'हाल की रिपोर्ट',
    today: 'आज',
    yesterday: 'कल',
    pending: 'बाकी है',
    submitted: 'जमा हो गई',
    flagged: 'संदिग्ध',
    noReport: 'कोई रिपोर्ट नहीं',
    missed: 'छूट गई',
    reviewed: 'समीक्षित',

    // ── Income card ────────────────────────────────────────────────────────────
    monthlyEarnings: 'इस महीने की कमाई',
    baseSalary: 'बेस सैलरी',
    cupBonus: 'कप बोनस',
    cups: 'कप',
    totalPay: 'कुल',
    perCup: '₹1 प्रति कप',

    // ── Admin Dashboard ────────────────────────────────────────────────────────
    suspicionAlerts: '🚨 संदिग्ध अलर्ट',
    noSuspicionAlerts: '✅ कोई सक्रिय संदिग्ध अलर्ट नहीं',
    staffPerformance: 'स्टाफ प्रदर्शन',
    noPerformanceData: 'इस अवधि के लिए कोई प्रदर्शन डेटा नहीं',
    thisWeek: '7 दिन',
    thisMonth: '30 दिन',
    reportsThisPeriod: 'रिपोर्ट',
    cupsTotal: 'कप',
    revenueTotal: 'कमाई',
    flaggedReports: 'अलर्ट',

    // ── Notifications ──────────────────────────────────────────────────────────
    notifications: 'सूचनाएं',
    allFilter: 'सभी',
    unreadFilter: 'अपठित',
    alertsFilter: 'अलर्ट',
    markAllRead: 'सभी पढ़ा हुआ करें',
    noNotifications: 'सब ठीक है — कोई सूचना नहीं',
    justNow: 'अभी',
    minutesAgo: 'मिनट पहले',
    hoursAgo: 'घंटे पहले',
    daysAgo: 'दिन पहले',

    // ── Settings ──────────────────────────────────────────────────────────────
    language: 'भाषा',
    languageSub: 'ऐप की भाषा',
    english: 'अंग्रेज़ी',
    hindi: 'हिंदी',
    security: 'सुरक्षा',
    changePassword: 'पासवर्ड बदलें',
    currentPassword: 'वर्तमान पासवर्ड',
    newPassword: 'नया पासवर्ड',
    confirmPassword: 'नया पासवर्ड दोबारा',
    updatePassword: 'पासवर्ड अपडेट करें',
    notificationsSection: 'सूचनाएं',
    pushNotifications: 'पुश नोटिफिकेशन',
    pushNotificationsSub: 'अलर्ट और रिमाइंडर पाएं',
    accountSection: 'खाता',
    deviceBinding: 'डिवाइस बाइंडिंग',
    boundToDevice: 'इस डिवाइस से जुड़ा है',
    notBound: 'जुड़ा नहीं',
    aboutSection: 'के बारे में',
    signOut: 'साइन आउट',
    signOutConfirm: 'ऐप में वापस आने के लिए दोबारा लॉगिन करना होगा।',
    secured: '🔒 सुरक्षित · GPS-ट्रैक्ड · डिवाइस-बाउंड',

    // ── Screen titles ──────────────────────────────────────────────────────────
    screenInventory: 'स्टॉक',
    screenAnalytics: 'विश्लेषण',
    screenStallMap: 'स्टॉल मैप',
    screenReportDetail: 'रिपोर्ट विवरण',
    screenExpenses: 'खर्च',
    screenWastage: 'बर्बादी लॉग',
    screenPnL: 'लाभ-हानि रिपोर्ट',
    screenAuditLog: 'ऑडिट लॉग',
    screenAlertsConfig: 'अलर्ट सेटिंग',
    screenAttendance: 'उपस्थिति',
    screenPayroll: 'वेतन',
    screenMyAttendance: 'मेरी उपस्थिति',

    // ── Tip ───────────────────────────────────────────────────────────────────
    dailyTip: 'दिन की सलाह',
    tipText: 'पहले दूध की खरीदारी दर्ज करें — इससे सिस्टम कप की सही गिनती कर सकता है।',

    // ── Offline / cache ────────────────────────────────────────────────────────
    offlineQueued: 'ऑफलाइन — रिपोर्ट सिंक के लिए कतार में है',
    cachedData: 'कैश डेटा दिखाया जा रहा है',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
