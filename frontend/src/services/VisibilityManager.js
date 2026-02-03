/**
 * Visibility Manager - Smart Auto-Refresh Controller
 * 
 * Features:
 * - Detects tab visibility changes
 * - Pauses data fetching when tab is hidden
 * - Resumes fetching when tab becomes visible
 * - Tracks user activity for idle detection
 * - Provides hooks for components to subscribe
 */

import { useEffect, useCallback, useRef } from 'react';
import useDataStore from '../store/useDataStore';

class VisibilityManager {
  constructor() {
    this.isVisible = !document.hidden;
    this.listeners = new Set();
    this.idleTimeout = null;
    this.IDLE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    this.isIdle = false;
    
    this.init();
  }

  init() {
    // Visibility change listener
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // User activity listeners
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach((event) => {
      document.addEventListener(event, this.handleUserActivity, { passive: true });
    });
    
    // Start idle timer
    this.resetIdleTimer();
  }

  handleVisibilityChange = () => {
    this.isVisible = !document.hidden;
    this.notifyListeners({ type: 'visibility', isVisible: this.isVisible });
    
    // If becoming visible and was idle, trigger refresh
    if (this.isVisible && this.isIdle) {
      this.isIdle = false;
      this.notifyListeners({ type: 'resume', reason: 'visibility' });
    }
  };

  handleUserActivity = () => {
    if (this.isIdle) {
      this.isIdle = false;
      this.notifyListeners({ type: 'resume', reason: 'activity' });
    }
    this.resetIdleTimer();
  };

  resetIdleTimer = () => {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }
    
    this.idleTimeout = setTimeout(() => {
      this.isIdle = true;
      this.notifyListeners({ type: 'idle' });
    }, this.IDLE_THRESHOLD);
  };

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(event) {
    this.listeners.forEach((listener) => listener(event));
  }

  shouldFetch() {
    return this.isVisible && !this.isIdle;
  }

  destroy() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach((event) => {
      document.removeEventListener(event, this.handleUserActivity);
    });
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }
  }
}

// Singleton instance
export const visibilityManager = new VisibilityManager();

/**
 * Hook: Subscribe to visibility changes
 */
export function useVisibility() {
  const setTabVisible = useDataStore((state) => state.setTabVisible);
  const setPaused = useDataStore((state) => state.setPaused);
  const isTabVisible = useDataStore((state) => state.ui.isTabVisible);
  const isPaused = useDataStore((state) => state.ui.isPaused);

  useEffect(() => {
    const unsubscribe = visibilityManager.subscribe((event) => {
      switch (event.type) {
        case 'visibility':
          setTabVisible(event.isVisible);
          break;
        case 'idle':
          setPaused(true);
          break;
        case 'resume':
          setPaused(false);
          break;
        default:
          break;
      }
    });

    return unsubscribe;
  }, [setTabVisible, setPaused]);

  return { isTabVisible, isPaused };
}

/**
 * Hook: Smart auto-refresh with visibility awareness
 */
export function useSmartRefresh(fetchFn, intervalMs = 30000) {
  const intervalRef = useRef(null);
  const shouldAutoRefresh = useDataStore((state) => state.shouldAutoRefresh);

  const refresh = useCallback(async () => {
    if (shouldAutoRefresh()) {
      try {
        await fetchFn();
      } catch (error) {
        console.error('Smart refresh error:', error);
      }
    }
  }, [fetchFn, shouldAutoRefresh]);

  useEffect(() => {
    // Initial fetch
    refresh();

    // Set up interval
    intervalRef.current = setInterval(refresh, intervalMs);

    // Subscribe to visibility changes for immediate refresh on resume
    const unsubscribe = visibilityManager.subscribe((event) => {
      if (event.type === 'resume') {
        refresh();
      }
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      unsubscribe();
    };
  }, [refresh, intervalMs]);

  return { refresh };
}

/**
 * Hook: Fetch only when visible (no auto-refresh)
 */
export function useFetchOnVisible(fetchFn) {
  const isTabVisible = useDataStore((state) => state.ui.isTabVisible);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (isTabVisible && !hasFetchedRef.current) {
      fetchFn();
      hasFetchedRef.current = true;
    }
  }, [isTabVisible, fetchFn]);
}

/**
 * Hook: Debounced fetch (prevent rapid successive calls)
 */
export function useDebouncedFetch(fetchFn, delay = 300) {
  const timeoutRef = useRef(null);
  const isTabVisible = useDataStore((state) => state.ui.isTabVisible);

  const debouncedFetch = useCallback(
    (...args) => {
      if (!isTabVisible) return;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        fetchFn(...args);
      }, delay);
    },
    [fetchFn, delay, isTabVisible]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedFetch;
}

export default visibilityManager;
