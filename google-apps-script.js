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
