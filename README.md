# ChaistOps — Tea Stall Management System

> Premium anti-cheating, GPS-tracked, camera-enforced daily operations app for Chaisto, Civil Lines, Prayagraj.

---

## 🔐 YOUR ADMIN CREDENTIALS

```
Phone:    +91 8318876136
Password: Chaisto@Admin2024
Role:     Admin (full access)
```

> ⚠️ Change this password immediately after first login via Settings → Change Password.

---

## 📁 Project Structure

```
ChaistOps/              ← React Native app (frontend)
  App.tsx
  src/
    screens/
      auth/             LoginScreen
      admin/            AdminDashboard, StaffManagementScreen
      staff/            StaffDashboard, DailyReportScreen, CameraCaptureScreen
    store/slices/       authSlice, reportSlice (Redux + anti-cheat logic)
    services/           authService, reportService, deviceService
    navigation/         AppNavigator (role-based routing)
    constants/          Colors, brew constants, photo categories
    types/              TypeScript interfaces

ChaistOps-backend/      ← Node.js/Express API (backend)
  src/
    models/             User, Report, Stall, InventoryItem
    routes/             auth, reports, inventory
    middleware/         auth (JWT + RBAC + device binding)
    services/           notificationService, scheduledJobs, deviceService
    utils/              seed.js (creates admin account)
  .env.example          ← Copy to .env and fill in your values
```

---

## 🚀 Setup Guide

### Backend

```bash
cd ChaistOps-backend
npm install
cp .env.example .env
# Fill in MongoDB URI, Firebase credentials, Cloudinary keys
npm run seed          # Creates admin account + default stall
npm run dev           # Development server on port 5000
```

### Frontend (React Native)

```bash
cd ChaistOps
npm install
# iOS
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

### Required services to set up:
1. **MongoDB Atlas** — Create cluster, get connection URI
2. **Firebase** — Create project, enable Auth + FCM, download Admin SDK key
3. **Cloudinary** — Create account, get cloud name + API keys
4. Update `src/constants/index.ts` → `API_CONFIG.BASE_URL` with your backend URL
5. Update `CLOUDINARY_CONFIG` with your Cloudinary details

---

## 👥 User Roles & Permissions

| Feature | Admin | Moderator | Staff |
|---|---|---|---|
| View all reports | ✅ | ✅ | Own only |
| Submit daily report | ✅ | ✅ | ✅ |
| Edit past reports | ✅ | ✅ | ❌ Never |
| Create user accounts | ✅ | ❌ | ❌ |
| View analytics | ✅ | ✅ | ❌ |
| Manage inventory | ✅ | ✅ | Read only |
| View suspicion alerts | ✅ | ✅ | ❌ |
| Reset device binding | ✅ | ❌ | ❌ |
| Camera only (no gallery) | — | — | ✅ Enforced |

---

## 🔐 Security Features

- **JWT** authentication with 8-hour expiry
- **Device binding** — staff account locked to one device (admin can reset)
- **Bcrypt** password hashing (12 rounds)
- **Login lockout** — 5 failed attempts → 15-minute lock
- **Rate limiting** — 100 req/15min globally, 10 login attempts/15min
- **GPS verification** — reports flagged if submitted >200m from stall
- **No gallery access** — staff camera only, gallery uploads blocked
- **Immutable reports** — staff cannot edit after submission
- **Server-side anti-cheat** — all metrics recomputed on server (client values not trusted)
- **Watermarked photos** — date, time, stall name burned into image

---

## 🚨 Anti-Cheat Logic (Auto-flags)

| Flag Type | Condition | Severity |
|---|---|---|
| `milk_mismatch` | Cups reported vs milk used deviation >20% | Medium/High |
| `revenue_mismatch` | Revenue per cup outside ₹10–₹60 range | High |
| `low_upi` | <20% UPI when revenue >₹500 | Medium |
| `location_mismatch` | Report submitted >200m from stall GPS | High |
| `missing_report` | No report by 11:30 PM | Alert |

All flags are server-computed — staff cannot manipulate them.

---

## 📸 Camera System

- Staff must capture 4 mandatory photos per report
- Gallery upload disabled via `RNCamera` config (no `cameraCaptureTargetDirectory` or gallery access)
- Each photo is watermarked with: Date · Time · Stall Name · Category
- Photos uploaded to Cloudinary under `daily-reports/{stallName}/` folder
- GPS coordinates, device ID, and timestamp stored per photo

---

## 📱 Push Notifications (Firebase FCM)

| Trigger | Recipients |
|---|---|
| Report submitted | Admin + Moderator |
| Suspicious activity detected | Admin |
| Missing report (11:30 PM) | Admin |
| Daily report reminder (9 PM) | Staff (who haven't submitted) |
| Low stock alert | Staff |

---

## 🗓️ Scheduled Jobs (IST Timezone)

- **9:00 PM** — Remind staff who haven't submitted
- **11:30 PM** — Alert admin about missing reports  
- **8:00 AM** — Daily summary to admin

---

## 🔧 Environment Variables (.env)

```env
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
FIREBASE_PROJECT_ID=chaisto-ops
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...
CLOUDINARY_CLOUD_NAME=chaisto-ops
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
ADMIN_PHONE=8318876136
ADMIN_DEFAULT_PASSWORD=Chaisto@Admin2024
```

---

## 🏗️ Architecture — Future Scaling

The codebase is designed for:
- **Multi-stall** — every model has `stallId` separation
- **Franchise** — add moderator per stall, admin sees all
- **Vendor management** — inventory transaction model ready
- **AI sales prediction** — daily aggregates stored per stall for ML training
- **Expense tracking** — purchases model extensible

---

## 📞 Support

Admin contact: **+91 83188 76136** (your number — pre-loaded as admin)

Chaisto Ops v1.0 · Civil Lines, Prayagraj
