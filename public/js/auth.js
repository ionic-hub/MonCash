// Toggle password visibility
function togglePassword() {
  const pwd = document.getElementById('password');
  const btn = document.querySelector('.toggle-password');
  if (pwd.type === 'password') {
    pwd.type = 'text';
    btn.textContent = '🙈';
  } else {
    pwd.type = 'password';
    btn.textContent = '👁';
  }
}

// Handle Google Sign-In response
async function handleCredentialResponse(response) {
  try {
    const res = await fetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      window.location.href = 'dashboard.html';
    } else {
      document.getElementById('error').textContent = data.error || 'Google login gagal';
    }
  } catch (err) {
    document.getElementById('error').textContent = 'Koneksi error';
  }
}

// Login form handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('error');
    const loadingEl = document.getElementById('loading');
    const btn = document.getElementById('btnLogin');
    
    errorEl.textContent = '';
    loadingEl.style.display = 'block';
    btn.disabled = true;
    btn.textContent = 'Sedang masuk...';
    
    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        window.location.href = 'dashboard.html';
      } else {
        errorEl.textContent = data.error || 'Login gagal';
        loadingEl.style.display = 'none';
        btn.disabled = false;
        btn.textContent = 'Masuk';
      }
    } catch (err) {
      errorEl.textContent = 'Koneksi error';
      loadingEl.style.display = 'none';
      btn.disabled = false;
      btn.textContent = 'Masuk';
    }
  });
}

// Register form handler
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword');
    const errorEl = document.getElementById('error');
    const loadingEl = document.getElementById('loading');
    const btn = document.getElementById('btnRegister');
    
    // Check password confirmation if field exists
    if (confirmPassword && password !== confirmPassword.value) {
      errorEl.textContent = 'Password tidak sama';
      return;
    }
    
    errorEl.textContent = '';
    loadingEl.style.display = 'block';
    btn.disabled = true;
    btn.textContent = 'Mendaftar...';
    
    try {
      const res = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        window.location.href = 'login.html';
      } else {
        errorEl.textContent = data.error || 'Register gagal';
        loadingEl.style.display = 'none';
        btn.disabled = false;
        btn.textContent = 'Daftar';
      }
    } catch (err) {
      errorEl.textContent = 'Koneksi error';
      loadingEl.style.display = 'none';
      btn.disabled = false;
      btn.textContent = 'Daftar';
    }
  });
}
