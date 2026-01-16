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
  
  // Set default month for report
  const reportMonthInput = document.getElementById('reportMonth');
  if (reportMonthInput) {
    const now = new Date();
    reportMonthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
});

// ======================
// MONTHLY REPORT
// ======================

let monthlyReportData = null;

function openMonthlyReportModal() {
  // Reset state
  monthlyReportData = null;
  document.getElementById('monthlyReportPreview').classList.add('hidden');
  document.getElementById('monthlyReportActions').classList.add('hidden');
  document.getElementById('monthlyReportClose').classList.remove('hidden');
  
  // Set current month
  const now = new Date();
  document.getElementById('reportMonth').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  document.getElementById('monthlyReportModal').classList.remove('hidden');
}

async function generateMonthlyReport() {
  const monthValue = document.getElementById('reportMonth').value;
  if (!monthValue) {
    alert('Pilih bulan terlebih dahulu');
    return;
  }
  
  const [year, month] = monthValue.split('-');
  const startDate = `${year}-${month}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${month}-${lastDay}`;
  
  try {
    // Get transactions for the month
    const transactions = await SheetsDB.getTransactions(startDate, endDate);
    
    // Calculate summary
    let income = 0, expense = 0;
    transactions.forEach(t => {
      const amount = parseFloat(t.amount) || 0;
      if (t.type === 'income') income += amount;
      else expense += amount;
    });
    
    const balance = income - expense;
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const monthName = monthNames[parseInt(month) - 1];
    
    // Store data for email
    monthlyReportData = {
      month: monthName,
      year: year,
      income: income,
      expense: expense,
      balance: balance,
      transactions: transactions
    };
    
    // Generate preview HTML
    let html = `
      <div class="report-header">
        <h2>Rekap Keuangan</h2>
        <p>${monthName} ${year}</p>
      </div>
      
      <div class="report-summary">
        <div class="report-summary-item income">
          <label>Total Pemasukan</label>
          <strong>Rp ${formatNumber(income)}</strong>
        </div>
        <div class="report-summary-item expense">
          <label>Total Pengeluaran</label>
          <strong>Rp ${formatNumber(expense)}</strong>
        </div>
        <div class="report-summary-item balance">
          <label>Saldo Bersih</label>
          <strong>Rp ${formatNumber(balance)}</strong>
        </div>
      </div>
      
      <table class="report-table">
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Deskripsi</th>
            <th>Tipe</th>
            <th>Jumlah</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    if (transactions.length === 0) {
      html += `<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Tidak ada transaksi</td></tr>`;
    } else {
      transactions.forEach(t => {
        const isIncome = t.type === 'income';
        html += `
          <tr>
            <td>${formatDate(t.date)}</td>
            <td>${t.description || '-'}</td>
            <td>${isIncome ? 'Masuk' : 'Keluar'}</td>
            <td class="${isIncome ? 'income' : 'expense'}">${isIncome ? '+' : '-'}Rp ${formatNumber(parseFloat(t.amount) || 0)}</td>
          </tr>
        `;
      });
    }
    
    html += `
        </tbody>
      </table>
      
      <div class="report-footer">
        Dibuat oleh MonCash • ${new Date().toLocaleDateString('id-ID')}
      </div>
    `;
    
    document.getElementById('monthlyReportPreview').innerHTML = html;
    document.getElementById('monthlyReportPreview').classList.remove('hidden');
    document.getElementById('monthlyReportActions').classList.remove('hidden');
    document.getElementById('monthlyReportClose').classList.add('hidden');
    
  } catch (error) {
    alert('Gagal generate rekap: ' + error.message);
  }
}

async function sendMonthlyReportEmail() {
  if (!monthlyReportData) {
    alert('Generate rekap terlebih dahulu');
    return;
  }
  
  if (!confirm(`Kirim rekap ${monthlyReportData.month} ${monthlyReportData.year} ke email ${currentUser.email}?`)) {
    return;
  }
  
  try {
    const btn = document.querySelector('#monthlyReportActions .btn.primary');
    btn.disabled = true;
    btn.innerText = 'Mengirim...';
    
    await SheetsDB.sendMonthlyReport({
      month: monthlyReportData.month,
      year: monthlyReportData.year,
      income: monthlyReportData.income,
      expense: monthlyReportData.expense,
      balance: monthlyReportData.balance,
      transactions: monthlyReportData.transactions
    });
    
    alert('Rekap berhasil dikirim ke email!');
    closeModal('monthlyReportModal');
    
  } catch (error) {
    alert('Gagal mengirim: ' + error.message);
  } finally {
    const btn = document.querySelector('#monthlyReportActions .btn.primary');
    if (btn) {
      btn.disabled = false;
      btn.innerText = '📧 Kirim ke Email';
    }
  }
}

// Print monthly report
function printMonthlyReport() {
  if (!monthlyReportData) {
    alert('Generate rekap terlebih dahulu');
    return;
  }
  
  const printContent = document.getElementById('monthlyReportPreview').innerHTML;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Rekap Bulanan - ${monthlyReportData.month} ${monthlyReportData.year}</title>
      <style>
        * {
          box-sizing: border-box;
          font-family: 'Segoe UI', Arial, sans-serif;
        }
        body {
          margin: 0;
          padding: 20px;
          background: white;
          color: #1e293b;
        }
        .report-header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 3px solid #29AB87;
        }
        .report-header h2 {
          margin: 0 0 8px;
          color: #1e293b;
          font-size: 24px;
        }
        .report-header p {
          margin: 0;
          color: #64748b;
          font-size: 16px;
        }
        .report-summary {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .report-summary-item {
          flex: 1;
          min-width: 150px;
          background: #f8fafc;
          padding: 16px;
          border-radius: 8px;
          text-align: center;
          border: 1px solid #e2e8f0;
        }
        .report-summary-item.income {
          border-left: 4px solid #29AB87;
        }
        .report-summary-item.expense {
          border-left: 4px solid #D5504E;
        }
        .report-summary-item.balance {
          border-left: 4px solid #2563eb;
        }
        .report-summary-item label {
          display: block;
          font-size: 12px;
          color: #64748b;
          margin-bottom: 4px;
        }
        .report-summary-item strong {
          font-size: 18px;
          color: #1e293b;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          margin-bottom: 20px;
        }
        .report-table th,
        .report-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }
        .report-table th {
          background: #f1f5f9;
          font-weight: 600;
          color: #475569;
        }
        .report-table .income {
          color: #29AB87;
        }
        .report-table .expense {
          color: #D5504E;
        }
        .report-footer {
          text-align: center;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
          font-size: 12px;
          color: #94a3b8;
        }
        @media print {
          body {
            padding: 0;
          }
          .report-summary-item {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      ${printContent}
    </body>
    </html>
  `);
  
  printWindow.document.close();
  
  // Wait for content to load then print
  printWindow.onload = function() {
    printWindow.focus();
    printWindow.print();
  };
}

// ======================
// DEBT REPORT
// ======================

let debtReportData = null;
let allDebts = [];

async function openDebtReportModal() {
  // Reset state
  debtReportData = null;
  document.getElementById('debtReportPreview').classList.add('hidden');
  document.getElementById('debtReportActions').classList.add('hidden');
  document.getElementById('debtReportClose').classList.remove('hidden');
  
  // Load all debts and populate name dropdown
  try {
    allDebts = await SheetsDB.getDebts();
    
    // Get unique names
    const names = [...new Set(allDebts.map(d => d.name).filter(n => n))];
    
    const select = document.getElementById('debtReportName');
    select.innerHTML = '<option value="">-- Pilih Nama --</option>';
    names.forEach(name => {
      select.innerHTML += `<option value="${name}">${name}</option>`;
    });
    
  } catch (error) {
    console.error('Load debts error:', error);
  }
  
  document.getElementById('debtReportModal').classList.remove('hidden');
}

async function generateDebtReport() {
  const selectedName = document.getElementById('debtReportName').value;
  if (!selectedName) {
    alert('Pilih nama terlebih dahulu');
    return;
  }
  
  // Filter debts by name
  const filteredDebts = allDebts.filter(d => d.name === selectedName);
  
  // Calculate totals
  let totalDebt = 0, totalReceivable = 0;
  let paidDebt = 0, paidReceivable = 0;
  
  filteredDebts.forEach(d => {
    const amount = parseFloat(d.amount) || 0;
    const isPaid = d.status === 'paid';
    
    if (d.type === 'debt') {
      totalDebt += amount;
      if (isPaid) paidDebt += amount;
    } else {
      totalReceivable += amount;
      if (isPaid) paidReceivable += amount;
    }
  });
  
  // Store data for email
  debtReportData = {
    name: selectedName,
    debts: filteredDebts,
    totalDebt: totalDebt,
    totalReceivable: totalReceivable,
    paidDebt: paidDebt,
    paidReceivable: paidReceivable,
    unpaidDebt: totalDebt - paidDebt,
    unpaidReceivable: totalReceivable - paidReceivable
  };
  
  // Generate preview HTML
  let html = `
    <div class="report-header">
      <h2>Rekap Utang/Piutang</h2>
      <p>Atas nama: <strong>${selectedName}</strong></p>
    </div>
    
    <div class="report-summary">
      <div class="report-summary-item debt">
        <label>Total Utang</label>
        <strong>Rp ${formatNumber(totalDebt)}</strong>
      </div>
      <div class="report-summary-item receivable">
        <label>Total Piutang</label>
        <strong>Rp ${formatNumber(totalReceivable)}</strong>
      </div>
    </div>
    
    <div class="report-summary">
      <div class="report-summary-item debt">
        <label>Utang Belum Lunas</label>
        <strong>Rp ${formatNumber(totalDebt - paidDebt)}</strong>
      </div>
      <div class="report-summary-item receivable">
        <label>Piutang Belum Lunas</label>
        <strong>Rp ${formatNumber(totalReceivable - paidReceivable)}</strong>
      </div>
    </div>
    
    <table class="report-table">
      <thead>
        <tr>
          <th>Tipe</th>
          <th>Jumlah</th>
          <th>Jatuh Tempo</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  if (filteredDebts.length === 0) {
    html += `<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Tidak ada data</td></tr>`;
  } else {
    filteredDebts.forEach(d => {
      const isDebt = d.type === 'debt';
      const isPaid = d.status === 'paid';
      html += `
        <tr class="${isPaid ? 'paid' : ''}">
          <td>${isDebt ? 'Utang' : 'Piutang'}</td>
          <td class="${isDebt ? 'debt' : 'receivable'}">Rp ${formatNumber(parseFloat(d.amount) || 0)}</td>
          <td>${d.due_date ? formatDate(d.due_date) : '-'}</td>
          <td>${isPaid ? '✅ Lunas' : '⏳ Belum Lunas'}</td>
        </tr>
      `;
    });
  }
  
  html += `
      </tbody>
    </table>
    
    <div class="report-footer">
      Dibuat oleh MonCash • ${new Date().toLocaleDateString('id-ID')}
    </div>
  `;
  
  document.getElementById('debtReportPreview').innerHTML = html;
  document.getElementById('debtReportPreview').classList.remove('hidden');
  document.getElementById('debtReportActions').classList.remove('hidden');
  document.getElementById('debtReportClose').classList.add('hidden');
}

async function sendDebtReportEmail() {
  if (!debtReportData) {
    alert('Generate rekap terlebih dahulu');
    return;
  }
  
  if (!confirm(`Kirim rekap utang/piutang ${debtReportData.name} ke email ${currentUser.email}?`)) {
    return;
  }
  
  try {
    const btn = document.querySelector('#debtReportActions .btn.primary');
    btn.disabled = true;
    btn.innerText = 'Mengirim...';
    
    await SheetsDB.sendDebtReport({
      name: debtReportData.name,
      debts: debtReportData.debts,
      totalDebt: debtReportData.totalDebt,
      totalReceivable: debtReportData.totalReceivable,
      unpaidDebt: debtReportData.unpaidDebt,
      unpaidReceivable: debtReportData.unpaidReceivable
    });
    
    alert('Rekap berhasil dikirim ke email!');
    closeModal('debtReportModal');
    
  } catch (error) {
    alert('Gagal mengirim: ' + error.message);
  } finally {
    const btn = document.querySelector('#debtReportActions .btn.primary');
    if (btn) {
      btn.disabled = false;
      btn.innerText = '📧 Kirim ke Email';
    }
  }
}

// Print debt report
function printDebtReport() {
  if (!debtReportData) {
    alert('Generate rekap terlebih dahulu');
    return;
  }
  
  const printContent = document.getElementById('debtReportPreview').innerHTML;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Rekap Utang/Piutang - ${debtReportData.name}</title>
      <style>
        * {
          box-sizing: border-box;
          font-family: 'Segoe UI', Arial, sans-serif;
        }
        body {
          margin: 0;
          padding: 20px;
          background: white;
          color: #1e293b;
        }
        .report-header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 3px solid #29AB87;
        }
        .report-header h2 {
          margin: 0 0 8px;
          color: #1e293b;
          font-size: 24px;
        }
        .report-header p {
          margin: 0;
          color: #64748b;
          font-size: 16px;
        }
        .report-summary {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .report-summary-item {
          flex: 1;
          min-width: 150px;
          background: #f8fafc;
          padding: 16px;
          border-radius: 8px;
          text-align: center;
          border: 1px solid #e2e8f0;
        }
        .report-summary-item.debt {
          border-left: 4px solid #D5504E;
        }
        .report-summary-item.receivable {
          border-left: 4px solid #29AB87;
        }
        .report-summary-item label {
          display: block;
          font-size: 12px;
          color: #64748b;
          margin-bottom: 4px;
        }
        .report-summary-item strong {
          font-size: 18px;
          color: #1e293b;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          margin-bottom: 20px;
        }
        .report-table th,
        .report-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }
        .report-table th {
          background: #f1f5f9;
          font-weight: 600;
          color: #475569;
        }
        .report-table .debt {
          color: #D5504E;
        }
        .report-table .receivable {
          color: #29AB87;
        }
        .report-table .paid {
          color: #94a3b8;
          text-decoration: line-through;
        }
        .report-footer {
          text-align: center;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
          font-size: 12px;
          color: #94a3b8;
        }
        @media print {
          body {
            padding: 0;
          }
          .report-summary-item {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      ${printContent}
    </body>
    </html>
  `);
  
  printWindow.document.close();
  
  // Wait for content to load then print
  printWindow.onload = function() {
    printWindow.focus();
    printWindow.print();
  };
}
