/**
 * Centralized API Configuration
 * Single source of truth for backend URL
 * 
 * DO NOT hardcode URLs in other files - import from here
 * Version: 2.0 - Feb 2026
 */

// Production Google Cloud Run backend
const CLOUD_RUN_URL = 'https://moneysaarthi-backend-517321998192.asia-south1.run.app';

// Local development backend
const LOCAL_URL = 'http://localhost:8000';

// Determine if we're in production
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

// Use Cloud Run for production, local for dev
export const API_BASE_URL = isProduction ? CLOUD_RUN_URL : LOCAL_URL;

// Log for debugging (remove in production if needed)
console.log(`🌐 API Config: hostname=${window.location.hostname}, isProduction=${isProduction}, API_BASE_URL=${API_BASE_URL}`);

export const API = `${API_BASE_URL}/api`;

// Helper for making API calls with auth
export const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  console.log('🔐 Auth token:', token ? `${token.substring(0, 20)}...` : 'none');
  return {
    'Content-Type': 'application/json',
    ...(token && { 
      Authorization: `Bearer ${token}`,
      'X-Session-ID': token // Fallback for backend
    })
  };
};

// Fetch with auth helper
export const fetchWithAuth = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers
    }
  });
  return response;
};

export default {
  API_BASE_URL,
  API,
  getAuthHeaders,
  fetchWithAuth
};
