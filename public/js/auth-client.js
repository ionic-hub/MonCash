// ======================
// GOOGLE AUTH HANDLER
// ======================

let googleUser = null;

// Handle Google Sign-In response
function handleCredentialResponse(response) {
  // Decode JWT token
  const payload = parseJwt(response.credential);
  
  const user = {
    id: payload.sub,
    name: payload.name,
    email: payload.email,
    picture: payload.picture,
    isAdmin: isAdmin(payload.email)
  };
  
  googleUser = user;
  SheetsDB.init(user);
  
  // Redirect to dashboard
  window.location.href = 'dashboard.html';
}

// Parse JWT token
function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
}

// Toggle password visibility (for legacy forms)
function togglePassword() {
  const pwd = document.getElementById('password');
  const btn = document.querySelector('.toggle-password');
  if (pwd && btn) {
    if (pwd.type === 'password') {
      pwd.type = 'text';
      btn.textContent = '🙈';
    } else {
      pwd.type = 'password';
      btn.textContent = '👁';
    }
  }
}

// Check if user is already logged in
function checkAuth() {
  const user = SheetsDB.getStoredUser();
  if (user) {
    googleUser = user;
    return true;
  }
  return false;
}

// Logout
function logout() {
  SheetsDB.logout();
  googleUser = null;
  
  // Revoke Google token if available
  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.disableAutoSelect();
  }
  
  window.location.href = 'login.html';
}

// Initialize Google Sign-In on page load
function initGoogleSignIn() {
  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse
    });
    
    // Render button if container exists
    const buttonDiv = document.getElementById('google-signin-button');
    if (buttonDiv) {
      google.accounts.id.renderButton(buttonDiv, {
        theme: 'outline',
        size: 'large',
        width: '100%',
        text: 'signin_with'
      });
    }
  }
}

// Auto-init when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Small delay to ensure Google script is loaded
  setTimeout(initGoogleSignIn, 100);
});
