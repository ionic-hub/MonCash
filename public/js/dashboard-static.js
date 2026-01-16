let chart;
let editTransactionId = null;
let editDebtId = null;
let currentFilter = 'month';
let currentUser = null;
let isSaving = false; // Prevent double-click

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
      list.innerHTML = '<li style="text-align:center;color:#94a3b8;padding:20px;list-style:none;">Belum ada transaksi</li>';
      return;
    }

    // Calculate summary
    let trxIncome = 0, trxExpense = 0;
    
    transactions.forEach(t => {
      const isIncome = t.type === 'income';
      const amount = parseFloat(t.amount) || 0;
      
      if (isIncome) trxIncome += amount;
      else trxExpense += amount;
      
      const li = document.createElement('li');
      li.className = isIncome ? 'income' : 'expense';
      li.innerHTML = `
        <div class="trx-info">
          <span class="trx-title">${t.description || 'Transaksi'}</span>
          <span class="trx-date">${formatDate(t.date)}</span>
        </div>
        <div class="trx-right">
          <span class="trx-amount ${isIncome ? 'income' : 'expense'}">${isIncome ? '+' : '-'}Rp ${formatNumber(amount)}</span>
          <div class="trx-actions">
            <button class="btn icon" onclick="openEditTransaction('${t.id}', '${t.type}', ${amount}, '${(t.description || '').replace(/'/g, "\\'")}', '${t.date || ''}')">✏️</button>
            <button class="btn icon" onclick="deleteTransaction('${t.id}')">🗑️</button>
          </div>
        </div>
      `;
      list.appendChild(li);
    });
    
    // Update summary
    document.getElementById('trxIncome').innerText = formatNumber(trxIncome);
    document.getElementById('trxExpense').innerText = formatNumber(trxExpense);
    
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

    // Calculate totals
    let totalDebt = 0, totalReceivable = 0;

    debts.forEach(d => {
      const isDebt = d.type === 'debt';
      const isPaid = d.status === 'paid';
      const amount = parseFloat(d.amount) || 0;
      
      if (!isPaid) {
        if (isDebt) totalDebt += amount;
        else totalReceivable += amount;
      }
      
      const div = document.createElement('div');
      div.className = `debt-item ${isDebt ? 'debt' : 'receivable'}` + (isPaid ? ' paid' : '');
      div.innerHTML = `
        <div class="debt-header">
          <span class="debt-name">${d.name} ${isPaid ? '<span class="debt-status">Lunas</span>' : ''}</span>
          <span class="debt-amount"><span>Rp</span> ${formatNumber(amount)}</span>
        </div>
        <div class="debt-due">${isDebt ? 'Utang' : 'Piutang'} • ${d.due_date ? 'Jatuh tempo: ' + formatDate(d.due_date) : 'Tanpa jatuh tempo'}</div>
        <div class="debt-actions">
          ${!isPaid ? `<button class="btn-lunas" onclick="markDebtPaid('${d.id}')">Tandai Lunas</button>` : '<button class="btn-lunas paid" disabled>Sudah Lunas</button>'}
          <button class="btn icon" onclick="openEditDebt('${d.id}', '${d.type}', '${(d.name || '').replace(/'/g, "\\'")}', ${amount}, '${d.due_date || ''}')">✏️</button>
          <button class="btn icon" onclick="deleteDebt('${d.id}')">🗑️</button>
        </div>
      `;
      list.appendChild(div);
    });
    
    // Update totals
    document.getElementById('totalDebt').innerText = formatNumber(totalDebt);
    document.getElementById('totalReceivable').innerText = formatNumber(totalReceivable);
    
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
  document.getElementById('transactionModal').classList.remove('hidden');
}

function openEditTransaction(id, type, amount, note, date) {
  editTransactionId = id;
  document.getElementById('modalTitle').innerText = 'Edit Transaksi';
  document.getElementById('trxType').value = type;
  document.getElementById('trxAmount').value = amount;
  document.getElementById('trxNote').value = note;
  document.getElementById('trxDate').value = date || new Date().toISOString().split('T')[0];
  document.getElementById('transactionModal').classList.remove('hidden');
}

async function saveTransaction() {
  if (isSaving) return; // Prevent double-click
  
  const type = document.getElementById('trxType').value;
  const amount = parseFloat(document.getElementById('trxAmount').value);
  const description = document.getElementById('trxNote').value;
  const date = document.getElementById('trxDate').value;

  if (!amount || amount <= 0) {
    alert('Masukkan jumlah yang valid');
    return;
  }

  isSaving = true;
  const saveBtn = document.querySelector('#transactionModal .btn-save');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = 'Menyimpan...';
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
  } finally {
    isSaving = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = 'Simpan';
    }
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
  document.getElementById('debtModal').classList.remove('hidden');
}

function openEditDebt(id, type, name, amount, dueDate) {
  editDebtId = id;
  document.getElementById('debtModalTitle').innerText = 'Edit Utang/Piutang';
  document.getElementById('debtType').value = type;
  document.getElementById('debtName').value = name;
  document.getElementById('debtAmount').value = amount;
  document.getElementById('debtDueDate').value = dueDate;
  document.getElementById('debtModal').classList.remove('hidden');
}

async function saveDebt() {
  if (isSaving) return; // Prevent double-click
  
  const type = document.getElementById('debtType').value;
  const name = document.getElementById('debtName').value;
  const amount = parseFloat(document.getElementById('debtAmount').value);
  const due_date = document.getElementById('debtDueDate').value;

  if (!name || !amount || amount <= 0) {
    alert('Isi semua field dengan benar');
    return;
  }

  isSaving = true;
  const saveBtn = document.querySelector('#debtModal .btn-save');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = 'Menyimpan...';
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
  } finally {
    isSaving = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = 'Simpan';
    }
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
  document.getElementById('profileModal').classList.remove('hidden');
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
  document.getElementById(id).classList.add('hidden');
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
