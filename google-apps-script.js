// ======================
// GOOGLE APPS SCRIPT - MonCash Backend
// ======================
// Deploy sebagai Web App untuk digunakan sebagai API
//
// SETUP:
// 1. Buka https://script.google.com
// 2. Buat project baru
// 3. Copy-paste seluruh code ini
// 4. Buat Google Sheet baru dan copy Sheet ID-nya
// 5. Ganti SPREADSHEET_ID di bawah dengan Sheet ID kamu
// 6. Deploy > New Deployment > Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 7. Copy URL dan paste ke CONFIG.SHEETS_API_URL di config.js

const SPREADSHEET_ID = '1WB1dPveW2OLfqLWBzrCzKT4oLjWSf4dY0xiX86iB5NA';

// Sheet names
const SHEETS = {
  USERS: 'users',
  TRANSACTIONS: 'transactions',
  DEBTS: 'debts'
};

// Initialize sheets if not exist
function initSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Users sheet
  let usersSheet = ss.getSheetByName(SHEETS.USERS);
  if (!usersSheet) {
    usersSheet = ss.insertSheet(SHEETS.USERS);
    usersSheet.appendRow(['id', 'email', 'name', 'created_at']);
  }
  
  // Transactions sheet
  let trxSheet = ss.getSheetByName(SHEETS.TRANSACTIONS);
  if (!trxSheet) {
    trxSheet = ss.insertSheet(SHEETS.TRANSACTIONS);
    trxSheet.appendRow(['id', 'user_id', 'type', 'amount', 'description', 'category', 'date', 'created_at']);
  }
  
  // Debts sheet
  let debtsSheet = ss.getSheetByName(SHEETS.DEBTS);
  if (!debtsSheet) {
    debtsSheet = ss.insertSheet(SHEETS.DEBTS);
    debtsSheet.appendRow(['id', 'user_id', 'type', 'name', 'amount', 'due_date', 'status', 'created_at']);
  }
}

// Generate unique ID
function generateId() {
  return Utilities.getUuid();
}

// Get sheet data as array of objects
function getSheetData(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map((row, index) => {
    const obj = { _rowIndex: index + 2 }; // +2 because 1-indexed and header row
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
}

// Find row by ID
function findRowById(sheetName, id) {
  const data = getSheetData(sheetName);
  return data.find(row => row.id === id);
}

// ======================
// API HANDLERS
// ======================

// Handle CORS preflight
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, userId, userEmail } = payload;
    
    let result;
    
    switch (action) {
      // User
      case 'updateProfile':
        result = updateProfile(userId, payload);
        break;
        
      // Transactions
      case 'getTransactions':
        result = getTransactions(userId, payload.startDate, payload.endDate);
        break;
      case 'addTransaction':
        result = addTransaction(userId, payload);
        break;
      case 'updateTransaction':
        result = updateTransaction(userId, payload.id, payload);
        break;
      case 'deleteTransaction':
        result = deleteTransaction(userId, payload.id);
        break;
        
      // Debts
      case 'getDebts':
        result = getDebts(userId);
        break;
      case 'addDebt':
        result = addDebt(userId, payload);
        break;
      case 'updateDebt':
        result = updateDebt(userId, payload.id, payload);
        break;
      case 'updateDebtStatus':
        result = updateDebtStatus(userId, payload.id, payload.status);
        break;
      case 'deleteDebt':
        result = deleteDebt(userId, payload.id);
        break;
        
      // Summary
      case 'getSummary':
        result = getSummary(userId, payload.startDate, payload.endDate);
        break;
        
      // Reports
      case 'sendMonthlyReport':
        result = sendMonthlyReport(userEmail, payload);
        break;
      case 'sendDebtReport':
        result = sendDebtReport(userEmail, payload);
        break;
        
      default:
        throw new Error('Unknown action: ' + action);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ data: result }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'MonCash API is running' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ======================
// USER FUNCTIONS
// ======================

function updateProfile(userId, data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEETS.USERS);
  
  // Create users sheet if not exists
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.USERS);
    sheet.appendRow(['id', 'email', 'name', 'created_at']);
  }
  
  const users = getSheetData(SHEETS.USERS);
  
  const user = users.find(u => u.id === userId);
  
  if (user) {
    // Update existing
    sheet.getRange(user._rowIndex, 3).setValue(data.name); // Column C = name
  } else {
    // Create new user
    sheet.appendRow([userId, data.userEmail, data.name, new Date().toISOString()]);
  }
  
  return { success: true };
}

// ======================
// TRANSACTION FUNCTIONS
// ======================

function getTransactions(userId, startDate, endDate) {
  const data = getSheetData(SHEETS.TRANSACTIONS);
  
  let filtered = data.filter(t => t.user_id === userId);
  
  if (startDate && endDate) {
    filtered = filtered.filter(t => {
      if (!t.date) return true;
      const d = new Date(t.date);
      return d >= new Date(startDate) && d <= new Date(endDate);
    });
  }
  
  // Sort by date desc
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  return filtered;
}

function addTransaction(userId, data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.TRANSACTIONS);
  
  const id = generateId();
  const date = data.date || new Date().toISOString().split('T')[0];
  
  sheet.appendRow([
    id,
    userId,
    data.type,
    data.amount,
    data.description || '',
    data.category || '',
    date,
    new Date().toISOString()
  ]);
  
  return { id, success: true };
}

function updateTransaction(userId, id, data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.TRANSACTIONS);
  const row = findRowById(SHEETS.TRANSACTIONS, id);
  
  if (!row || row.user_id !== userId) {
    throw new Error('Transaction not found');
  }
  
  const rowIndex = row._rowIndex;
  sheet.getRange(rowIndex, 3).setValue(data.type);
  sheet.getRange(rowIndex, 4).setValue(data.amount);
  sheet.getRange(rowIndex, 5).setValue(data.description || '');
  sheet.getRange(rowIndex, 6).setValue(data.category || '');
  sheet.getRange(rowIndex, 7).setValue(data.date || '');
  
  return { success: true };
}

function deleteTransaction(userId, id) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.TRANSACTIONS);
  const row = findRowById(SHEETS.TRANSACTIONS, id);
  
  if (!row || row.user_id !== userId) {
    throw new Error('Transaction not found');
  }
  
  sheet.deleteRow(row._rowIndex);
  
  return { success: true };
}

// ======================
// DEBT FUNCTIONS
// ======================

function getDebts(userId) {
  const data = getSheetData(SHEETS.DEBTS);
  return data.filter(d => d.user_id === userId);
}

function addDebt(userId, data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.DEBTS);
  
  const id = generateId();
  
  sheet.appendRow([
    id,
    userId,
    data.type,
    data.name,
    data.amount,
    data.due_date || '',
    'pending',
    new Date().toISOString()
  ]);
  
  return { id, success: true };
}

function updateDebt(userId, id, data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.DEBTS);
  const row = findRowById(SHEETS.DEBTS, id);
  
  if (!row || row.user_id !== userId) {
    throw new Error('Debt not found');
  }
  
  const rowIndex = row._rowIndex;
  sheet.getRange(rowIndex, 3).setValue(data.type);
  sheet.getRange(rowIndex, 4).setValue(data.name);
  sheet.getRange(rowIndex, 5).setValue(data.amount);
  sheet.getRange(rowIndex, 6).setValue(data.due_date || '');
  
  return { success: true };
}

function updateDebtStatus(userId, id, status) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.DEBTS);
  const row = findRowById(SHEETS.DEBTS, id);
  
  if (!row || row.user_id !== userId) {
    throw new Error('Debt not found');
  }
  
  sheet.getRange(row._rowIndex, 7).setValue(status);
  
  return { success: true };
}

function deleteDebt(userId, id) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.DEBTS);
  const row = findRowById(SHEETS.DEBTS, id);
  
  if (!row || row.user_id !== userId) {
    throw new Error('Debt not found');
  }
  
  sheet.deleteRow(row._rowIndex);
  
  return { success: true };
}

// ======================
// SUMMARY FUNCTION
// ======================

function getSummary(userId, startDate, endDate) {
  const transactions = getTransactions(userId, startDate, endDate);
  
  let income = 0;
  let expense = 0;
  
  transactions.forEach(t => {
    const amount = parseFloat(t.amount) || 0;
    if (t.type === 'income') {
      income += amount;
    } else if (t.type === 'expense') {
      expense += amount;
    }
  });
  
  return {
    income,
    expense,
    balance: income - expense
  };
}

// ======================
// EMAIL REPORT FUNCTIONS
// ======================

function formatNumberForEmail(num) {
  return num.toLocaleString('id-ID');
}

function formatDateForEmail(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function sendMonthlyReport(userEmail, data) {
  // Handle undefined data
  if (!data) {
    throw new Error('Data tidak boleh kosong');
  }
  
  const month = data.month || 'Unknown';
  const year = data.year || new Date().getFullYear();
  const income = data.income || 0;
  const expense = data.expense || 0;
  const balance = data.balance || 0;
  const transactions = data.transactions || [];
  
  // Build email HTML
  let transactionRows = '';
  if (transactions && transactions.length > 0) {
    transactions.forEach(t => {
      const isIncome = t.type === 'income';
      const amount = parseFloat(t.amount) || 0;
      transactionRows += `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${formatDateForEmail(t.date)}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${t.description || '-'}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${isIncome ? 'Masuk' : 'Keluar'}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:${isIncome ? '#29AB87' : '#D5504E'};">${isIncome ? '+' : '-'}Rp ${formatNumberForEmail(amount)}</td>
        </tr>
      `;
    });
  } else {
    transactionRows = '<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;">Tidak ada transaksi</td></tr>';
  }
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
    </head>
    <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="text-align:center;padding:20px;border-bottom:3px solid #29AB87;">
        <h1 style="margin:0;color:#1e293b;">📊 Rekap Keuangan</h1>
        <p style="margin:8px 0 0;color:#64748b;">${month} ${year}</p>
      </div>
      
      <div style="display:flex;gap:10px;margin:20px 0;">
        <div style="flex:1;background:#f0fdf4;padding:15px;border-radius:8px;border-left:4px solid #29AB87;">
          <p style="margin:0;font-size:12px;color:#64748b;">Total Pemasukan</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:bold;color:#29AB87;">Rp ${formatNumberForEmail(income)}</p>
        </div>
        <div style="flex:1;background:#fef2f2;padding:15px;border-radius:8px;border-left:4px solid #D5504E;">
          <p style="margin:0;font-size:12px;color:#64748b;">Total Pengeluaran</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:bold;color:#D5504E;">Rp ${formatNumberForEmail(expense)}</p>
        </div>
      </div>
      
      <div style="background:#eff6ff;padding:15px;border-radius:8px;border-left:4px solid #2563eb;margin-bottom:20px;">
        <p style="margin:0;font-size:12px;color:#64748b;">Saldo Bersih</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:bold;color:#2563eb;">Rp ${formatNumberForEmail(balance)}</p>
      </div>
      
      <h3 style="margin:20px 0 10px;color:#1e293b;">Detail Transaksi</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px;text-align:left;">Tanggal</th>
            <th style="padding:10px;text-align:left;">Deskripsi</th>
            <th style="padding:10px;text-align:left;">Tipe</th>
            <th style="padding:10px;text-align:left;">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          ${transactionRows}
        </tbody>
      </table>
      
      <div style="text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">Dibuat oleh MonCash • ${new Date().toLocaleDateString('id-ID')}</p>
      </div>
    </body>
    </html>
  `;
  
  GmailApp.sendEmail(userEmail, `Rekap Keuangan ${month} ${year} - MonCash`, '', {
    htmlBody: htmlBody
  });
  
  return { success: true };
}

function sendDebtReport(userEmail, data) {
  // Handle undefined data
  if (!data) {
    throw new Error('Data tidak boleh kosong');
  }
  
  const name = data.name || 'Unknown';
  const debts = data.debts || [];
  const totalDebt = data.totalDebt || 0;
  const totalReceivable = data.totalReceivable || 0;
  const unpaidDebt = data.unpaidDebt || 0;
  const unpaidReceivable = data.unpaidReceivable || 0;
  
  // Build email HTML
  let debtRows = '';
  if (debts && debts.length > 0) {
    debts.forEach(d => {
      const isDebt = d.type === 'debt';
      const isPaid = d.status === 'paid';
      const amount = parseFloat(d.amount) || 0;
      debtRows += `
        <tr style="${isPaid ? 'color:#94a3b8;' : ''}">
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${isDebt ? 'Utang' : 'Piutang'}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:${isDebt ? '#D5504E' : '#29AB87'};">Rp ${formatNumberForEmail(amount)}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${d.due_date ? formatDateForEmail(d.due_date) : '-'}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${isPaid ? '✅ Lunas' : '⏳ Belum'}</td>
        </tr>
      `;
    });
  } else {
    debtRows = '<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;">Tidak ada data</td></tr>';
  }
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
    </head>
    <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="text-align:center;padding:20px;border-bottom:3px solid #29AB87;">
        <h1 style="margin:0;color:#1e293b;">📋 Rekap Utang/Piutang</h1>
        <p style="margin:8px 0 0;color:#64748b;">Atas nama: <strong>${name}</strong></p>
      </div>
      
      <div style="display:flex;gap:10px;margin:20px 0;">
        <div style="flex:1;background:#fef2f2;padding:15px;border-radius:8px;border-left:4px solid #D5504E;">
          <p style="margin:0;font-size:12px;color:#64748b;">Total Utang</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:bold;color:#D5504E;">Rp ${formatNumberForEmail(totalDebt)}</p>
        </div>
        <div style="flex:1;background:#f0fdf4;padding:15px;border-radius:8px;border-left:4px solid #29AB87;">
          <p style="margin:0;font-size:12px;color:#64748b;">Total Piutang</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:bold;color:#29AB87;">Rp ${formatNumberForEmail(totalReceivable)}</p>
        </div>
      </div>
      
      <div style="display:flex;gap:10px;margin-bottom:20px;">
        <div style="flex:1;background:#fff;padding:15px;border-radius:8px;border:1px solid #fecaca;">
          <p style="margin:0;font-size:12px;color:#64748b;">Utang Belum Lunas</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:bold;color:#D5504E;">Rp ${formatNumberForEmail(unpaidDebt)}</p>
        </div>
        <div style="flex:1;background:#fff;padding:15px;border-radius:8px;border:1px solid #bbf7d0;">
          <p style="margin:0;font-size:12px;color:#64748b;">Piutang Belum Lunas</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:bold;color:#29AB87;">Rp ${formatNumberForEmail(unpaidReceivable)}</p>
        </div>
      </div>
      
      <h3 style="margin:20px 0 10px;color:#1e293b;">Detail Utang/Piutang</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px;text-align:left;">Tipe</th>
            <th style="padding:10px;text-align:left;">Jumlah</th>
            <th style="padding:10px;text-align:left;">Jatuh Tempo</th>
            <th style="padding:10px;text-align:left;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${debtRows}
        </tbody>
      </table>
      
      <div style="text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">Dibuat oleh MonCash • ${new Date().toLocaleDateString('id-ID')}</p>
      </div>
    </body>
    </html>
  `;
  
  GmailApp.sendEmail(userEmail, `Rekap Utang/Piutang - ${name} - MonCash`, '', {
    htmlBody: htmlBody
  });
  
  return { success: true };
}
