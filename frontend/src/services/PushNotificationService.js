/**
 * Push Notification Service
 * Handles browser push notifications for market alerts
 */

const PUSH_PERMISSION_KEY = 'push_permission_asked';
const PUSH_SUBSCRIPTION_KEY = 'push_subscription';

// Check if push notifications are supported
export const isPushSupported = () => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

// Get current permission status
export const getPermissionStatus = () => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
};

// Request notification permission
export const requestPermission = async () => {
  if (!isPushSupported()) {
    return { success: false, reason: 'unsupported' };
  }

  if (Notification.permission === 'granted') {
    return { success: true, permission: 'granted' };
  }

  if (Notification.permission === 'denied') {
    return { success: false, reason: 'denied' };
  }

  try {
    const permission = await Notification.requestPermission();
    localStorage.setItem(PUSH_PERMISSION_KEY, 'true');
    
    if (permission === 'granted') {
      // Subscribe to push notifications
      await subscribeToPush();
      return { success: true, permission: 'granted' };
    }
    
    return { success: false, reason: permission };
  } catch (error) {
    console.error('Push permission error:', error);
    return { success: false, reason: 'error' };
  }
};

// Subscribe to push notifications
export const subscribeToPush = async () => {
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // This would typically use a VAPID key from your backend
    // For now, we'll use local notifications
    console.log('Push subscription ready');
    localStorage.setItem(PUSH_SUBSCRIPTION_KEY, 'true');
    
    return true;
  } catch (error) {
    console.error('Push subscription error:', error);
    return false;
  }
};

// Show a local notification (for when app is open)
export const showNotification = (title, options = {}) => {
  if (Notification.permission !== 'granted') return;

  const defaultOptions = {
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [100, 50, 100],
    requireInteraction: false,
    ...options
  };

  try {
    new Notification(title, defaultOptions);
  } catch (error) {
    // Fallback for mobile
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, defaultOptions);
      });
    }
  }
};

// Check if we should ask for permission
export const shouldAskPermission = () => {
  if (!isPushSupported()) return false;
  if (Notification.permission !== 'default') return false;
  
  const asked = localStorage.getItem(PUSH_PERMISSION_KEY);
  return !asked;
};

// Market alert notifications
export const sendMarketAlert = (type, data) => {
  const alerts = {
    nifty_breakout: {
      title: '🚨 NIFTY Alert!',
      body: `NIFTY broke ${data.level}! ${data.direction === 'up' ? '📈' : '📉'}`
    },
    breakout_stocks: {
      title: '📊 Breakout Alert',
      body: `${data.count} breakout stocks detected! Check the scanner.`
    },
    market_open: {
      title: '🔔 Market Opening Soon',
      body: 'Indian markets open in 15 minutes. Get ready!'
    },
    market_close: {
      title: '🏁 Market Closed',
      body: 'Markets closed. Check today\'s summary.'
    },
    high_volume: {
      title: '🔥 High Volume Alert',
      body: `${data.stock} showing unusual volume activity!`
    }
  };

  const alert = alerts[type];
  if (alert) {
    showNotification(alert.title, {
      body: alert.body,
      tag: type,
      data: { type, ...data }
    });
  }
};

export default {
  isPushSupported,
  getPermissionStatus,
  requestPermission,
  showNotification,
  shouldAskPermission,
  sendMarketAlert
};
