// ======================
// CONFIGURATION
// ======================

const CONFIG = {
  // Google OAuth Client ID
  GOOGLE_CLIENT_ID: '549624092481-81f8u53hb3cjnbbt5ot68fihlnlvdvvl.apps.googleusercontent.com',
  
  // Google Apps Script Web App URL
  SHEETS_API_URL: 'https://script.google.com/macros/s/AKfycbzNaH9tAP4OCmNtt9oxF44hiMZGYB52NgvDfsxPn6jyEX-tTXMHOww6G70_DLtzyLZoTw/exec',
  
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
