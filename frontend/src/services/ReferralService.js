/**
 * Referral Service - Handles referral tracking and management
 * Stores data in localStorage and syncs with backend
 */

const REFERRAL_KEY = 'money_saarthi_referral';
const MY_REFERRAL_CODE_KEY = 'my_referral_code';
const REFERRAL_STATS_KEY = 'referral_stats';

// Generate unique referral code from user ID
export const generateReferralCode = (userId) => {
  if (!userId) return null;
  // Create a short code from user ID
  const base = userId.slice(-8).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `MS${base}${random}`.slice(0, 10);
};

// Get referral code from URL
export const getReferralFromURL = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('ref') || params.get('referral');
};

// Store referral code when user lands on site
export const captureReferral = () => {
  const refCode = getReferralFromURL();
  if (refCode) {
    const existingRef = localStorage.getItem(REFERRAL_KEY);
    if (!existingRef) {
      localStorage.setItem(REFERRAL_KEY, JSON.stringify({
        code: refCode,
        capturedAt: new Date().toISOString(),
        converted: false
      }));
      // Track referral click
      trackReferralClick(refCode);
    }
  }
};

// Track referral click (call backend)
export const trackReferralClick = async (refCode) => {
  try {
    const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://moneysaarthi-backend-517321998192.asia-south1.run.app';
    await fetch(`${API_URL}/api/referral/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referral_code: refCode })
    });
  } catch (e) {
    // Silently fail - non-critical
  }
};

// Mark referral as converted (when user signs up)
export const convertReferral = async (newUserId, newUserEmail) => {
  const stored = localStorage.getItem(REFERRAL_KEY);
  if (stored) {
    const referral = JSON.parse(stored);
    if (!referral.converted) {
      referral.converted = true;
      referral.convertedAt = new Date().toISOString();
      localStorage.setItem(REFERRAL_KEY, JSON.stringify(referral));
      
      // Notify backend about conversion
      try {
        const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://moneysaarthi-backend-517321998192.asia-south1.run.app';
        await fetch(`${API_URL}/api/referral/convert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referral_code: referral.code,
            new_user_id: newUserId,
            new_user_email: newUserEmail
          })
        });
      } catch (e) {
        // Silently fail - non-critical
      }
    }
  }
};

// Get current user's referral code
export const getMyReferralCode = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.referral_code) return user.referral_code;
  
  // Generate and store if not exists
  let code = localStorage.getItem(MY_REFERRAL_CODE_KEY);
  if (!code && user.id) {
    code = generateReferralCode(user.id);
    localStorage.setItem(MY_REFERRAL_CODE_KEY, code);
  }
  return code;
};

// Get referral link
export const getReferralLink = () => {
  const code = getMyReferralCode();
  if (!code) return null;
  return `https://moneysaarthi.in?ref=${code}`;
};

// Get referral stats from backend
export const getReferralStats = async () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) return { clicks: 0, signups: 0, active: 0 };
    
    const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://moneysaarthi-backend-517321998192.asia-south1.run.app';
    const response = await fetch(`${API_URL}/api/referral/stats?user_id=${user.id}`);
    if (response.ok) {
      const data = await response.json();
      localStorage.setItem(REFERRAL_STATS_KEY, JSON.stringify(data));
      return data;
    }
  } catch (e) {
    // Silently fail - return cached/default
  }
  
  // Return cached or default
  const cached = localStorage.getItem(REFERRAL_STATS_KEY);
  return cached ? JSON.parse(cached) : { clicks: 0, signups: 0, active: 0 };
};

// Initialize referral tracking
export const initReferralTracking = () => {
  captureReferral();
};

export default {
  generateReferralCode,
  getReferralFromURL,
  captureReferral,
  convertReferral,
  getMyReferralCode,
  getReferralLink,
  getReferralStats,
  initReferralTracking
};
