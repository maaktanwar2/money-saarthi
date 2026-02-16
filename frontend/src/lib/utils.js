import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED CONSTANTS & UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/** Admin emails — single source of truth (client hint only, validated server-side) */
export const ADMIN_EMAILS = [
  'maaktanwar@gmail.com',
  'admin@moneysaarthi.com',
  'superadmin@moneysaarthi.com',
];

/** Check if email is admin (client-side hint only) */
export const isAdmin = (email) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

/** Check if current time is during Indian market hours (9:15–15:30 IST, weekdays) */
export const isMarketHours = () => {
  const now = new Date();
  const istOffset = 5.5 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + istOffset * 60000);
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const t = ist.getHours() * 60 + ist.getMinutes();
  return t >= 555 && t <= 930; // 9:15=555, 15:30=930
};

/**
 * Format Indian currency (INR)
 */
export function formatINR(value, options = {}) {
  const { 
    showSign = false, 
    compact = false,
    decimals = 2 
  } = options;
  
  if (value === null || value === undefined || isNaN(value)) return '₹0';
  
  const absValue = Math.abs(value);
  const sign = value >= 0 ? (showSign ? '+' : '') : '-';
  
  if (compact) {
    if (absValue >= 10000000) {
      return `${sign}₹${(absValue / 10000000).toFixed(2)}Cr`;
    }
    if (absValue >= 100000) {
      return `${sign}₹${(absValue / 100000).toFixed(2)}L`;
    }
    if (absValue >= 1000) {
      return `${sign}₹${(absValue / 1000).toFixed(1)}K`;
    }
  }
  
  return `${sign}₹${absValue.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Format number with Indian notation
 */
export function formatNumber(value, options = {}) {
  const { 
    showSign = false, 
    compact = false,
    decimals = 2 
  } = options;
  
  if (value === null || value === undefined || isNaN(value)) return '0';
  
  const absValue = Math.abs(value);
  const sign = value >= 0 ? (showSign ? '+' : '') : '-';
  
  if (compact) {
    if (absValue >= 10000000) {
      return `${sign}${(absValue / 10000000).toFixed(2)}Cr`;
    }
    if (absValue >= 100000) {
      return `${sign}${(absValue / 100000).toFixed(2)}L`;
    }
    if (absValue >= 1000) {
      return `${sign}${(absValue / 1000).toFixed(1)}K`;
    }
  }
  
  return `${sign}${absValue.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Format percentage
 */
export function formatPercent(value, options = {}) {
  const { showSign = true, decimals = 2 } = options;
  
  if (value === null || value === undefined || isNaN(value)) return '0%';
  
  const sign = value >= 0 ? (showSign ? '+' : '') : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format volume in Indian notation
 */
export function formatVolume(value) {
  if (!value || isNaN(value)) return '0';
  
  if (value >= 10000000) {
    return `${(value / 10000000).toFixed(2)} Cr`;
  }
  if (value >= 100000) {
    return `${(value / 100000).toFixed(2)} L`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} K`;
  }
  
  return value.toLocaleString('en-IN');
}

/**
 * Get color class based on value
 */
export function getChangeColor(value) {
  if (value > 0) return 'text-bullish';
  if (value < 0) return 'text-bearish';
  return 'text-muted-foreground';
}

/**
 * Get background color class based on value
 */
export function getChangeBg(value) {
  if (value > 0) return 'bg-bullish/10';
  if (value < 0) return 'bg-bearish/10';
  return 'bg-secondary';
}

/**
 * Calculate percentage change
 */
export function calcChange(current, previous) {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Format date/time
 */
export function formatDateTime(date, options = {}) {
  const { 
    format = 'full', // 'full', 'date', 'time', 'relative'
    locale = 'en-IN' 
  } = options;
  
  const d = new Date(date);
  
  if (format === 'relative') {
    const now = new Date();
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
  }
  
  const dateOpts = { day: '2-digit', month: 'short', year: 'numeric' };
  const timeOpts = { hour: '2-digit', minute: '2-digit' };
  
  if (format === 'date') return d.toLocaleDateString(locale, dateOpts);
  if (format === 'time') return d.toLocaleTimeString(locale, timeOpts);
  
  return d.toLocaleString(locale, { ...dateOpts, ...timeOpts });
}

/**
 * Check if market is open (NSE timings) - uses IST conversion
 */
export function isMarketOpen() {
  const now = new Date();
  const istOffset = 5.5 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + istOffset * 60000);
  const day = ist.getDay();
  
  // Weekend check
  if (day === 0 || day === 6) return false;
  
  const totalMinutes = ist.getHours() * 60 + ist.getMinutes();
  
  // Market: 9:15 AM - 3:30 PM IST
  return totalMinutes >= 555 && totalMinutes <= 930;
}

/**
 * Get market session info - uses IST conversion
 */
export function getMarketSession() {
  const now = new Date();
  const istOffset = 5.5 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + istOffset * 60000);
  const day = ist.getDay();
  const totalMinutes = ist.getHours() * 60 + ist.getMinutes();
  
  if (day === 0 || day === 6) {
    return { status: 'closed', label: 'Weekend', color: 'text-muted-foreground' };
  }
  
  const preOpen = 9 * 60;         // 9:00 AM
  const marketOpen = 9 * 60 + 15; // 9:15 AM
  const marketClose = 15 * 60 + 30; // 3:30 PM
  
  if (totalMinutes < preOpen) {
    return { status: 'pre-market', label: 'Pre-Market', color: 'text-amber-500' };
  }
  if (totalMinutes >= preOpen && totalMinutes < marketOpen) {
    return { status: 'pre-open', label: 'Pre-Open Session', color: 'text-amber-500' };
  }
  if (totalMinutes >= marketOpen && totalMinutes <= marketClose) {
    return { status: 'open', label: 'Market Open', color: 'text-bullish' };
  }
  
  return { status: 'closed', label: 'Market Closed', color: 'text-bearish' };
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Generate unique ID
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Deep clone object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Sort array by key
 */
export function sortBy(array, key, order = 'asc') {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (order === 'asc') return aVal > bVal ? 1 : -1;
    return aVal < bVal ? 1 : -1;
  });
}

/**
 * Group array by key
 */
export function groupBy(array, key) {
  return array.reduce((groups, item) => {
    const group = item[key];
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {});
}

/**
 * Storage utilities
 */
export const storage = {
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * API helper with error handling
 * Uses centralized API config from config/api.js
 */
export async function fetchAPI(endpoint, options = {}) {
  // Import dynamically to avoid circular deps, but use the same central config
  const { API, getAuthHeaders } = await import('../config/api');
  
  try {
    const response = await fetch(`${API}${endpoint}`, {
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

