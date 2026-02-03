/**
 * Centralized API Configuration
 * Single source of truth for backend URL
 * 
 * DO NOT hardcode URLs in other files - import from here
 */

// Production Google Cloud Run backend
const CLOUD_RUN_URL = 'https://moneysaarthi-backend-517321998192.asia-south1.run.app';

// Use environment variable if set (for local dev), otherwise use Cloud Run
export const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 
                            process.env.REACT_APP_API_URL || 
                            CLOUD_RUN_URL;

export const API = `${API_BASE_URL}/api`;

// Helper for making API calls with auth
export const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
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
