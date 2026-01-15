let chart
let editTransactionId = null
let editDebtId = null
let currentFilter = 'month' // default filter
let currentUser = null

// Format angka dengan pemisah ribuan
function formatNumber(num) {
  return num.toLocaleString('id-ID')
}

// Format tanggal
function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Get date range based on filter
function getDateRange(filter) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  let startDate, endDate
  endDate = new Date(today)
  endDate.setHours(23, 59, 59, 999)
  
  switch(filter) {
    case 'today':
      startDate = new Date(today)
      break
    case 'week':
      startDate = new Date(today)
      startDate.setDate(startDate.getDate() - 6)
      break
    case 'month':
    default:
      startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      break
  }
  
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  }
}

// Set filter and reload data
function setFilter(filter) {
  currentFilter = filter
  
  // Update button states
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active')
    if (btn.dataset.filter === filter) {
      btn.classList.add('active')
    }
  })
  
  // Update title
  const titles = {
    'today': 'Ringkasan Hari Ini',
    'week': 'Ringkasan 7 Hari Terakhir',
    'month': 'Ringkasan Bulan Ini'
  }
  document.getElementById('summaryTitle').innerText = titles[filter]
  
  // Reload data
  loadDashboard()
  loadTransactions()
}

async function loadDashboard() {
  const user = await fetch('/me').then(r => r.json())
  currentUser = user
  document.getElementById('username').innerText = user.name
  document.getElementById('userEmail').innerText = `✉ ${user.email}`

  const range = getDateRange(currentFilter)
  const summary = await fetch(`/summary?start=${range.start}&end=${range.end}`).then(r => r.json())

  const income = summary.income || 0
  const expense = summary.expense || 0
  const total = income + expense || 1
  const balance = income - expense

  document.getElementById('balance').innerText = formatNumber(balance)
  document.getElementById('net').innerText = formatNumber(balance)
  document.getElementById('income').innerText = formatNumber(income)
  document.getElementById('expense').innerText = formatNumber(expense)
  document.getElementById('trxIncome').innerText = formatNumber(income)
  document.getElementById('trxExpense').innerText = formatNumber(expense)

  document.getElementById('incomePercent').innerText = Math.round(income / total * 100) + '%'
  document.getElementById('expensePercent').innerText = Math.round(expense / total * 100) + '%'

  renderChart(income, expense)
}

function renderChart(income, expense) {
  if (chart) chart.destroy()

  chart = new Chart(pieChart, {
    type: 'doughnut',
    data: {
      labels: ['Income', 'Expense'],
      datasets: [{
        data: income + expense === 0 ? [1, 0] : [income, expense],
        backgroundColor: ['#29AB87', '#D5504E']
      }]
    }
  })
}

async function loadTransactions() {
  const range = getDateRange(currentFilter)
  const data = await fetch(`/transactions?start=${range.start}&end=${range.end}`).then(r => r.json())
  transactionList.innerHTML = ''

  data.forEach(t => {
    // Format date untuk input type="date" (YYYY-MM-DD)
    const dateForInput = t.date ? t.date.split('T')[0] : ''
    
    const li = document.createElement('li')
    li.className = t.type
    li.innerHTML = `
      <div class="trx-info">
        <span class="trx-title">${t.description || '-'}</span>
        <span class="trx-category">${t.category || (t.type === 'income' ? 'Pemasukan' : 'Pengeluaran')}</span>
        <span class="trx-date">📅 ${formatDate(t.date)}</span>
      </div>
      <div class="trx-right">
        <span class="trx-amount ${t.type}">${t.type === 'income' ? '+' : '-'} Rp ${formatNumber(t.amount)}</span>
        <div class="trx-actions">
          <button class="btn-icon" onclick="editTransaction(${t.id}, '${t.type}', ${t.amount}, '${(t.description || '').replace(/'/g, "\\'")}', '${t.category || ''}', '${dateForInput}')">✏️</button>
          <button class="btn-icon" onclick="deleteTransaction(${t.id})">🗑️</button>
        </div>
      </div>
    `
    transactionList.appendChild(li)
  })
}

function editTransaction(id, type, amount, description, category, date) {
  editTransactionId = id
  trxType.value = type
  trxAmount.value = amount
  trxNote.value = description
  document.getElementById('trxCategory').value = category || ''
  document.getElementById('trxDate').value = date || ''
  document.getElementById('trxModalTitle').innerText = 'Edit Transaksi'
  transactionModal.classList.remove('hidden')
}

async function deleteTransaction(id) {
  if (!confirm('Hapus transaksi ini?')) return
  await fetch('/transactions/' + id, { method: 'DELETE' })
  loadDashboard()
  loadTransactions()
}

function openTransactionModal() {
  editTransactionId = null
  trxType.value = 'income'
  trxAmount.value = ''
  trxNote.value = ''
  document.getElementById('trxCategory').value = ''
  document.getElementById('trxDate').value = new Date().toISOString().split('T')[0]
  document.getElementById('trxModalTitle').innerText = 'Tambah Transaksi'
  transactionModal.classList.remove('hidden')
}

async function saveTransaction() {
  const dateValue = document.getElementById('trxDate').value || new Date().toISOString().split('T')[0]
  const payload = {
    type: trxType.value,
    amount: Number(trxAmount.value),
    description: trxNote.value,
    category: document.getElementById('trxCategory').value,
    date: dateValue
  }

  if (editTransactionId) {
    await fetch('/transactions/' + editTransactionId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } else {
    await fetch('/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  }

  closeTransactionModal()
  loadDashboard()
  loadTransactions()
}

/* DEBT */
async function loadDebts() {
  const data = await fetch('/debts').then(r => r.json())
  debtList.innerHTML = ''

  let totalDebt = 0
  let totalReceivable = 0

  data.forEach(d => {
    if (d.type === 'debt') totalDebt += d.amount
    else totalReceivable += d.amount

    const div = document.createElement('div')
    div.className = 'debt-item ' + d.type
    div.innerHTML = `
      <div class="debt-header">
        <span class="debt-name">${d.name}${d.status === 'paid' ? '<span class="debt-status">Lunas</span>' : ''}</span>
        <span class="debt-amount"><span>Rp</span> ${formatNumber(d.amount)}</span>
      </div>
      <div class="debt-due">Jatuh tempo: ${formatDate(d.due_date)}</div>
      <div class="debt-actions">
        <button class="btn-lunas ${d.status === 'paid' ? 'paid' : ''}" onclick="toggleDebtStatus(${d.id}, '${d.status}')">${d.status === 'paid' ? 'Tandai Belum Lunas' : 'Tandai Lunas'}</button>
        <button class="btn-icon" onclick="editDebt(${d.id}, '${d.type}', '${d.name.replace(/'/g, "\\'")}', ${d.amount}, '${d.due_date || ''}')">✏️</button>
        <button class="btn-icon" onclick="deleteDebt(${d.id})">🗑️</button>
      </div>
    `
    debtList.appendChild(div)
  })

  document.getElementById('totalDebt').innerText = formatNumber(totalDebt)
  document.getElementById('totalReceivable').innerText = formatNumber(totalReceivable)
}

async function toggleDebtStatus(id, currentStatus) {
  const newStatus = currentStatus === 'paid' ? 'open' : 'paid'
  await fetch('/debts/' + id + '/status', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  })
  loadDebts()
}

function editDebt(id, type, name, amount, dueDate) {
  editDebtId = id
  debtType.value = type
  debtName.value = name
  debtAmount.value = amount
  document.getElementById('debtDueDate').value = dueDate || ''
  document.getElementById('debtModalTitle').innerText = 'Edit Utang / Piutang'
  debtModal.classList.remove('hidden')
}

async function deleteDebt(id) {
  if (!confirm('Hapus data ini?')) return
  await fetch('/debts/' + id, { method: 'DELETE' })
  loadDebts()
}

function openDebtModal() {
  editDebtId = null
  debtType.value = 'debt'
  debtName.value = ''
  debtAmount.value = ''
  document.getElementById('debtDueDate').value = ''
  document.getElementById('debtModalTitle').innerText = 'Tambah Utang / Piutang'
  debtModal.classList.remove('hidden')
}

async function saveDebt() {
  const payload = {
    type: debtType.value,
    name: debtName.value,
    amount: Number(debtAmount.value),
    due_date: document.getElementById('debtDueDate').value || null
  }

  if (editDebtId) {
    await fetch('/debts/' + editDebtId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } else {
    await fetch('/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  }

  closeDebtModal()
  loadDebts()
}

/* MODALS */
function closeTransactionModal() {
  transactionModal.classList.add('hidden')
}

function closeDebtModal() {
  debtModal.classList.add('hidden')
}

/* PROFILE */
function openProfileModal() {
  if (currentUser) {
    document.getElementById('profileName').value = currentUser.name || ''
    document.getElementById('profileEmail').value = currentUser.email || ''
    document.getElementById('profilePhone').value = currentUser.phone || ''
  }
  document.getElementById('profileModal').classList.remove('hidden')
}

function closeProfileModal() {
  document.getElementById('profileModal').classList.add('hidden')
}

async function saveProfile() {
  const payload = {
    name: document.getElementById('profileName').value,
    email: document.getElementById('profileEmail').value,
    phone: document.getElementById('profilePhone').value
  }

  const res = await fetch('/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (res.ok) {
    closeProfileModal()
    loadDashboard()
    alert('Profil berhasil diupdate!')
  } else {
    alert('Gagal update profil')
  }
}

/* LOGOUT */
async function logout() {
  await fetch('/logout', { method: 'POST' })
  location.href = '/login.html'
}

loadDashboard()
loadTransactions()
loadDebts()
