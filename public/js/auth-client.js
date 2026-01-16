// ======================
// GOOGLE AUTH HANDLER (for dashboard)
// ======================

let googleUser = null;

// Check if user is already logged in
function checkAuth() {
  const stored = localStorage.getItem('moncash_user');
  if (stored) {
    try {
      googleUser = JSON.parse(stored);
      SheetsDB.init(googleUser);
      return true;
    } catch (e) {
      localStorage.removeItem('moncash_user');
      return false;
    }
  }
  return false;
}

// Get current user
function getCurrentUser() {
  if (!googleUser) {
    const stored = localStorage.getItem('moncash_user');
    if (stored) {
      googleUser = JSON.parse(stored);
    }
  }
  return googleUser;
}

// Logout
function logout() {
  googleUser = null;
  localStorage.removeItem('moncash_user');
  
  // Revoke Google token if available
  if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }
  
  window.location.href = 'login-static.html';
}

// Check if email is admin
function isAdmin(email) {
  return CONFIG.ADMIN_EMAILS.includes(email);
}
