export type Language = 'en' | 'hi';

export const translations = {
  en: {
    // Greetings
    goodMorning: 'Good morning',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',

    // Dashboard
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

    // Quick actions
    quickActions: 'Quick Actions',
    camera: 'Camera',
    takePhotos: 'Take photos',
    inventory: 'Inventory',
    checkStock: 'Check stock',
    expenses: 'Expenses',
    logExpense: 'Log expense',
    wastage: 'Wastage',
    logWastage: 'Log wastage',

    // Recent reports
    recentReports: 'Recent Reports',
    today: 'Today',
    yesterday: 'Yesterday',
    pending: 'Pending',
    submitted: 'Submitted',
    flagged: 'Flagged',
    noReport: 'No report',
    missed: 'Missed',

    // Income card
    monthlyEarnings: 'This Month\'s Earnings',
    baseSalary: 'Base salary',
    cupBonus: 'Cup bonus',
    cups: 'cups',
    totalPay: 'Total',
    perCup: '₹1 per cup',

    // Settings
    language: 'Language',
    languageSub: 'App display language',
    english: 'English',
    hindi: 'Hindi',

    // Tip
    dailyTip: 'Daily tip',
    tipText: 'Always enter milk purchases first — it helps the system calculate expected cups accurately.',

    // Offline
    offlineQueued: 'Offline — report queued for sync',
    cachedData: 'Showing cached data',
  },

  hi: {
    goodMorning: 'सुप्रभात',
    goodAfternoon: 'शुभ दोपहर',
    goodEvening: 'शुभ संध्या',

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

    quickActions: 'त्वरित कार्य',
    camera: 'कैमरा',
    takePhotos: 'फोटो लें',
    inventory: 'स्टॉक',
    checkStock: 'स्टॉक देखें',
    expenses: 'खर्च',
    logExpense: 'खर्च दर्ज करें',
    wastage: 'बर्बादी',
    logWastage: 'बर्बादी दर्ज करें',

    recentReports: 'हाल की रिपोर्ट',
    today: 'आज',
    yesterday: 'कल',
    pending: 'बाकी है',
    submitted: 'जमा हो गई',
    flagged: 'संदिग्ध',
    noReport: 'कोई रिपोर्ट नहीं',
    missed: 'छूट गई',

    monthlyEarnings: 'इस महीने की कमाई',
    baseSalary: 'बेस सैलरी',
    cupBonus: 'कप बोनस',
    cups: 'कप',
    totalPay: 'कुल',
    perCup: '₹1 प्रति कप',

    language: 'भाषा',
    languageSub: 'ऐप की भाषा',
    english: 'अंग्रेज़ी',
    hindi: 'हिंदी',

    dailyTip: 'दिन की सलाह',
    tipText: 'पहले दूध की खरीदारी दर्ज करें — इससे सिस्टम कप की सही गिनती कर सकता है।',

    offlineQueued: 'ऑफलाइन — रिपोर्ट सिंक के लिए कतार में है',
    cachedData: 'कैश डेटा दिखाया जा रहा है',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
