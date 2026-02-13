import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight, Chrome, Apple } from 'lucide-react';
import { Button, Input, Card } from '../components/ui';
import { cn } from '../lib/utils';
import { saveUserToList, getAllUsers } from '../services/adminService';
import { API } from '../config/api';

// Google OAuth Client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '517321998192-gu0hj5qc1chlau76fvkqrndslfvrh9ja.apps.googleusercontent.com';

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN PAGE - With Google & Apple Login
// ═══════════════════════════════════════════════════════════════════════════════

// Admin emails - validated server-side, client hint only for UI routing
const ADMIN_EMAILS = [
  'maaktanwar@gmail.com',
  'admin@moneysaarthi.com',
  'superadmin@moneysaarthi.com'
];

const isAdmin = (email) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

export const saveUserToStorage = (user) => {
  // Check if user already exists with subscription in users list (for fallback)
  const existingUsers = getAllUsers();
  const existingUser = existingUsers.find(u => u.email?.toLowerCase() === user.email?.toLowerCase());
  
  // Use subscription from: 1) passed in user object (from backend), 2) existing user in local list
  let subscription = user.subscription || null;
  
  // If no subscription passed in, check existing user list (fallback)
  if (!subscription && existingUser && existingUser.plan === 'pro') {
    subscription = {
      plan: 'pro',
      status: existingUser.subscriptionStatus || 'active',
      billingCycle: existingUser.billingCycle || 'monthly',
      expiresAt: existingUser.subscriptionExpiry || null,
    };
  }
  
  const userWithAdmin = {
    ...user,
    isAdmin: isAdmin(user.email),
    subscription: subscription,
  };
  
  localStorage.setItem('ms_user', JSON.stringify(userWithAdmin));
  // Also save to admin user list for tracking
  saveUserToList(userWithAdmin);
  // Trigger storage event for other components
  window.dispatchEvent(new Event('storage'));
  return userWithAdmin;
};

export default function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: ''
  });

  // Handle email/password login — calls real backend /auth/login or /auth/register
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!form.email || !form.password) {
        throw new Error('Please fill in all fields');
      }

      if (!isLogin && !form.name) {
        throw new Error('Please enter your name');
      }

      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const body = isLogin
        ? { email: form.email, password: form.password }
        : { email: form.email, password: form.password, name: form.name };

      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      // Save session token
      if (data.session_id) {
        localStorage.setItem('session_id', data.session_id);
      }

      // Build user object from backend response and save to localStorage
      const backendUser = data.user || {};
      const user = saveUserToStorage({
        id: backendUser.user_id || backendUser.id,
        email: backendUser.email,
        name: backendUser.name || form.name || form.email.split('@')[0],
        avatar: backendUser.picture || null,
        joinedAt: backendUser.created_at || new Date().toISOString(),
        provider: 'email',
        subscription: backendUser.subscription || null,
        is_paid: backendUser.is_paid || false,
        has_full_package: backendUser.has_full_package || false,
        has_free_access: backendUser.has_free_access || false,
      });

      // Redirect based on admin status or saved redirect URL
      const redirectUrl = sessionStorage.getItem('redirectAfterLogin') || '/';
      sessionStorage.removeItem('redirectAfterLogin');
      
      if (user.isAdmin) {
        navigate('/admin');
      } else {
        navigate(redirectUrl);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load Google Identity Services script
  useEffect(() => {
    // Load Google GIS script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  // Authenticate with backend to get session token and subscription data
  const authenticateWithBackend = async (email, name, picture, credential = null) => {
    try {
      const requestBody = credential 
        ? { credential } // Send JWT credential for verification
        : { email, name: name || email.split('@')[0], picture: picture || '' };
      
      const response = await fetch(`${API}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // For cookies
        body: JSON.stringify(requestBody)
      });
      
      if (response.ok) {
        const data = await response.json();
        // Store session token for API authentication
        if (data.session_id) {
          localStorage.setItem('authToken', data.session_id);
          sessionStorage.setItem('authToken', data.session_id);
        }
        return data;
      }
      return null;
    } catch (err) {
      return null;
    }
  };

  // Handle Google credential response
  const handleGoogleCredentialResponse = useCallback(async (response) => {
    try {
      // Decode the JWT token to get user info
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      
      // Authenticate with backend to create session and get subscription data
      const backendResponse = await authenticateWithBackend(
        payload.email, 
        payload.name, 
        payload.picture,
        response.credential // Send the actual credential to backend
      );
      
      // Determine subscription status from backend
      let subscription = null;
      if (backendResponse?.user) {
        const backendUser = backendResponse.user;
        // Check if user is paid or has free access
        if (backendUser.is_paid || backendUser.has_free_access || backendUser.has_full_package) {
          subscription = {
            plan: 'pro',
            status: 'active',
            expiresAt: backendUser.subscription_end || null,
            billingCycle: 'monthly',
          };
        }
      }
      
      const user = saveUserToStorage({
        id: `google_${payload.sub}`,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        avatar: payload.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.name || 'User')}&background=10b981&color=fff`,
        joinedAt: new Date().toISOString(),
        provider: 'google',
        emailVerified: payload.email_verified,
        subscription: subscription, // Use backend subscription data
        preferences: {
          defaultIndex: 'NIFTY',
          notifications: true,
          darkMode: true
        },
        stats: {
          totalTrades: 0,
          winRate: 0,
          totalPnL: 0,
          streak: 0
        }
      });

      setLoading(false);
      
      // Redirect based on admin status or saved redirect URL
      const redirectUrl = sessionStorage.getItem('redirectAfterLogin') || '/';
      sessionStorage.removeItem('redirectAfterLogin');
      
      if (user.isAdmin) {
        navigate('/admin');
      } else {
        navigate(redirectUrl);
      }
    } catch (err) {
      console.error('Google login error:', err);
      setError('Google login failed. Please try again.');
      setLoading(false);
    }
  }, [navigate]);

  // Handle Google Login using Google Identity Services
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      if (window.google && window.google.accounts) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        
        // Show the One Tap prompt
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Fallback to popup if One Tap is not available
            window.google.accounts.oauth2.initTokenClient({
              client_id: GOOGLE_CLIENT_ID,
              scope: 'email profile',
              callback: async (tokenResponse) => {
                if (tokenResponse.access_token) {
                  // Fetch user info using the access token
                  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                  });
                  const userInfo = await userInfoResponse.json();
                  
                  // Authenticate with backend to get session and subscription data
                  const backendResponse = await authenticateWithBackend(userInfo.email, userInfo.name, userInfo.picture);
                  
                  // Determine subscription status from backend
                  let subscription = null;
                  if (backendResponse?.user) {
                    const backendUser = backendResponse.user;
                    if (backendUser.is_paid || backendUser.has_free_access || backendUser.has_full_package) {
                      subscription = {
                        plan: 'pro',
                        status: 'active',
                        expiresAt: backendUser.subscription_end || null,
                        billingCycle: 'monthly',
                      };
                    }
                  }
                  
                  const user = saveUserToStorage({
                    id: `google_${userInfo.sub}`,
                    email: userInfo.email,
                    name: userInfo.name || userInfo.email.split('@')[0],
                    avatar: userInfo.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(userInfo.name || 'User')}&background=10b981&color=fff`,
                    joinedAt: new Date().toISOString(),
                    provider: 'google',
                    emailVerified: userInfo.email_verified,
                    subscription: subscription, // Use backend subscription data
                    preferences: {
                      defaultIndex: 'NIFTY',
                      notifications: true,
                      darkMode: true
                    },
                    stats: {
                      totalTrades: 0,
                      winRate: 0,
                      totalPnL: 0,
                      streak: 0
                    }
                  });

                  setLoading(false);
                  if (user.isAdmin) {
                    navigate('/admin');
                  } else {
                    navigate('/');
                  }
                }
              },
            }).requestAccessToken();
          }
        });
      } else {
        // Google script not loaded yet, try again after a short delay
        setTimeout(() => {
          if (window.google && window.google.accounts) {
            handleGoogleLogin();
          } else {
            setError('Google login is not available. Please refresh the page and try again.');
            setLoading(false);
          }
        }, 1000);
      }
    } catch (err) {
      console.error('Google login error:', err);
      setError('Google login failed. Please try again.');
      setLoading(false);
    }
  };

  // Handle Apple Login (Sign in with Apple JS)
  const handleAppleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      // Apple Sign In requires Apple Developer account setup
      // For now, show a message that it's coming soon
      setError('Apple Sign In coming soon! Please use Google login.');
      setLoading(false);
      
      // When ready, implement using Apple JS SDK:
      // https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js
    } catch (err) {
      console.error('Apple login error:', err);
      setError('Apple login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/20 via-background to-teal-900/20 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary/30 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Money Saarthi" className="w-14 h-14 object-contain" />
            <div>
              <h1 className="text-2xl font-bold">Money Saarthi</h1>
              <p className="text-sm text-muted-foreground">Pro Trading Platform</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-bold mb-4">
              Trade Smarter,<br />
              <span className="text-gradient">Not Harder</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-md">
              Professional-grade trading tools powered by AI. Get real-time signals, 
              advanced analytics, and market insights.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'AI Signals', value: 'Real-time', desc: 'Analysis' },
              { label: 'Scanners', value: '15+', desc: 'Pre-built' },
              { label: 'F&O Stocks', value: '200+', desc: 'Tracked' },
              { label: 'Analytics', value: 'Pro', desc: 'Grade Tools' },
            ].map(stat => (
              <div key={stat.label} className="glass p-4 rounded-xl">
                <div className="text-2xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative z-10 glass p-6 rounded-xl">
          <p className="text-sm italic mb-3">
            "Smart options analytics, live market data, and AI-powered insights — all in one platform."
          </p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-medium text-sm">Money Saarthi</div>
              <div className="text-xs text-muted-foreground">AI-Powered Trading Platform</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <img src="/logo.png" alt="Money Saarthi" className="w-12 h-12 object-contain" />
            <h1 className="text-xl font-bold">Money Saarthi</h1>
          </div>

          <Card className="glass-strong p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-muted-foreground">
                {isLogin 
                  ? 'Sign in to access your trading dashboard' 
                  : 'Start your trading journey today'}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Social Login Buttons */}
            <div className="space-y-3 mb-6">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className={cn(
                  'w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl',
                  'bg-white text-gray-900 font-medium',
                  'hover:bg-gray-100 transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <button
                onClick={handleAppleLogin}
                disabled={loading}
                className={cn(
                  'w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl',
                  'bg-black text-white font-medium border border-white/10',
                  'hover:bg-gray-900 transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <Apple className="w-5 h-5" />
                Continue with Apple
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-card text-muted-foreground">or continue with email</span>
              </div>
            </div>

            {/* Email Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Full Name</label>
                  <Input
                    type="text"
                    placeholder="John Doe"
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                  />
                </div>
              )}

              <div>
                <label className="text-sm text-muted-foreground block mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    className="pl-10"
                    value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    value={form.password}
                    onChange={e => setForm({...form, password: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {isLogin && (
                <div className="flex justify-end">
                  <button type="button" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Please wait...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {isLogin ? 'Sign In' : 'Create Account'}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>

            {/* Toggle Login/Signup */}
            <p className="text-center text-sm text-muted-foreground mt-6">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-primary font-medium ml-1 hover:underline"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </Card>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-4">
            By continuing, you agree to our Terms of Service & Privacy Policy
          </p>
        </motion.div>
      </div>
    </div>
  );
}
