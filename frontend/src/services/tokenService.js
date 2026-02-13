/**
 * Token Service
 * Manages AI token balance, usage, and recharge
 */

import { fetchAPI } from '../lib/utils';

const getUserId = () => {
  const user = JSON.parse(localStorage.getItem('ms_user') || '{}');
  // Use email as primary identifier for admin check
  return user.email || user.id || 'anonymous';
};

/**
 * Get current token balance
 */
export const getTokenBalance = async () => {
  const response = await fetchAPI('/ai/tokens/balance', {
    method: 'GET',
    headers: {
      'X-User-Id': getUserId()
    }
  });
  return response;
};

/**
 * Get available token packages
 */
export const getTokenPackages = async () => {
  const response = await fetchAPI('/ai/tokens/packages');
  return response;
};

/**
 * Recharge tokens after payment
 */
export const rechargeTokens = async (packageId, transactionId = null) => {
  const response = await fetchAPI('/ai/tokens/recharge', {
    method: 'POST',
    headers: {
      'X-User-Id': getUserId()
    },
    body: JSON.stringify({
      package_id: packageId,
      transaction_id: transactionId
    })
  });
  return response;
};

/**
 * Get token usage history
 */
export const getTokenHistory = async (limit = 50) => {
  const response = await fetchAPI(`/ai/tokens/history?limit=${limit}`, {
    method: 'GET',
    headers: {
      'X-User-Id': getUserId()
    }
  });
  return response;
};

/**
 * Check if user can perform an action
 */
export const checkCanUseTokens = async (action) => {
  const response = await fetchAPI(`/ai/tokens/check/${action}`, {
    method: 'GET',
    headers: {
      'X-User-Id': getUserId()
    }
  });
  return response;
};

/**
 * Analyze trades with AI
 */
export const analyzeTradesWithAI = async (accessToken, broker = 'dhan') => {
  const response = await fetchAPI('/ai/analyze/trades', {
    method: 'POST',
    headers: {
      'X-User-Id': getUserId()
    },
    body: JSON.stringify({
      broker,
      access_token: accessToken
    })
  });
  return response;
};

/**
 * Get AI suggestion for a position
 */
export const getPositionSuggestion = async (position) => {
  const response = await fetchAPI('/ai/analyze/position', {
    method: 'POST',
    headers: {
      'X-User-Id': getUserId()
    },
    body: JSON.stringify({
      position
    })
  });
  return response;
};

/**
 * Fetch trades from broker without AI analysis
 */
export const fetchBrokerTrades = async (accessToken, broker = 'dhan', fromDate = null, toDate = null) => {
  const response = await fetchAPI('/ai/fetch/trades', {
    method: 'POST',
    body: JSON.stringify({
      broker,
      access_token: accessToken,
      from_date: fromDate,
      to_date: toDate
    })
  });
  return response;
};

/**
 * Get AI service status
 */
export const getAIStatus = async () => {
  const response = await fetchAPI('/ai/status');
  return response;
};

/**
 * Get account summary (funds, positions, holdings)
 * Supports both Dhan and Upstox brokers
 */
export const getAccountSummary = async (accessToken, broker = 'dhan') => {
  const endpoint = broker === 'upstox' 
    ? '/v2/upstox/account/summary' 
    : '/v2/dhan/account/summary';
  
  const response = await fetchAPI(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      access_token: accessToken
    })
  });
  return response;
};

/**
 * Get fund limits only
 * Supports both Dhan and Upstox brokers
 */
export const getFundLimits = async (accessToken, broker = 'dhan') => {
  const endpoint = broker === 'upstox' 
    ? '/v2/upstox/account/funds' 
    : '/v2/dhan/account/funds';
  
  const response = await fetchAPI(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      access_token: accessToken
    })
  });
  return response;
};

/**
 * Get Upstox OAuth URL
 */
export const getUpstoxAuthUrl = async () => {
  const response = await fetchAPI('/v2/upstox/auth/url');
  return response;
};

/**
 * Exchange Upstox auth code for token
 */
export const exchangeUpstoxToken = async (authCode) => {
  const response = await fetchAPI('/v2/upstox/auth/token', {
    method: 'POST',
    body: JSON.stringify({
      auth_code: authCode
    })
  });
  return response;
};

/**
 * Get/Save broker credentials (stored locally)
 */
export const getBrokerCredentials = () => {
  const saved = localStorage.getItem('ms_broker_credentials');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  return null;
};

export const saveBrokerCredentials = (credentials) => {
  // Only save broker type and client ID, not the access token
  const toSave = {
    broker: credentials.broker,
    clientId: credentials.clientId,
    // Access token should be entered fresh each session for security
    lastConnected: new Date().toISOString()
  };
  localStorage.setItem('ms_broker_credentials', JSON.stringify(toSave));
};

export const clearBrokerCredentials = () => {
  localStorage.removeItem('ms_broker_credentials');
};
