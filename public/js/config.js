// ======================
// CONFIGURATION
// ======================

const CONFIG = {
  // Google OAuth Client ID
  GOOGLE_CLIENT_ID: '549624092481-81f8u53hb3cjnbbt5ot68fihlnlvdvvl.apps.googleusercontent.com',
  
  // Google Apps Script Web App URL (akan diisi setelah deploy Apps Script)
  SHEETS_API_URL: 'YOUR_GOOGLE_APPS_SCRIPT_URL',
  
  // Admin emails - hanya email ini yang bisa akses sebagai admin
  ADMIN_EMAILS: [
    'your-admin-email@gmail.com'
    // Tambahkan email admin lainnya di sini
  ],
  
  // App name
  APP_NAME: 'Dashboard Keuangan'
};

// Check if user is admin
function isAdmin(email) {
  return CONFIG.ADMIN_EMAILS.includes(email);
}
