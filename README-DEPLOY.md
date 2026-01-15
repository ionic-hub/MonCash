# MonCash - Deploy Guide (Frontend Only + Google Sheets)

## 📋 Overview

Versi ini adalah **frontend-only** yang menggunakan:
- **Google Sign-In** untuk authentication
- **Google Sheets** sebagai database (via Google Apps Script)
- **Vercel/Netlify** untuk hosting gratis

---

## 🚀 Step-by-Step Setup

### Step 1: Setup Google Sheet

1. Buka [Google Sheets](https://sheets.google.com)
2. Buat **Spreadsheet baru**
3. Copy **Spreadsheet ID** dari URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_DISINI/edit
   ```
4. Simpan ID ini untuk nanti

### Step 2: Deploy Google Apps Script

1. Buka [Google Apps Script](https://script.google.com)
2. Klik **New Project**
3. Copy semua isi file `google-apps-script.js` dari repo ini
4. Paste ke editor Apps Script
5. **PENTING:** Ganti `YOUR_GOOGLE_SHEET_ID` dengan Spreadsheet ID dari Step 1:
   ```javascript
   const SPREADSHEET_ID = 'paste_spreadsheet_id_kamu_disini';
   ```
6. Simpan (Ctrl+S atau Cmd+S)
7. Klik **Run** > pilih fungsi `initSheets` > **Run**
   - Ini akan membuat sheets `users`, `transactions`, `debts` otomatis
   - Akan minta permission, klik **Review Permissions** > pilih akun Google > **Allow**
8. Deploy:
   - Klik **Deploy** > **New Deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik **Deploy**
9. Copy **Web App URL** yang muncul (format: `https://script.google.com/macros/s/xxx/exec`)

### Step 3: Update Config

Edit file `public/js/config.js`:

```javascript
const CONFIG = {
  GOOGLE_CLIENT_ID: '549624092481-81f8u53hb3cjnbbt5ot68fihlnlvdvvl.apps.googleusercontent.com',
  
  // PASTE WEB APP URL DARI STEP 2 DISINI:
  SHEETS_API_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
  
  // GANTI DENGAN EMAIL ADMIN KAMU:
  ADMIN_EMAILS: [
    'email-admin-kamu@gmail.com'
  ],
  
  APP_NAME: 'Dashboard Keuangan'
};
```

### Step 4: Deploy ke Vercel

**Option A: Via Vercel CLI**
```bash
npm i -g vercel
vercel login
vercel --prod
```

**Option B: Via Vercel Website**
1. Buka [vercel.com](https://vercel.com)
2. Login dengan GitHub
3. Klik **Add New** > **Project**
4. Import repository `MonCash`
5. Pilih branch: `deploy-free`
6. Klik **Deploy**

### Step 5: Update Google OAuth Settings

Setelah dapat URL dari Vercel (misal: `https://moncash.vercel.app`):

1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Pilih project yang sudah ada
3. APIs & Services > **Credentials**
4. Edit OAuth 2.0 Client ID yang sudah dibuat
5. Di **Authorized JavaScript origins**, tambahkan:
   ```
   https://moncash.vercel.app
   ```
   (ganti dengan URL Vercel kamu)
6. Klik **Save**

---

## 🔧 Troubleshooting

### "Sign in with Google" tidak muncul
- Pastikan domain sudah ditambahkan di Google Cloud Console
- Clear cache browser

### Data tidak tersimpan
- Cek Console browser (F12) untuk error
- Pastikan `SHEETS_API_URL` sudah benar di config.js
- Pastikan Apps Script sudah di-deploy sebagai Web App

### "Access Denied" di Apps Script
- Jalankan fungsi `initSheets` dulu untuk grant permission
- Re-deploy Apps Script setelah ada perubahan code

---

## 📁 File Structure (deploy-free branch)

```
MonCash/
├── public/
│   ├── index.html              # Redirect ke login
│   ├── login-static.html       # Halaman login (Google Sign-In)
│   ├── dashboard-static.html   # Dashboard utama
│   ├── css/
│   │   ├── base.css
│   │   ├── auth.css
│   │   ├── dashboard.css
│   │   └── modal.css
│   └── js/
│       ├── config.js           # Konfigurasi (EDIT INI!)
│       ├── sheets-db.js        # Google Sheets API wrapper
│       ├── auth-client.js      # Google Auth handler
│       ├── dashboard-static.js # Dashboard logic
│       └── modal.js            # Modal handler
├── google-apps-script.js       # Copy ke Apps Script
├── vercel.json                 # Vercel config
├── netlify.toml                # Netlify config (alternatif)
└── README-DEPLOY.md            # File ini
```

---

## 🆘 Need Help?

Jika ada masalah, pastikan:
1. ✅ Spreadsheet ID sudah benar
2. ✅ Apps Script sudah di-deploy dan URL sudah di-copy
3. ✅ config.js sudah di-update dengan URL yang benar
4. ✅ Domain Vercel sudah ditambahkan di Google Cloud Console

---

## 📝 Notes

- Data disimpan per-user berdasarkan Google account email
- Admin bisa melihat data semua user (set email di `ADMIN_EMAILS`)
- Google Sheets punya limit 500 request per 100 detik per user
- Gratis selamanya! Tidak ada biaya hosting atau database
