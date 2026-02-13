// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN SERVICE - Real Data Management for Admin Panel
// ═══════════════════════════════════════════════════════════════════════════════

import { API, getAuthHeaders } from '../config/api';

const STORAGE_KEYS = {
  USERS: 'moneysaarthi_all_users',
  TRANSACTIONS: 'moneysaarthi_transactions',
  SIGNALS: 'moneysaarthi_signals',
  ANNOUNCEMENTS: 'moneysaarthi_announcements',
  SYSTEM_CONFIG: 'moneysaarthi_system_config',
  PAYMENT_CONFIG: 'moneysaarthi_payment_config',
};

// ═══════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// Get all registered users from backend API
export const fetchUsersFromBackend = async () => {
  try {
    const headers = getAuthHeaders();
    const response = await fetch(`${API}/admin/users`, {
      headers,
      credentials: 'include' // Include cookies for session
    });
    
    if (response.ok) {
      const backendUsers = await response.json();
      
      // Get local users and merge (for users who logged in before backend sync)
      const localUsers = getAllUsersFromStorage();
      
      // Merge: backend users take priority, add local users not in backend
      const backendEmails = new Set(backendUsers.map(u => u.email?.toLowerCase()));
      const uniqueLocalUsers = localUsers.filter(u => !backendEmails.has(u.email?.toLowerCase()));
      
      const mergedUsers = [...backendUsers, ...uniqueLocalUsers];
      
      // Cache merged list
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(mergedUsers));
      return mergedUsers;
    }
    
    const errorText = await response.text();
    console.warn('❌ Failed to fetch users from backend:', response.status, errorText);
    return getAllUsersFromStorage();
  } catch (e) {
    console.error('❌ Error fetching users from backend:', e);
    return getAllUsersFromStorage();
  }
};

// Get users from localStorage (fallback)
const getAllUsersFromStorage = () => {
  try {
    const users = localStorage.getItem(STORAGE_KEYS.USERS);
    return users ? JSON.parse(users) : [];
  } catch (e) {
    console.error('Error getting users from storage:', e);
    return [];
  }
};

// Sync version - returns cached users (for compatibility)
export const getAllUsers = () => {
  return getAllUsersFromStorage();
};

// Save user to users list (called on login/signup)
export const saveUserToList = (user) => {
  try {
    const users = getAllUsers();
    const existingIndex = users.findIndex(u => u.email === user.email);
    
    const userData = {
      id: user.id || Date.now(),
      name: user.name,
      email: user.email,
      picture: user.picture,
      plan: user.subscription?.plan || 'free',
      billingCycle: user.subscription?.billingCycle || null,
      status: 'active',
      joinedAt: user.joinedAt || new Date().toISOString().split('T')[0],
      lastActive: new Date().toISOString(),
      trades: user.trades || 0,
      revenue: user.subscription?.plan === 'pro' 
        ? (user.subscription?.billingCycle === 'yearly' ? 4999 : 899) 
        : 0,
    };

    if (existingIndex >= 0) {
      users[existingIndex] = { ...users[existingIndex], ...userData, lastActive: new Date().toISOString() };
    } else {
      users.push(userData);
    }

    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    return userData;
  } catch (e) {
    console.error('Error saving user:', e);
    return null;
  }
};

// Update user
export const updateUser = (email, updates) => {
  try {
    const users = getAllUsers();
    const index = users.findIndex(u => u.email === email);
    if (index >= 0) {
      users[index] = { ...users[index], ...updates };
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      return users[index];
    }
    return null;
  } catch (e) {
    console.error('Error updating user:', e);
    return null;
  }
};

// Delete user
export const deleteUser = (email) => {
  try {
    const users = getAllUsers().filter(u => u.email !== email);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    return true;
  } catch (e) {
    console.error('Error deleting user:', e);
    return false;
  }
};

// Get user stats
export const getUserStats = () => {
  const users = getAllUsers();
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  // Count active users (logged in within 7 days or status is active)
  const activeUsers = users.filter(u => {
    // Check status field (local format)
    if (u.status === 'active') return true;
    // Check is_blocked field (backend format)
    if (u.is_blocked) return false;
    // Check last login (backend format)
    if (u.last_login) {
      const lastLogin = new Date(u.last_login);
      return lastLogin >= sevenDaysAgo;
    }
    // Check lastActive (local format)
    if (u.lastActive) {
      const lastActive = new Date(u.lastActive);
      return lastActive >= sevenDaysAgo;
    }
    return true; // Default to active if no status info
  });

  // Count pro users (handle both local and backend formats)
  const proUsers = users.filter(u => 
    u.plan === 'pro' || 
    u.is_paid === true || 
    (u.subscription_end && new Date(u.subscription_end) > now)
  );

  return {
    totalUsers: users.length,
    activeUsers: activeUsers.length,
    freeUsers: users.length - proUsers.length,
    proMonthly: users.filter(u => u.plan === 'pro' && u.billingCycle === 'monthly').length || Math.floor(proUsers.length * 0.6),
    proYearly: users.filter(u => u.plan === 'pro' && u.billingCycle === 'yearly').length || Math.floor(proUsers.length * 0.4),
    newUsersToday: users.filter(u => {
      const createdAt = u.joinedAt || u.created_at;
      return createdAt && createdAt.startsWith(today);
    }).length,
    newUsersWeek: users.filter(u => {
      const createdAt = u.joinedAt || u.created_at;
      return createdAt && createdAt >= weekAgo;
    }).length,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// Get all transactions
export const getAllTransactions = () => {
  try {
    const transactions = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return transactions ? JSON.parse(transactions) : [];
  } catch (e) {
    console.error('Error getting transactions:', e);
    return [];
  }
};

// Add transaction
export const addTransaction = (transaction) => {
  try {
    const transactions = getAllTransactions();
    const newTransaction = {
      id: Date.now(),
      ...transaction,
      date: new Date().toISOString().split('T')[0],
      paymentId: transaction.paymentId || `pay_${Date.now().toString(36).toUpperCase()}`,
    };
    transactions.unshift(newTransaction);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    return newTransaction;
  } catch (e) {
    console.error('Error adding transaction:', e);
    return null;
  }
};

// Get revenue stats
export const getRevenueStats = () => {
  const transactions = getAllTransactions();
  const successfulTx = transactions.filter(t => t.status === 'success');
  
  const totalRevenue = successfulTx.reduce((sum, t) => sum + (t.amount || 0), 0);
  const monthlyRevenue = successfulTx
    .filter(t => t.plan?.includes('Monthly'))
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const yearlyRevenue = successfulTx
    .filter(t => t.plan?.includes('Yearly'))
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  return {
    totalRevenue,
    mrrMonthly: monthlyRevenue,
    arrYearly: yearlyRevenue,
    totalTransactions: transactions.length,
    successfulTransactions: successfulTx.length,
    failedTransactions: transactions.filter(t => t.status === 'failed').length,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNAL MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// Get all signals
export const getAllSignals = () => {
  try {
    const signals = localStorage.getItem(STORAGE_KEYS.SIGNALS);
    return signals ? JSON.parse(signals) : [];
  } catch (e) {
    console.error('Error getting signals:', e);
    return [];
  }
};

// Add signal
export const addSignal = (signal) => {
  try {
    const signals = getAllSignals();
    const newSignal = {
      id: Date.now(),
      ...signal,
      status: 'active',
      pnl: '₹0',
      subscribers: 0,
      generated: 'Just now',
      createdAt: new Date().toISOString(),
    };
    signals.unshift(newSignal);
    localStorage.setItem(STORAGE_KEYS.SIGNALS, JSON.stringify(signals));
    return newSignal;
  } catch (e) {
    console.error('Error adding signal:', e);
    return null;
  }
};

// Update signal
export const updateSignal = (id, updates) => {
  try {
    const signals = getAllSignals();
    const index = signals.findIndex(s => s.id === id);
    if (index >= 0) {
      signals[index] = { ...signals[index], ...updates };
      localStorage.setItem(STORAGE_KEYS.SIGNALS, JSON.stringify(signals));
      return signals[index];
    }
    return null;
  } catch (e) {
    console.error('Error updating signal:', e);
    return null;
  }
};

// Delete signal
export const deleteSignal = (id) => {
  try {
    const signals = getAllSignals().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SIGNALS, JSON.stringify(signals));
    return true;
  } catch (e) {
    console.error('Error deleting signal:', e);
    return false;
  }
};

// Get signal stats
export const getSignalStats = () => {
  const signals = getAllSignals();
  return {
    totalSignals: signals.length,
    activeSignals: signals.filter(s => s.status === 'active').length,
    closedSignals: signals.filter(s => s.status === 'closed').length,
    avgConfidence: signals.length > 0 
      ? Math.round(signals.reduce((sum, s) => sum + (s.confidence || 0), 0) / signals.length)
      : 0,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// Get all announcements
export const getAllAnnouncements = () => {
  try {
    const announcements = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
    return announcements ? JSON.parse(announcements) : [];
  } catch (e) {
    console.error('Error getting announcements:', e);
    return [];
  }
};

// Add announcement
export const addAnnouncement = (announcement) => {
  try {
    const announcements = getAllAnnouncements();
    const newAnnouncement = {
      id: Date.now(),
      ...announcement,
      createdAt: new Date().toISOString(),
    };
    announcements.unshift(newAnnouncement);
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(announcements));
    return newAnnouncement;
  } catch (e) {
    console.error('Error adding announcement:', e);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const defaultPaymentConfig = {
  upiId: 'yourupi@paytm',
  merchantName: 'Money Saarthi',
  phonepeNumber: '9999999999',
  gpayNumber: '9999999999',
  paytmNumber: '9999999999',
  whatsappNumber: '919999999999',
  bankDetails: {
    accountName: 'Money Saarthi',
    accountNumber: 'XXXXXXXXXXXX',
    ifscCode: 'SBIN0XXXXXX',
    bankName: 'State Bank of India',
  },
  razorpayKey: 'rzp_test_YourTestKeyHere',
  razorpayEnabled: false,
};

// Get payment config
export const getPaymentConfig = () => {
  try {
    const config = localStorage.getItem(STORAGE_KEYS.PAYMENT_CONFIG);
    return config ? { ...defaultPaymentConfig, ...JSON.parse(config) } : defaultPaymentConfig;
  } catch (e) {
    console.error('Error getting payment config:', e);
    return defaultPaymentConfig;
  }
};

// Update payment config
export const updatePaymentConfig = (updates) => {
  try {
    const config = { ...getPaymentConfig(), ...updates };
    localStorage.setItem(STORAGE_KEYS.PAYMENT_CONFIG, JSON.stringify(config));
    return config;
  } catch (e) {
    console.error('Error updating payment config:', e);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const defaultConfig = {
  apiRateLimit: 60,
  cacheTTL: 300,
  maxConcurrentUsers: 1000,
  maintenanceMode: false,
  razorpayTestMode: true,
};

// Get system config
export const getSystemConfig = () => {
  try {
    const config = localStorage.getItem(STORAGE_KEYS.SYSTEM_CONFIG);
    return config ? JSON.parse(config) : defaultConfig;
  } catch (e) {
    console.error('Error getting system config:', e);
    return defaultConfig;
  }
};

// Update system config
export const updateSystemConfig = (updates) => {
  try {
    const config = { ...getSystemConfig(), ...updates };
    localStorage.setItem(STORAGE_KEYS.SYSTEM_CONFIG, JSON.stringify(config));
    return config;
  } catch (e) {
    console.error('Error updating system config:', e);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// Clear all cache
export const clearAllCache = () => {
  try {
    // Don't clear user data, just cache
    localStorage.removeItem('moneysaarthi_cache');
    return true;
  } catch (e) {
    console.error('Error clearing cache:', e);
    return false;
  }
};

// Export all data
export const exportAllData = () => {
  return {
    users: getAllUsers(),
    transactions: getAllTransactions(),
    signals: getAllSignals(),
    announcements: getAllAnnouncements(),
    config: getSystemConfig(),
    exportedAt: new Date().toISOString(),
  };
};

// Format time ago
export const formatTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return date.toLocaleDateString();
};

export default {
  getAllUsers,
  fetchUsersFromBackend,
  saveUserToList,
  updateUser,
  deleteUser,
  getUserStats,
  getAllTransactions,
  addTransaction,
  getRevenueStats,
  getAllSignals,
  addSignal,
  updateSignal,
  deleteSignal,
  getSignalStats,
  getAllAnnouncements,
  addAnnouncement,
  getPaymentConfig,
  updatePaymentConfig,
  getSystemConfig,
  updateSystemConfig,
  clearAllCache,
  exportAllData,
  formatTimeAgo,
};
