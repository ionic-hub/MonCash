// ======================
// GOOGLE SHEETS API CLIENT
// ======================

const SheetsDB = {
  // Current user data
  currentUser: null,
  
  // Initialize - called after Google Sign-In
  init(user) {
    this.currentUser = user;
    localStorage.setItem('moncash_user', JSON.stringify(user));
  },
  
  // Get stored user
  getStoredUser() {
    const stored = localStorage.getItem('moncash_user');
    if (stored) {
      this.currentUser = JSON.parse(stored);
      return this.currentUser;
    }
    return null;
  },
  
  // Clear user
  logout() {
    this.currentUser = null;
    localStorage.removeItem('moncash_user');
  },
  
  // API call helper
  async apiCall(action, data = {}) {
    if (!this.currentUser) {
      throw new Error('Not authenticated');
    }
    
    const payload = {
      action,
      userId: this.currentUser.id,
      userEmail: this.currentUser.email,
      ...data
    };
    
    try {
      const response = await fetch(CONFIG.SHEETS_API_URL, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify(payload)
      });
      
      const text = await response.text();
      let result;
      
      try {
        result = JSON.parse(text);
      } catch {
        console.error('Failed to parse response:', text);
        throw new Error('Invalid response from server');
      }
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },
  
  // ======================
  // USER METHODS
  // ======================
  
  async getMe() {
    return this.currentUser;
  },
  
  async updateProfile(data) {
    return await this.apiCall('updateProfile', data);
  },
  
  // ======================
  // TRANSACTIONS METHODS
  // ======================
  
  async getTransactions(startDate, endDate) {
    return await this.apiCall('getTransactions', { startDate, endDate });
  },
  
  async addTransaction(data) {
    return await this.apiCall('addTransaction', data);
  },
  
  async updateTransaction(id, data) {
    return await this.apiCall('updateTransaction', { id, ...data });
  },
  
  async deleteTransaction(id) {
    return await this.apiCall('deleteTransaction', { id });
  },
  
  // ======================
  // DEBTS METHODS
  // ======================
  
  async getDebts() {
    return await this.apiCall('getDebts');
  },
  
  async addDebt(data) {
    return await this.apiCall('addDebt', data);
  },
  
  async updateDebt(id, data) {
    return await this.apiCall('updateDebt', { id, ...data });
  },
  
  async updateDebtStatus(id, status) {
    return await this.apiCall('updateDebtStatus', { id, status });
  },
  
  async deleteDebt(id) {
    return await this.apiCall('deleteDebt', { id });
  },
  
  // ======================
  // DEBT PAYMENTS (Cicilan)
  // ======================
  
  async getDebtPayments(debtId) {
    return await this.apiCall('getDebtPayments', { debtId });
  },
  
  async addDebtPayment(data) {
    return await this.apiCall('addDebtPayment', data);
  },
  
  async deleteDebtPayment(id) {
    return await this.apiCall('deleteDebtPayment', { id });
  },
  
  // ======================
  // SUMMARY METHODS
  // ======================
  
  async getSummary(startDate, endDate) {
    return await this.apiCall('getSummary', { startDate, endDate });
  },
  
  // ======================
  // REPORT METHODS
  // ======================
  
  async sendMonthlyReport(data) {
    return await this.apiCall('sendMonthlyReport', data);
  },
  
  async sendDebtReport(data) {
    return await this.apiCall('sendDebtReport', data);
  }
};
