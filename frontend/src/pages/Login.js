import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import {
  Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight, Chrome, Apple,
  TrendingUp, BarChart3, Shield, Zap, LineChart, Target
} from 'lucide-react';
import { Button, Input, Card } from '../components/ui';
import { cn, isAdmin } from '../lib/utils';
import { saveUserToList, getAllUsers } from '../services/adminService';
import { API } from '../config/api';
import { signInWithGoogle, checkRedirectResult } from '../config/firebase';

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN PAGE - With Google & Apple Login
// ═══════════════════════════════════════════════════════════════════════════════

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

  // Check for Firebase redirect results on component mount
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await checkRedirectResult();
        if (result?.success) {
          // User was redirected back from OAuth - process their login
          const googleUser = result.user;
          
          // For redirect flow, we don't have access token, so just save the user
          const user = saveUserToStorage({
            id: googleUser.id,
            email: googleUser.email,
            name: googleUser.name || googleUser.email.split('@')[0],
            avatar: googleUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(googleUser.name || 'User')}&background=10b981&color=fff`,
            joinedAt: new Date().toISOString(),
            provider: googleUser.provider,
            emailVerified: googleUser.emailVerified,
            preferences: { defaultIndex: 'NIFTY', notifications: true, darkMode: true },
            stats: { totalTrades: 0, winRate: 0, totalPnL: 0, streak: 0 }
          });

          navigate(user.isAdmin ? '/admin' : (sessionStorage.getItem('redirectAfterLogin') || '/'));
          sessionStorage.removeItem('redirectAfterLogin');
        }
      } catch (err) {
        // Silently ignore - redirect result is optional, just prevents Firebase warning
        console.debug('Firebase redirect check completed');
      }
    };

    handleRedirectResult();
  }, []);

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

      // Save session token (localStorage is primary, sessionStorage is backup)
      if (data.session_id) {
        localStorage.setItem('authToken', data.session_id);
        sessionStorage.setItem('authToken', data.session_id);
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



  // Authenticate with backend to get session token and subscription data
  const authenticateWithBackend = async (email, name, picture, credential = null) => {
    try {
      // Only send credential-based auth (access_token or JWT)
      const requestBody = credential 
        ? { credential } // Send JWT credential or access token for verification
        : null;
      
      if (!requestBody) {
        console.warn('No credential available for backend auth');
        return null;
      }
      
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



  // Handle Google Login using Firebase Auth (avoids COOP issues)
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await signInWithGoogle();

      if (!result.success) {
        if (result.error !== 'Sign-in was cancelled') {
          setError(result.error || 'Google login failed. Please try again.');
        }
        setLoading(false);
        return;
      }

      const googleUser = result.user;

      // Authenticate with backend using access token
      const backendResponse = await authenticateWithBackend(
        googleUser.email,
        googleUser.name,
        googleUser.avatar,
        result.accessToken
      );

      let subscription = null;
      if (backendResponse?.user) {
        const backendUser = backendResponse.user;
        if (backendUser.is_paid || backendUser.has_free_access || backendUser.has_full_package) {
          subscription = { plan: 'pro', status: 'active', expiresAt: backendUser.subscription_end || null, billingCycle: 'monthly' };
        }
      }

      const user = saveUserToStorage({
        id: googleUser.id,
        email: googleUser.email,
        name: googleUser.name || googleUser.email.split('@')[0],
        avatar: googleUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(googleUser.name || 'User')}&background=10b981&color=fff`,
        joinedAt: new Date().toISOString(),
        provider: 'google',
        emailVerified: googleUser.emailVerified,
        subscription,
        preferences: { defaultIndex: 'NIFTY', notifications: true, darkMode: true },
        stats: { totalTrades: 0, winRate: 0, totalPnL: 0, streak: 0 }
      });

      setLoading(false);
      navigate(user.isAdmin ? '/admin' : (sessionStorage.getItem('redirectAfterLogin') || '/'));
      sessionStorage.removeItem('redirectAfterLogin');
    } catch (err) {
      console.error('Google login error:', err);
      setError('Google login failed. Please try again.');
      setLoading(false);
    }
  };

  // Handle Apple Login - not yet implemented
  const handleAppleLogin = () => {
    setError('Apple Sign In coming soon! Please use Google or email login.');
  };

  return (
    <>
      <SEO {...getSeoConfig('/login')} path="/login" />
      <main className="min-h-screen bg-background flex relative overflow-hidden">

        {/* ── Ambient background effects (visible on both sides) ── */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '6s' }} />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-teal-500/8 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-[150px]" />
        </div>

        {/* ═══════════════════════════════════════════════════════
            LEFT SIDE — Branding Panel
            ═══════════════════════════════════════════════════════ */}
        <div className="hidden lg:flex lg:w-[52%] relative p-10 flex-col justify-between overflow-hidden">

          {/* Decorative gradient mesh */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-teal-900/15" />
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)', backgroundSize: '32px 32px' }} />

          {/* Floating shapes */}
          <motion.div
            animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-32 right-20 w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 backdrop-blur-sm"
          />
          <motion.div
            animate={{ y: [0, 15, 0], rotate: [0, -8, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-40 left-16 w-14 h-14 rounded-full bg-teal-500/10 border border-teal-500/20 backdrop-blur-sm"
          />
          <motion.div
            animate={{ y: [0, -12, 0], x: [0, 8, 0] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/2 right-32 w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm"
          />

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative z-10"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-xl" />
                <img src="/logo.png" alt="Money Saarthi" className="w-14 h-14 object-contain relative" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Money Saarthi</h1>
                <p className="text-xs text-muted-foreground font-medium tracking-wider uppercase">Pro Trading Platform</p>
              </div>
            </div>
          </motion.div>

          {/* Hero copy */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative z-10 space-y-8"
          >
            <div>
              <h2 className="text-5xl font-extrabold leading-tight mb-4">
                Trade Smarter,<br />
                <span className="bg-gradient-to-r from-primary via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  Not Harder
                </span>
              </h2>
              <p className="text-muted-foreground text-base max-w-md leading-relaxed">
                Professional-grade trading tools powered by AI. Real-time signals,
                advanced analytics, and actionable market insights — all in one platform.
              </p>
            </div>

            {/* Feature pills */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Zap, label: 'AI Signals', value: 'Real-time', color: 'text-amber-400' },
                { icon: Target, label: 'Scanners', value: '15+ Pre-built', color: 'text-cyan-400' },
                { icon: LineChart, label: 'F&O Stocks', value: '200+ Tracked', color: 'text-emerald-400' },
                { icon: BarChart3, label: 'Analytics', value: 'Pro Grade', color: 'text-violet-400' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                  className="group p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.07] hover:border-white/[0.12] transition-all duration-300"
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.06]', item.color)}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{item.label}</span>
                  </div>
                  <div className="text-lg font-bold">{item.value}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Testimonial / trust strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="relative z-10 p-5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground italic leading-relaxed mb-2">
                  "Smart options analytics, live market data, and AI-powered insights — everything a serious trader needs."
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    {['hsl(160,84%,39%)','hsl(217,91%,60%)','hsl(38,92%,50%)','hsl(0,84%,60%)'].map((c, i) => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-background" style={{ background: c }} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">Trusted by active traders</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            RIGHT SIDE — Login Form
            ═══════════════════════════════════════════════════════ */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-[420px]"
          >
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 rounded-xl blur-lg" />
                <img src="/logo.png" alt="Money Saarthi" className="w-11 h-11 object-contain relative" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Money Saarthi</h1>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Pro Trading</p>
              </div>
            </div>

            {/* Form Card */}
            <div className="rounded-2xl bg-card/60 backdrop-blur-2xl border border-white/[0.08] p-7 shadow-2xl shadow-black/20">

              {/* Title */}
              <div className="text-center mb-7">
                <motion.div
                  key={isLogin ? 'login' : 'signup'}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="text-2xl font-bold mb-1.5">
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {isLogin
                      ? 'Sign in to access your trading dashboard'
                      : 'Start your trading journey today'}
                  </p>
                </motion.div>
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4"
                  >
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      {error}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Social Login Buttons */}
              <div className="space-y-2.5 mb-5">
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className={cn(
                    'w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl',
                    'bg-white text-gray-900 font-semibold text-sm',
                    'hover:bg-gray-50 hover:shadow-lg hover:shadow-white/10 transition-all duration-200',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'active:scale-[0.98]'
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
                  disabled={true}
                  className={cn(
                    'w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl',
                    'bg-white/[0.06] text-white font-semibold text-sm border border-white/[0.1]',
                    'hover:bg-white/[0.1] hover:border-white/[0.15] transition-all duration-200',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'active:scale-[0.98]'
                  )}
                  title="Coming soon"
                >
                  <Apple className="w-5 h-5" />
                  Continue with Apple (Coming Soon)
                </button>
              </div>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.08]" />
                </div>
                <div className="relative flex justify-center text-[11px]">
                  <span className="px-3 bg-card/60 text-muted-foreground uppercase tracking-wider font-medium">or continue with email</span>
                </div>
              </div>

              {/* Email Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <AnimatePresence>
                  {!isLogin && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <label className="text-xs text-muted-foreground font-medium block mb-1.5">Full Name</label>
                      <Input
                        type="text"
                        placeholder="John Doe"
                        autoComplete="name"
                        value={form.name}
                        onChange={e => setForm({...form, name: e.target.value})}
                        className="bg-white/[0.04] border-white/[0.08] focus:border-primary/50 rounded-xl"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10 bg-white/[0.04] border-white/[0.08] focus:border-primary/50 rounded-xl"
                      autoComplete="email"
                      value={form.email}
                      onChange={e => setForm({...form, email: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-10 pr-10 bg-white/[0.04] border-white/[0.08] focus:border-primary/50 rounded-xl"
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                      value={form.password}
                      onChange={e => setForm({...form, password: e.target.value})}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isLogin && (
                  <div className="flex justify-end">
                    <button type="button" className="text-xs text-primary/80 hover:text-primary transition-colors font-medium">
                      Forgot password?
                    </button>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full rounded-xl h-11 font-semibold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-[0.98]"
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
                  onClick={() => { setIsLogin(!isLogin); setError(''); }}
                  className="text-primary font-semibold ml-1.5 hover:underline underline-offset-2"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>

            {/* Footer */}
            <p className="text-center text-[11px] text-muted-foreground/60 mt-5">
              By continuing, you agree to our Terms of Service & Privacy Policy
            </p>
          </motion.div>
        </div>
      </main>
    </>
  );
}

