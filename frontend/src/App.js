import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './components/ThemeProvider';
import ErrorBoundary from './components/ErrorBoundary';
import { Crown, Lock, ArrowRight, Sparkles, X } from 'lucide-react';
import { API } from './config/api';
import './App.css';

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION VERSION - Increment this to force subscription recheck for all users
// ═══════════════════════════════════════════════════════════════════════════════
const SUBSCRIPTION_VERSION = 'v3_subscription_required';

// Force clear old subscription data on version mismatch
const checkSubscriptionVersion = () => {
  const storedVersion = localStorage.getItem('ms_subscription_version');
  if (storedVersion !== SUBSCRIPTION_VERSION) {
    // Clear subscription from user data
    const user = JSON.parse(localStorage.getItem('ms_user') || 'null');
    if (user) {
      delete user.subscription;
      delete user.plan;
      localStorage.setItem('ms_user', JSON.stringify(user));
    }
    localStorage.setItem('ms_subscription_version', SUBSCRIPTION_VERSION);
  }
};

// Run version check immediately
checkSubscriptionVersion();

// Ensure auth token exists - if user is logged in but no token, force re-login
const ensureAuthToken = () => {
  const user = JSON.parse(localStorage.getItem('ms_user') || 'null');
  const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  
  if (user?.email && !authToken) {
    // Clear user data to force re-login which will create proper session
    localStorage.removeItem('ms_user');
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('authToken');
    // Trigger storage event so components know
    window.dispatchEvent(new Event('storage'));
    return false;
  }
  return true;
};

// Run token check immediately
ensureAuthToken();

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      cacheTime: 300000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

// Loading Component
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

// Sync subscription status with backend on app load
const syncSubscriptionFromBackend = async () => {
  try {
    const user = JSON.parse(localStorage.getItem('ms_user') || 'null');
    if (!user?.email) return;
    
    const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!authToken) return;
    
    // Fetch user data from backend using /auth/me endpoint
    const response = await fetch(`${API}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    if (response.ok) {
      const backendUser = await response.json();
      
      // Check if user has paid access from backend
      if (backendUser.is_paid || backendUser.has_free_access || backendUser.has_full_package) {
        const subscription = {
          plan: 'pro',
          status: 'active',
          expiresAt: backendUser.subscription_end || null,
          billingCycle: 'monthly',
        };
        
        // Only update if subscription status changed
        const currentSub = user.subscription;
        if (!currentSub || currentSub.plan !== 'pro') {
          user.subscription = subscription;
          localStorage.setItem('ms_user', JSON.stringify(user));
          window.dispatchEvent(new Event('storage'));
        }
      } else if (user.subscription && user.subscription.plan === 'pro') {
        // User WAS pro but now backend says no - revoke access
        user.subscription = null;
        localStorage.setItem('ms_user', JSON.stringify(user));
        window.dispatchEvent(new Event('storage'));
      }
    }
  } catch (err) {
    console.warn('Subscription sync skipped:', err.message);
  }
};

// Check if user is logged in
const isAuthenticated = () => {
  try {
    const user = localStorage.getItem('ms_user');
    const parsed = user ? JSON.parse(user) : null;
    return parsed?.email ? true : false;
  } catch {
    return false;
  }
};

// Check if user has active subscription
const hasActiveSubscription = () => {
  try {
    const user = JSON.parse(localStorage.getItem('ms_user') || '{}');
    
    // Admins always have access
    if (user.isAdmin) {
      return true;
    }
    
    const sub = user.subscription;
    if (!sub) {
      return false;
    }
    
    // Must have pro plan with active status
    if (sub.plan !== 'pro' || sub.status !== 'active') {
      return false;
    }
    
    // Check if subscription has expired
    if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) {
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('❌ Subscription check error:', e);
    return false;
  }
};

// Protected Route Component - Redirects to login if not authenticated
const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  
  if (!isAuthenticated()) {
    // Save the attempted URL to redirect after login
    sessionStorage.setItem('redirectAfterLogin', location.pathname);
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Subscription Paywall Overlay - Shows blurred content with upgrade prompt
const SubscriptionPaywall = ({ children }) => {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="relative min-h-screen">
      {/* Blurred Content */}
      <div className="filter blur-md pointer-events-none select-none">
        {children}
      </div>
      
      {/* Subscription Required Overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="max-w-lg w-full mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/20 to-yellow-500/20 p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-yellow-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Lock className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Subscription Required</h2>
            <p className="text-muted-foreground">
              Subscribe to Money Saarthi Pro to access all features
            </p>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Features */}
            <div className="bg-primary/5 rounded-xl p-4 mb-6">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                What you'll get with Pro:
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span> Full Dashboard & Market Overview
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span> AI Trade Signals & Recommendations
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span> Options Chain & Greek Analysis
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span> All Scanners (15+ screeners)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span> Trading Journal & Backtesting
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span> Algo Trading Bots
                </li>
              </ul>
            </div>

            {/* Pricing */}
            <div className="flex items-center justify-center gap-6 mb-6 p-4 rounded-xl border border-border">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">₹899</p>
                <p className="text-xs text-muted-foreground">/month</p>
              </div>
              <div className="text-2xl text-muted-foreground font-light">or</div>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">₹4,999</p>
                <p className="text-xs text-muted-foreground">/year</p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-green-500/20 text-green-500 text-xs font-semibold rounded-full">
                  Save 53%
                </span>
              </div>
            </div>

            {/* CTA Buttons */}
            <button
              onClick={() => navigate('/pricing')}
              className="w-full py-4 px-6 bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              <Crown className="w-5 h-5" />
              Subscribe Now
              <ArrowRight className="w-5 h-5" />
            </button>
            
            <p className="text-center text-xs text-muted-foreground mt-4">
              Secure payment • Cancel anytime • Instant access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Subscription Route Component - Shows BLURRED content for unpaid users
const SubscriptionRoute = ({ children }) => {
  const location = useLocation();
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  
  // Re-check subscription on every mount and location change
  useEffect(() => {
    const checkSubscription = () => {
      const authenticated = isAuthenticated();
      const subscribed = hasActiveSubscription();
      setHasSubscription(subscribed);
      setSubscriptionChecked(true);
    };
    
    checkSubscription();
    
    // Also listen for storage changes (for when subscription is updated)
    const handleStorageChange = () => {
      checkSubscription();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [location.pathname]);
  
  // First check if logged in
  if (!isAuthenticated()) {
    sessionStorage.setItem('redirectAfterLogin', location.pathname);
    return <Navigate to="/login" replace />;
  }
  
  // Wait for subscription check to complete
  if (!subscriptionChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  
  // If no active subscription, show blurred content with paywall
  if (!hasSubscription) {
    return <SubscriptionPaywall>{children}</SubscriptionPaywall>;
  }
  
  return children;
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAGES
// ═══════════════════════════════════════════════════════════════════════════════

// Core page - direct import
import Dashboard from './pages/Dashboard';

// Lazy loaded pages
const ScannerHub = lazy(() => import('./pages/ScannerHub'));
const OptionsHub = lazy(() => import('./pages/OptionsHub'));
const SignalsHub = lazy(() => import('./pages/SignalsHub'));
const MarketHub = lazy(() => import('./pages/MarketHub'));
const Calculators = lazy(() => import('./pages/Calculators'));
const TradingJournal = lazy(() => import('./pages/TradingJournal'));
const Backtest = lazy(() => import('./pages/Backtest'));
const Settings = lazy(() => import('./pages/Settings'));

// User & Admin pages
const UserProfile = lazy(() => import('./pages/UserProfile'));
const Login = lazy(() => import('./pages/Login'));
const Pricing = lazy(() => import('./pages/Pricing'));

// AI pages
const AlgoTrading = lazy(() => import('./pages/AlgoTrading'));
const LTPCalculator = lazy(() => import('./pages/LTPCalculator'));
const TradeFinder = lazy(() => import('./pages/TradeFinder'));
const AIAgent = lazy(() => import('./pages/AIAgent'));
const Sectors = lazy(() => import('./pages/Sectors'));

function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Pages - No login required */}
        <Route path="/login" element={<Login />} />
        <Route path="/signin" element={<Navigate to="/login" replace />} />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
        <Route path="/subscribe" element={<Navigate to="/pricing" replace />} />
        <Route path="/plans" element={<Navigate to="/pricing" replace />} />
        
        {/* Subscription Required Pages - Login + Active Subscription required */}
        <Route path="/" element={<SubscriptionRoute><Dashboard /></SubscriptionRoute>} />
        <Route path="/dashboard" element={<SubscriptionRoute><Dashboard /></SubscriptionRoute>} />
        
        {/* Scanner Hub - All scanners */}
        <Route path="/scanners" element={<SubscriptionRoute><ScannerHub /></SubscriptionRoute>} />
        <Route path="/scanners/*" element={<Navigate to="/scanners" replace />} />
        
        {/* Options Hub - Chain, Greeks, OI, Payoff */}
        <Route path="/options" element={<SubscriptionRoute><OptionsHub /></SubscriptionRoute>} />
        <Route path="/options/*" element={<Navigate to="/options" replace />} />
        <Route path="/option-chain" element={<Navigate to="/options" replace />} />
        <Route path="/oi-analytics" element={<Navigate to="/options" replace />} />
        
        {/* Signals Hub - AI trade signals */}
        <Route path="/signals" element={<SubscriptionRoute><SignalsHub /></SubscriptionRoute>} />
        <Route path="/signals/*" element={<Navigate to="/signals" replace />} />
        
        {/* Market Hub - FII/DII, Sectors, Breadth */}
        <Route path="/market" element={<SubscriptionRoute><MarketHub /></SubscriptionRoute>} />
        
        {/* Sectors - All stocks by sector */}
        <Route path="/sectors" element={<SubscriptionRoute><Sectors /></SubscriptionRoute>} />
        <Route path="/fii-dii" element={<Navigate to="/market" replace />} />
        
        {/* Redirect old AI Advisor routes to Algo Trading */}
        <Route path="/ai-advisor" element={<Navigate to="/algo" replace />} />
        <Route path="/advisor" element={<Navigate to="/algo" replace />} />
        <Route path="/ai" element={<Navigate to="/algo" replace />} />
        
        {/* Token Recharge - merged into profile */}
        <Route path="/tokens" element={<Navigate to="/profile" replace />} />
        <Route path="/recharge" element={<Navigate to="/profile" replace />} />
        
        {/* AI Agent - Autonomous Trading */}
        <Route path="/ai-agent" element={<SubscriptionRoute><AIAgent /></SubscriptionRoute>} />
        <Route path="/agent" element={<Navigate to="/ai-agent" replace />} />
        
        {/* Algo Trading - AI Bots */}
        <Route path="/algo" element={<SubscriptionRoute><AlgoTrading /></SubscriptionRoute>} />
        <Route path="/algo-trading" element={<Navigate to="/algo" replace />} />
        <Route path="/bots" element={<Navigate to="/algo" replace />} />
        
        {/* Calculators */}
        <Route path="/calculators" element={<SubscriptionRoute><Calculators /></SubscriptionRoute>} />
        
        {/* LTP Calculator & Trade Finder */}
        <Route path="/ltp-calculator" element={<SubscriptionRoute><LTPCalculator /></SubscriptionRoute>} />
        <Route path="/ltp" element={<Navigate to="/ltp-calculator" replace />} />
        <Route path="/trade-finder" element={<SubscriptionRoute><TradeFinder /></SubscriptionRoute>} />
        
        {/* Trading Journal */}
        <Route path="/journal" element={<SubscriptionRoute><TradingJournal /></SubscriptionRoute>} />
        
        {/* Backtesting */}
        <Route path="/backtest" element={<SubscriptionRoute><Backtest /></SubscriptionRoute>} />
        
        {/* Settings */}
        <Route path="/settings" element={<SubscriptionRoute><Settings /></SubscriptionRoute>} />
        
        {/* User Profile & Admin (merged) */}
        <Route path="/profile" element={<SubscriptionRoute><UserProfile /></SubscriptionRoute>} />
        <Route path="/user" element={<Navigate to="/profile" replace />} />
        <Route path="/admin" element={<Navigate to="/profile" replace />} />
        
        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  // Sync subscription with backend on app load
  useEffect(() => {
    syncSubscriptionFromBackend();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
