import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { Button, Card, CardContent } from './ui';
import { hasProAccess, getUserSubscription, PLANS } from '../pages/Pricing';

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION GUARD - Protects premium routes
// ═══════════════════════════════════════════════════════════════════════════════

// Routes that require Pro subscription
export const PRO_ROUTES = [
  '/signals',
  '/options',
  '/advisor',
  '/journal',
  '/backtest',
  '/market',
];

// Routes that are always free
export const FREE_ROUTES = [
  '/',
  '/dashboard',
  '/login',
  '/pricing',
  '/profile',
  '/settings',
  '/admin',
  '/calculators',
  '/scanners', // Limited scanner access
];

// Check if a route requires Pro subscription
export const requiresProSubscription = (path) => {
  return PRO_ROUTES.some(route => path.startsWith(route));
};

// Upgrade Prompt Component
export const UpgradePrompt = ({ feature, onClose }) => {
  const navigate = useNavigate();
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <Card className="max-w-md w-full glass-strong border-primary/20">
          <CardContent className="p-8 text-center">
            {/* Icon */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-yellow-500/20 flex items-center justify-center mx-auto mb-6">
              <Crown className="w-10 h-10 text-primary" />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold mb-2">Upgrade to Pro</h2>
            <p className="text-muted-foreground mb-6">
              {feature 
                ? `Access ${feature} and all premium features with Money Saarthi Pro`
                : 'Unlock all premium features with Money Saarthi Pro'}
            </p>

            {/* Features Preview */}
            <div className="bg-primary/5 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Pro Features Include:
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>✓ AI Trade Signals & Recommendations</li>
                <li>✓ Options Chain & Greek Analysis</li>
                <li>✓ Real-time FII/DII Data</li>
                <li>✓ Trading Journal & Analytics</li>
                <li>✓ Strategy Backtesting</li>
              </ul>
            </div>

            {/* Pricing */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">₹899</p>
                <p className="text-xs text-muted-foreground">/month</p>
              </div>
              <div className="text-muted-foreground">or</div>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">₹4,999</p>
                <p className="text-xs text-muted-foreground">/year (save 53%)</p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onClose}
              >
                Maybe Later
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-primary to-emerald-600"
                onClick={() => navigate('/pricing')}
              >
                <span className="flex items-center gap-2">
                  Upgrade Now
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

// Subscription Guard Component
export const SubscriptionGuard = ({ children, feature }) => {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const hasPro = hasProAccess();

  if (!hasPro) {
    return (
      <>
        {/* Locked Content Overlay */}
        <div className="relative">
          {/* Blurred/Locked Content */}
          <div className="filter blur-sm pointer-events-none opacity-50">
            {children}
          </div>
          
          {/* Upgrade Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="text-center p-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Premium Feature</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">
                {feature 
                  ? `${feature} is available with Pro subscription`
                  : 'This feature requires a Pro subscription'}
              </p>
              <Button
                onClick={() => setShowUpgrade(true)}
                className="bg-gradient-to-r from-primary to-emerald-600"
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Pro
              </Button>
            </div>
          </div>
        </div>

        {/* Upgrade Modal */}
        {showUpgrade && (
          <UpgradePrompt 
            feature={feature} 
            onClose={() => setShowUpgrade(false)} 
          />
        )}
      </>
    );
  }

  return children;
};

// HOC to wrap protected pages
export const withSubscriptionGuard = (Component, feature) => {
  return function ProtectedComponent(props) {
    const navigate = useNavigate();
    const location = useLocation();
    const hasPro = hasProAccess();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
      // Check subscription on mount
      if (!hasPro && requiresProSubscription(location.pathname)) {
        // Redirect to pricing with return URL
        navigate('/pricing', { 
          state: { 
            from: location.pathname,
            feature: feature 
          } 
        });
      }
      setChecked(true);
    }, [hasPro, location.pathname, navigate]);

    if (!checked) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      );
    }

    if (!hasPro && requiresProSubscription(location.pathname)) {
      return null; // Will redirect
    }

    return <Component {...props} />;
  };
};

// Subscription Status Badge Component
export const SubscriptionBadge = ({ className }) => {
  const subscription = getUserSubscription();
  const hasPro = hasProAccess();

  if (hasPro) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-primary/20 to-yellow-500/20 text-primary text-sm font-medium ${className}`}>
        <Crown className="w-3.5 h-3.5" />
        Pro
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-500/20 text-slate-400 text-sm font-medium ${className}`}>
      Free
    </div>
  );
};

export default SubscriptionGuard;
