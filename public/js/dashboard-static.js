let chart;
let editTransactionId = null;
let editDebtId = null;
let currentFilter = 'month';
let currentUser = null;

// Format number with thousand separator
function formatNumber(num) {
  return num.toLocaleString('id-ID');
}

// Format date
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Get date range based on filter
function getDateRange(filter) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let startDate, endDate;
  endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);
  
  switch(filter) {
    case 'today':
      startDate = new Date(today);
      break;
    case 'week':
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 6);
      break;
    case 'month':
    default:
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
  }
  
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  };
}

// Set filter and reload data
function setFilter(filter) {
  currentFilter = filter;
  
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.filter === filter) {
      btn.classList.add('active');
    }
  });
  
  const titles = {
    'today': 'Ringkasan Hari Ini',
    'week': 'Ringkasan 7 Hari Terakhir',
    'month': 'Ringkasan Bulan Ini'
  };
  document.getElementById('summaryTitle').innerText = titles[filter];
  
  loadDashboard();
  loadTransactions();
}

// ======================
// DASHBOARD LOAD
// ======================

async function loadDashboard() {
  try {
    currentUser = await SheetsDB.getMe();
    
    if (!currentUser) {
      window.location.href = 'login-static.html';
      return;
    }
    
    document.getElementById('username').innerText = currentUser.name;
    document.getElementById('userEmail').innerText = `✉ ${currentUser.email}`;
    
    // Show admin badge if admin
    if (currentUser.isAdmin) {
      const adminBadge = document.createElement('span');
      adminBadge.className = 'admin-badge';
      adminBadge.innerText = 'Admin';
      document.querySelector('.user-info').appendChild(adminBadge);
    }

    const range = getDateRange(currentFilter);
    const summary = await SheetsDB.getSummary(range.start, range.end);

    const income = summary.income || 0;
    const expense = summary.expense || 0;
    const total = income + expense || 1;
    const balance = income - expense;

    document.getElementById('balance').innerText = formatNumber(balance);
    document.getElementById('net').innerText = formatNumber(balance);
    document.getElementById('income').innerText = formatNumber(income);
    document.getElementById('expense').innerText = formatNumber(expense);
    document.getElementById('trxIncome').innerText = formatNumber(income);
    document.getElementById('trxExpense').innerText = formatNumber(expense);

    document.getElementById('incomePercent').innerText = Math.round(income / total * 100) + '%';
    document.getElementById('expensePercent').innerText = Math.round(expense / total * 100) + '%';

    renderChart(income, expense);
  } catch (error) {
    console.error('Load dashboard error:', error);
    if (error.message === 'Not authenticated') {
      window.location.href = 'login-static.html';
    }
  }
}

function renderChart(income, expense) {
  const ctx = document.getElementById('pieChart').getContext('2d');
  
  if (chart) chart.destroy();
  
  chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Pemasukan', 'Pengeluaran'],
      datasets: [{
        data: [income, expense],
        backgroundColor: ['#29AB87', '#D5504E'],
        borderWidth: 0
      }]
    },
    options: {
      cutout: '70%',
      plugins: { legend: { display: false } }
    }
  });
}

// ======================
// TRANSACTIONS
// ======================

async function loadTransactions() {
  try {
    const range = getDateRange(currentFilter);
    const transactions = await SheetsDB.getTransactions(range.start, range.end);
    
    const list = document.getElementById('transactionList');
    list.innerHTML = '';

    if (!transactions || transactions.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px;">Belum ada transaksi</div>';
      return;
    }

    transactions.forEach(t => {
      const isIncome = t.type === 'income';
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <div class="item-icon ${isIncome ? 'income' : 'expense'}">${isIncome ? '↓' : '↑'}</div>
        <div class="item-info">
          <div class="item-title">${t.description || 'Transaksi'}</div>
          <div class="item-subtitle">${formatDate(t.date)}</div>
        </div>
        <div class="item-amount ${isIncome ? 'income' : 'expense'}">${isIncome ? '+' : '-'}Rp ${formatNumber(t.amount)}</div>
        <div class="item-actions">
          <button class="btn-icon" onclick="openEditTransaction('${t.id}', '${t.type}', ${t.amount}, '${t.description || ''}', '${t.date || ''}')">✏️</button>
          <button class="btn-icon" onclick="deleteTransaction('${t.id}')">🗑️</button>
        </div>
      `;
      list.appendChild(div);
    });
  } catch (error) {
    console.error('Load transactions error:', error);
  }
}

// ======================
// DEBTS
// ======================

async function loadDebts() {
  try {
    const debts = await SheetsDB.getDebts();
    
    const list = document.getElementById('debtList');
    list.innerHTML = '';

    if (!debts || debts.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px;">Belum ada utang/piutang</div>';
      return;
    }

    debts.forEach(d => {
      const isDebt = d.type === 'debt';
      const isPaid = d.status === 'paid';
      const div = document.createElement('div');
      div.className = 'list-item' + (isPaid ? ' paid' : '');
      div.innerHTML = `
        <div class="item-icon ${isDebt ? 'expense' : 'income'}">${isDebt ? '📤' : '📥'}</div>
        <div class="item-info">
          <div class="item-title">${d.name} ${isPaid ? '<span class="status-badge paid">Lunas</span>' : ''}</div>
          <div class="item-subtitle">${isDebt ? 'Utang' : 'Piutang'} • ${d.due_date ? 'Jatuh tempo: ' + formatDate(d.due_date) : 'Tanpa jatuh tempo'}</div>
        </div>
        <div class="item-amount ${isDebt ? 'expense' : 'income'}">Rp ${formatNumber(d.amount)}</div>
        <div class="item-actions">
          ${!isPaid ? `<button class="btn-icon" onclick="markDebtPaid('${d.id}')" title="Tandai Lunas">✅</button>` : ''}
          <button class="btn-icon" onclick="openEditDebt('${d.id}', '${d.type}', '${d.name}', ${d.amount}, '${d.due_date || ''}')">✏️</button>
          <button class="btn-icon" onclick="deleteDebt('${d.id}')">🗑️</button>
        </div>
      `;
      list.appendChild(div);
    });
  } catch (error) {
    console.error('Load debts error:', error);
  }
}

// ======================
// TRANSACTION CRUD
// ======================

function openAddTransaction() {
  editTransactionId = null;
  document.getElementById('modalTitle').innerText = 'Tambah Transaksi';
  document.getElementById('trxType').value = 'income';
  document.getElementById('trxAmount').value = '';
  document.getElementById('trxNote').value = '';
  document.getElementById('trxDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('transactionModal').classList.add('active');
}

function openEditTransaction(id, type, amount, note, date) {
  editTransactionId = id;
  document.getElementById('modalTitle').innerText = 'Edit Transaksi';
  document.getElementById('trxType').value = type;
  document.getElementById('trxAmount').value = amount;
  document.getElementById('trxNote').value = note;
  document.getElementById('trxDate').value = date || new Date().toISOString().split('T')[0];
  document.getElementById('transactionModal').classList.add('active');
}

async function saveTransaction() {
  const type = document.getElementById('trxType').value;
  const amount = parseFloat(document.getElementById('trxAmount').value);
  const description = document.getElementById('trxNote').value;
  const date = document.getElementById('trxDate').value;

  if (!amount || amount <= 0) {
    alert('Masukkan jumlah yang valid');
    return;
  }

  try {
    if (editTransactionId) {
      await SheetsDB.updateTransaction(editTransactionId, { type, amount, description, date });
    } else {
      await SheetsDB.addTransaction({ type, amount, description, date });
    }
    
    closeModal('transactionModal');
    loadDashboard();
    loadTransactions();
  } catch (error) {
    alert('Gagal menyimpan: ' + error.message);
  }
}

async function deleteTransaction(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  
  try {
    await SheetsDB.deleteTransaction(id);
    loadDashboard();
    loadTransactions();
  } catch (error) {
    alert('Gagal menghapus: ' + error.message);
  }
}

// ======================
// DEBT CRUD
// ======================

function openAddDebt() {
  editDebtId = null;
  document.getElementById('debtModalTitle').innerText = 'Tambah Utang/Piutang';
  document.getElementById('debtType').value = 'debt';
  document.getElementById('debtName').value = '';
  document.getElementById('debtAmount').value = '';
  document.getElementById('debtDueDate').value = '';
  document.getElementById('debtModal').classList.add('active');
}

function openEditDebt(id, type, name, amount, dueDate) {
  editDebtId = id;
  document.getElementById('debtModalTitle').innerText = 'Edit Utang/Piutang';
  document.getElementById('debtType').value = type;
  document.getElementById('debtName').value = name;
  document.getElementById('debtAmount').value = amount;
  document.getElementById('debtDueDate').value = dueDate;
  document.getElementById('debtModal').classList.add('active');
}

async function saveDebt() {
  const type = document.getElementById('debtType').value;
  const name = document.getElementById('debtName').value;
  const amount = parseFloat(document.getElementById('debtAmount').value);
  const due_date = document.getElementById('debtDueDate').value;

  if (!name || !amount || amount <= 0) {
    alert('Isi semua field dengan benar');
    return;
  }

  try {
    if (editDebtId) {
      await SheetsDB.updateDebt(editDebtId, { type, name, amount, due_date });
    } else {
      await SheetsDB.addDebt({ type, name, amount, due_date });
    }
    
    closeModal('debtModal');
    loadDebts();
  } catch (error) {
    alert('Gagal menyimpan: ' + error.message);
  }
}

async function markDebtPaid(id) {
  if (!confirm('Tandai sebagai lunas?')) return;
  
  try {
    await SheetsDB.updateDebtStatus(id, 'paid');
    loadDebts();
  } catch (error) {
    alert('Gagal update: ' + error.message);
  }
}

async function deleteDebt(id) {
  if (!confirm('Hapus data ini?')) return;
  
  try {
    await SheetsDB.deleteDebt(id);
    loadDebts();
  } catch (error) {
    alert('Gagal menghapus: ' + error.message);
  }
}

// ======================
// PROFILE
// ======================

function openProfileModal() {
  if (!currentUser) return;
  document.getElementById('profileName').value = currentUser.name;
  document.getElementById('profileEmail').value = currentUser.email;
  document.getElementById('profileModal').classList.add('active');
}

async function saveProfile() {
  const name = document.getElementById('profileName').value;
  
  try {
    await SheetsDB.updateProfile({ name });
    currentUser.name = name;
    localStorage.setItem('moncash_user', JSON.stringify(currentUser));
    closeModal('profileModal');
    loadDashboard();
  } catch (error) {
    alert('Gagal update: ' + error.message);
  }
}

// ======================
// MODAL & LOGOUT
// ======================

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

async function doLogout() {
  logout();
}

// ======================
// INIT
// ======================

document.addEventListener('DOMContentLoaded', () => {
  // Check auth
  if (!checkAuth()) {
    window.location.href = 'login-static.html';
    return;
  }
  
  // Load data
  loadDashboard();
  loadTransactions();
  loadDebts();
  
  // Setup filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });
  
  // Setup profile click
  const userInfo = document.querySelector('.user-info');
  if (userInfo) {
    userInfo.style.cursor = 'pointer';
    userInfo.addEventListener('click', openProfileModal);
  }
});
