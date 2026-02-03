import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './components/ThemeProvider';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

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
const TradeAdvisor = lazy(() => import('./pages/TradeAdvisor'));
const Calculators = lazy(() => import('./pages/Calculators'));
const TradingJournal = lazy(() => import('./pages/TradingJournal'));
const Backtest = lazy(() => import('./pages/Backtest'));
const Settings = lazy(() => import('./pages/Settings'));

// User & Admin pages
const UserProfile = lazy(() => import('./pages/UserProfile'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const Login = lazy(() => import('./pages/Login'));

function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Login Page */}
        <Route path="/login" element={<Login />} />
        <Route path="/signin" element={<Navigate to="/login" replace />} />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        
        {/* Main Dashboard */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Scanner Hub - All scanners */}
        <Route path="/scanners" element={<ScannerHub />} />
        <Route path="/scanners/*" element={<Navigate to="/scanners" replace />} />
        
        {/* Options Hub - Chain, Greeks, OI, Payoff */}
        <Route path="/options" element={<OptionsHub />} />
        <Route path="/options/*" element={<Navigate to="/options" replace />} />
        <Route path="/option-chain" element={<Navigate to="/options" replace />} />
        <Route path="/oi-analytics" element={<Navigate to="/options" replace />} />
        
        {/* Signals Hub - AI trade signals */}
        <Route path="/signals" element={<SignalsHub />} />
        <Route path="/signals/*" element={<Navigate to="/signals" replace />} />
        
        {/* Market Hub - FII/DII, Sectors, Breadth */}
        <Route path="/market" element={<MarketHub />} />
        <Route path="/fii-dii" element={<Navigate to="/market" replace />} />
        
        {/* Trade Advisor - AI recommendations */}
        <Route path="/advisor" element={<TradeAdvisor />} />
        
        {/* Calculators */}
        <Route path="/calculators" element={<Calculators />} />
        
        {/* Trading Journal */}
        <Route path="/journal" element={<TradingJournal />} />
        
        {/* Backtesting */}
        <Route path="/backtest" element={<Backtest />} />
        
        {/* Settings */}
        <Route path="/settings" element={<Settings />} />
        
        {/* User Profile */}
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/user" element={<Navigate to="/profile" replace />} />
        
        {/* Admin Panel - Only accessible by admins */}
        <Route path="/admin" element={<AdminPanel />} />
        
        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
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
