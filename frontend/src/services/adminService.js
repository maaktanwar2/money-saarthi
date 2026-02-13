// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN SERVICE - Real Backend API Integration
// ═══════════════════════════════════════════════════════════════════════════════

import { API, getAuthHeaders } from '../config/api';

const STORAGE_KEYS = {
  USERS: 'moneysaarthi_all_users',
  SIGNALS: 'moneysaarthi_signals',
  ANNOUNCEMENTS: 'moneysaarthi_announcements',
};

// Helper for admin API calls
const adminFetch = async (path, options = {}) => {
  const res = await fetch(`${API}${path}`, {
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(err || `Admin API error: ${res.status}`);
  }
  return res.json();
};

// ═══════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT — Backend-first
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchUsersFromBackend = async () => {
  try {
    const backendUsers = await adminFetch('/admin/users');
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(backendUsers));
    return backendUsers;
  } catch (e) {
    console.error('Error fetching users from backend:', e);
    return getAllUsers();
  }
};

export const getAllUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
  } catch { return []; }
};

export const saveUserToList = (user) => {
  try {
    const users = getAllUsers();
    const idx = users.findIndex(u => u.email?.toLowerCase() === user.email?.toLowerCase());
    const userData = {
      id: user.id || user.user_id || Date.now(),
      name: user.name,
      email: user.email,
      picture: user.picture,
      plan: user.subscription?.plan || 'free',
      status: 'active',
      joinedAt: user.joinedAt || user.created_at || new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };
    if (idx >= 0) users[idx] = { ...users[idx], ...userData };
    else users.push(userData);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    return userData;
  } catch { return null; }
};

export const updateUser = async (emailOrId, updates) => {
  try {
    // Try backend first
    const users = getAllUsers();
    const user = users.find(u => u.email === emailOrId || u.user_id === emailOrId);
    const userId = user?.user_id || user?.id || emailOrId;
    
    // For block/unblock, use dedicated endpoints
    if (updates.is_blocked === true) {
      return await adminFetch(`/admin/users/${userId}/block`, { method: 'POST' });
    }
    if (updates.is_blocked === false) {
      return await adminFetch(`/admin/users/${userId}/unblock`, { method: 'POST' });
    }
    // For grant/revoke access
    if (updates.has_free_access === true || updates.is_paid === true) {
      return await adminFetch(`/admin/users/${userId}/grant-access`, { method: 'POST' });
    }
    if (updates.has_free_access === false && updates.is_paid === false) {
      return await adminFetch(`/admin/users/${userId}/revoke-access`, { method: 'POST' });
    }
    
    // General update
    return await adminFetch(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  } catch (e) {
    console.error('Error updating user via backend:', e);
    // Fallback to local
    const users = getAllUsers();
    const idx = users.findIndex(u => u.email === emailOrId);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...updates };
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      return users[idx];
    }
    return null;
  }
};

export const deleteUser = async (emailOrId) => {
  try {
    const users = getAllUsers();
    const user = users.find(u => u.email === emailOrId || u.user_id === emailOrId);
    const userId = user?.user_id || user?.id || emailOrId;
    await adminFetch(`/admin/users/${userId}`, { method: 'DELETE' });
    // Also remove from local cache
    const filtered = users.filter(u => u.email !== emailOrId && u.user_id !== emailOrId);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filtered));
    return true;
  } catch (e) {
    console.error('Error deleting user via backend:', e);
    return false;
  }
};

// Stats from backend
export const getUserStats = async () => {
  try {
    const stats = await adminFetch('/admin/stats');
    return {
      totalUsers: stats.total_users || 0,
      activeUsers: (stats.total_users || 0) - (stats.blocked_users || 0),
      freeUsers: (stats.total_users || 0) - (stats.paid_users || 0) - (stats.free_access_users || 0),
      proUsers: stats.paid_users || 0,
      freeAccessUsers: stats.free_access_users || 0,
      blockedUsers: stats.blocked_users || 0,
    };
  } catch (e) {
    console.error('Error fetching admin stats:', e);
    // Derive from cached users as fallback
    const users = getAllUsers();
    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => !u.is_blocked).length,
      freeUsers: users.filter(u => !u.is_paid && !u.has_free_access).length,
      proUsers: users.filter(u => u.is_paid).length,
      freeAccessUsers: users.filter(u => u.has_free_access).length,
      blockedUsers: users.filter(u => u.is_blocked).length,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT / TRANSACTIONS — Backend-first via /admin/payments
// ═══════════════════════════════════════════════════════════════════════════════

export const getAllTransactions = async () => {
  try {
    const data = await adminFetch('/admin/payments/pending');
    return data.payments || [];
  } catch (e) {
    console.error('Error fetching payments from backend:', e);
    return [];
  }
};

export const approvePayment = async (paymentId) => {
  return adminFetch(`/admin/payments/approve/${paymentId}`, { method: 'POST' });
};

export const rejectPayment = async (paymentId) => {
  return adminFetch(`/admin/payments/reject/${paymentId}`, { method: 'POST' });
};

export const getRevenueStats = async () => {
  // Revenue stats derived from admin stats endpoint
  try {
    const stats = await adminFetch('/admin/stats');
    return {
      paidUsers: stats.paid_users || 0,
      freeAccessUsers: stats.free_access_users || 0,
    };
  } catch (e) {
    return { paidUsers: 0, freeAccessUsers: 0 };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNALS — localStorage (no backend endpoints yet)
// ═══════════════════════════════════════════════════════════════════════════════

export const getAllSignals = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SIGNALS) || '[]');
  } catch { return []; }
};

export const addSignal = (signal) => {
  const signals = getAllSignals();
  const ns = { id: Date.now(), ...signal, status: 'active', createdAt: new Date().toISOString() };
  signals.unshift(ns);
  localStorage.setItem(STORAGE_KEYS.SIGNALS, JSON.stringify(signals));
  return ns;
};

export const updateSignal = (id, updates) => {
  const signals = getAllSignals();
  const idx = signals.findIndex(s => s.id === id);
  if (idx >= 0) {
    signals[idx] = { ...signals[idx], ...updates };
    localStorage.setItem(STORAGE_KEYS.SIGNALS, JSON.stringify(signals));
    return signals[idx];
  }
  return null;
};

export const deleteSignal = (id) => {
  const signals = getAllSignals().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEYS.SIGNALS, JSON.stringify(signals));
  return true;
};

export const getSignalStats = () => {
  const signals = getAllSignals();
  return {
    totalSignals: signals.length,
    activeSignals: signals.filter(s => s.status === 'active').length,
    closedSignals: signals.filter(s => s.status === 'closed').length,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS — localStorage (no backend endpoints yet)
// ═══════════════════════════════════════════════════════════════════════════════

export const getAllAnnouncements = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS) || '[]');
  } catch { return []; }
};

export const addAnnouncement = (announcement) => {
  const list = getAllAnnouncements();
  const na = { id: Date.now(), ...announcement, createdAt: new Date().toISOString() };
  list.unshift(na);
  localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(list));
  return na;
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT CONFIG — Backend-first via /admin/settings/payment
// ═══════════════════════════════════════════════════════════════════════════════

export const getPaymentConfig = async () => {
  try {
    return await adminFetch('/admin/settings/payment');
  } catch (e) {
    console.error('Error fetching payment config from backend:', e);
    return { upi_number: '', payee_name: '', upi_id: '' };
  }
};

export const updatePaymentConfig = async (updates) => {
  try {
    return await adminFetch('/admin/settings/payment', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  } catch (e) {
    console.error('Error updating payment config:', e);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM CONFIG — Backend-first via /admin/settings
// ═══════════════════════════════════════════════════════════════════════════════

export const getSystemConfig = async () => {
  try {
    return await adminFetch('/admin/settings');
  } catch (e) {
    console.error('Error fetching system config:', e);
    return {};
  }
};

export const updateSystemConfig = async (updates) => {
  try {
    return await adminFetch('/admin/settings/provider', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  } catch (e) {
    console.error('Error updating system config:', e);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════════════════

export const clearAllCache = () => {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  return true;
};

export const exportAllData = () => ({
  users: getAllUsers(),
  signals: getAllSignals(),
  announcements: getAllAnnouncements(),
  exportedAt: new Date().toISOString(),
});

export const formatTimeAgo = (dateString) => {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateString).toLocaleDateString();
};

export default {
  getAllUsers,
  fetchUsersFromBackend,
  saveUserToList,
  updateUser,
  deleteUser,
  getUserStats,
  getAllTransactions,
  approvePayment,
  rejectPayment,
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
