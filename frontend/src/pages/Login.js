import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha, useTheme } from '@mui/material/styles';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import {
  Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight, Chrome, Apple,
  TrendingUp, BarChart3, Shield, Zap, LineChart, Target
} from 'lucide-react';
import { Button, Input, Card } from '../components/ui';
import { isAdmin } from '../lib/utils';
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

  const theme = useTheme();

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

  /* ── Shared input sx ── */
  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: alpha(theme.palette.common.white, 0.04),
      borderRadius: '12px',
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: alpha(theme.palette.common.white, 0.08),
    },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: alpha(theme.palette.primary.main, 0.5),
    },
  };

  /* ── Feature pill data ── */
  const features = [
    { icon: Zap, label: 'AI Signals', value: 'Real-time', color: theme.palette.warning.light },
    { icon: Target, label: 'Scanners', value: '15+ Pre-built', color: '#22d3ee' },
    { icon: LineChart, label: 'F&O Stocks', value: '200+ Tracked', color: theme.palette.primary.light },
    { icon: BarChart3, label: 'Analytics', value: 'Pro Grade', color: theme.palette.secondary.light },
  ];

  return (
    <>
      <SEO {...getSeoConfig('/login')} path="/login" />
      <Box
        component="main"
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
        }}
      >

        {/* ── Ambient background effects (visible on both sides) ── */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            '@keyframes ambientPulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.5 },
            },
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: '25%',
              width: 600,
              height: 600,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              borderRadius: '50%',
              filter: 'blur(120px)',
              animation: 'ambientPulse 6s ease-in-out infinite',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              right: '25%',
              width: 500,
              height: 500,
              bgcolor: alpha('#14b8a6', 0.08),
              borderRadius: '50%',
              filter: 'blur(100px)',
              animation: 'ambientPulse 8s ease-in-out infinite',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 800,
              height: 800,
              bgcolor: alpha(theme.palette.primary.main, 0.05),
              borderRadius: '50%',
              filter: 'blur(150px)',
            }}
          />
        </Box>

        {/* ═══════════════════════════════════════════════════════
            LEFT SIDE — Branding Panel
            ═══════════════════════════════════════════════════════ */}
        <Box
          sx={{
            display: { xs: 'none', lg: 'flex' },
            width: { lg: '52%' },
            position: 'relative',
            p: 5,
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflow: 'hidden',
          }}
        >

          {/* Decorative gradient mesh */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(to bottom right, ${alpha(theme.palette.primary.main, 0.15)}, transparent, ${alpha('#134e4a', 0.15)})`,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `radial-gradient(circle at 1px 1px, ${alpha(theme.palette.common.white, 0.03)} 1px, transparent 0)`,
              backgroundSize: '32px 32px',
            }}
          />

          {/* Floating shapes */}
          <Box
            component={motion.div}
            animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            sx={{
              position: 'absolute',
              top: 128,
              right: 80,
              width: 80,
              height: 80,
              borderRadius: '16px',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.2),
              backdropFilter: 'blur(4px)',
            }}
          />
          <Box
            component={motion.div}
            animate={{ y: [0, 15, 0], rotate: [0, -8, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            sx={{
              position: 'absolute',
              bottom: 160,
              left: 64,
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: alpha('#14b8a6', 0.1),
              border: '1px solid',
              borderColor: alpha('#14b8a6', 0.2),
              backdropFilter: 'blur(4px)',
            }}
          />
          <Box
            component={motion.div}
            animate={{ y: [0, -12, 0], x: [0, 8, 0] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
            sx={{
              position: 'absolute',
              top: '50%',
              right: 128,
              width: 40,
              height: 40,
              borderRadius: '8px',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.2),
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Logo */}
          <Box
            component={motion.div}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            sx={{ position: 'relative', zIndex: 1 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ position: 'relative' }}>
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    bgcolor: alpha(theme.palette.primary.main, 0.3),
                    borderRadius: '16px',
                    filter: 'blur(16px)',
                  }}
                />
                <Box
                  component="img"
                  src="/logo.png"
                  alt="Money Saarthi"
                  sx={{ width: 56, height: 56, objectFit: 'contain', position: 'relative' }}
                />
              </Box>
              <Box>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 700, letterSpacing: '-0.025em' }}
                >
                  Money Saarthi
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 500,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  Pro Trading Platform
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Hero copy */}
          <Box
            component={motion.div}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            <Box>
              <Typography
                sx={{
                  fontSize: '3rem',
                  fontWeight: 800,
                  lineHeight: 1.1,
                  mb: 2,
                }}
              >
                Trade Smarter,<br />
                <Box
                  component="span"
                  sx={{
                    background: `linear-gradient(to right, ${theme.palette.primary.main}, ${theme.palette.primary.light}, #2dd4bf)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Not Harder
                </Box>
              </Typography>
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: '1rem',
                  maxWidth: 448,
                  lineHeight: 1.6,
                }}
              >
                Professional-grade trading tools powered by AI. Real-time signals,
                advanced analytics, and actionable market insights — all in one platform.
              </Typography>
            </Box>

            {/* Feature pills */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
              {features.map((item, i) => (
                <Box
                  component={motion.div}
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                  sx={{
                    p: 2,
                    borderRadius: '12px',
                    bgcolor: alpha(theme.palette.common.white, 0.04),
                    border: '1px solid',
                    borderColor: alpha(theme.palette.common.white, 0.08),
                    backdropFilter: 'blur(4px)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.common.white, 0.07),
                      borderColor: alpha(theme.palette.common.white, 0.12),
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: alpha(theme.palette.common.white, 0.06),
                        color: item.color,
                      }}
                    >
                      <item.icon style={{ width: 16, height: 16 }} />
                    </Box>
                    <Typography
                      sx={{
                        fontSize: '0.6875rem',
                        color: 'text.secondary',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {item.label}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '1.125rem', fontWeight: 700 }}>
                    {item.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Testimonial / trust strip */}
          <Box
            component={motion.div}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            sx={{
              position: 'relative',
              zIndex: 1,
              p: 2.5,
              borderRadius: '12px',
              bgcolor: alpha(theme.palette.common.white, 0.04),
              border: '1px solid',
              borderColor: alpha(theme.palette.common.white, 0.08),
              backdropFilter: 'blur(4px)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  bgcolor: alpha(theme.palette.primary.main, 0.15),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  mt: 0.25,
                }}
              >
                <Shield style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
              </Box>
              <Box>
                <Typography
                  sx={{
                    fontSize: '0.875rem',
                    color: 'text.secondary',
                    fontStyle: 'italic',
                    lineHeight: 1.6,
                    mb: 1,
                  }}
                >
                  "Smart options analytics, live market data, and AI-powered insights — everything a serious trader needs."
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ display: 'flex', '& > :not(:first-of-type)': { ml: '-6px' } }}>
                    {['hsl(160,84%,39%)','hsl(217,91%,60%)','hsl(38,92%,50%)','hsl(0,84%,60%)'].map((c, i) => (
                      <Box
                        key={i}
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          border: '2px solid',
                          borderColor: 'background.default',
                        }}
                        style={{ background: c }}
                      />
                    ))}
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    Trusted by active traders
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ═══════════════════════════════════════════════════════
            RIGHT SIDE — Login Form
            ═══════════════════════════════════════════════════════ */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 3, sm: 4 },
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Box
            component={motion.div}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            sx={{ width: '100%', maxWidth: 420 }}
          >
            {/* Mobile Logo */}
            <Box
              sx={{
                display: { xs: 'flex', lg: 'none' },
                alignItems: 'center',
                gap: 1.5,
                mb: 4,
                justifyContent: 'center',
              }}
            >
              <Box sx={{ position: 'relative' }}>
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    bgcolor: alpha(theme.palette.primary.main, 0.3),
                    borderRadius: '12px',
                    filter: 'blur(12px)',
                  }}
                />
                <Box
                  component="img"
                  src="/logo.png"
                  alt="Money Saarthi"
                  sx={{ width: 44, height: 44, objectFit: 'contain', position: 'relative' }}
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em' }}>
                  Money Saarthi
                </Typography>
                <Typography
                  sx={{
                    fontSize: '10px',
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  Pro Trading
                </Typography>
              </Box>
            </Box>

            {/* Form Card */}
            <Box
              sx={{
                borderRadius: '16px',
                bgcolor: alpha(theme.palette.background.paper, 0.6),
                backdropFilter: 'blur(40px)',
                border: '1px solid',
                borderColor: alpha(theme.palette.common.white, 0.08),
                p: 3.5,
                boxShadow: `0 25px 50px -12px ${alpha(theme.palette.common.black, 0.2)}`,
              }}
            >

              {/* Title */}
              <Box sx={{ textAlign: 'center', mb: 3.5 }}>
                <Box
                  component={motion.div}
                  key={isLogin ? 'login' : 'signup'}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.75 }}>
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {isLogin
                      ? 'Sign in to access your trading dashboard'
                      : 'Start your trading journey today'}
                  </Typography>
                </Box>
              </Box>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <Box
                    component={motion.div}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    sx={{ mb: 2 }}
                  >
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: '12px',
                        bgcolor: alpha(theme.palette.error.main, 0.1),
                        border: '1px solid',
                        borderColor: alpha(theme.palette.error.main, 0.2),
                        color: theme.palette.error.light,
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          bgcolor: 'error.main',
                          flexShrink: 0,
                        }}
                      />
                      {error}
                    </Box>
                  </Box>
                )}
              </AnimatePresence>

              {/* Social Login Buttons */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 2.5 }}>
                <ButtonBase
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 1.5,
                    borderRadius: '12px',
                    bgcolor: 'common.white',
                    color: 'grey.900',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'grey.50',
                      boxShadow: `0 10px 15px -3px ${alpha(theme.palette.common.white, 0.1)}`,
                    },
                    '&.Mui-disabled': {
                      opacity: 0.5,
                    },
                    '&:active': {
                      transform: 'scale(0.98)',
                    },
                  }}
                >
                  <svg style={{ width: 20, height: 20 }} viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </ButtonBase>

                <ButtonBase
                  onClick={handleAppleLogin}
                  disabled={true}
                  title="Coming soon"
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 1.5,
                    borderRadius: '12px',
                    bgcolor: alpha(theme.palette.common.white, 0.06),
                    color: 'common.white',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    border: '1px solid',
                    borderColor: alpha(theme.palette.common.white, 0.1),
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.common.white, 0.1),
                      borderColor: alpha(theme.palette.common.white, 0.15),
                    },
                    '&.Mui-disabled': {
                      opacity: 0.5,
                      color: 'common.white',
                    },
                    '&:active': {
                      transform: 'scale(0.98)',
                    },
                  }}
                >
                  <Apple style={{ width: 20, height: 20 }} />
                  Continue with Apple (Coming Soon)
                </ButtonBase>
              </Box>

              {/* Divider */}
              <Divider
                sx={{
                  my: 2.5,
                  '&::before, &::after': {
                    borderColor: alpha(theme.palette.common.white, 0.08),
                  },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.6875rem',
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 500,
                    px: 1,
                  }}
                >
                  or continue with email
                </Typography>
              </Divider>

              {/* Email Form */}
              <Box
                component="form"
                onSubmit={handleSubmit}
                sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}
              >
                <AnimatePresence>
                  {!isLogin && (
                    <Box
                      component={motion.div}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Typography
                        component="label"
                        sx={{
                          fontSize: '0.75rem',
                          color: 'text.secondary',
                          fontWeight: 500,
                          display: 'block',
                          mb: 0.75,
                        }}
                      >
                        Full Name
                      </Typography>
                      <Input
                        type="text"
                        placeholder="John Doe"
                        autoComplete="name"
                        value={form.name}
                        onChange={e => setForm({...form, name: e.target.value})}
                        sx={inputSx}
                      />
                    </Box>
                  )}
                </AnimatePresence>

                <Box>
                  <Typography
                    component="label"
                    sx={{
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      fontWeight: 500,
                      display: 'block',
                      mb: 0.75,
                    }}
                  >
                    Email
                  </Typography>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Mail style={{ width: 16, height: 16, color: theme.palette.text.secondary }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={inputSx}
                  />
                </Box>

                <Box>
                  <Typography
                    component="label"
                    sx={{
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      fontWeight: 500,
                      display: 'block',
                      mb: 0.75,
                    }}
                  >
                    Password
                  </Typography>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    value={form.password}
                    onChange={e => setForm({...form, password: e.target.value})}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock style={{ width: 16, height: 16, color: theme.palette.text.secondary }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            size="small"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                          >
                            {showPassword
                              ? <EyeOff style={{ width: 16, height: 16 }} />
                              : <Eye style={{ width: 16, height: 16 }} />
                            }
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={inputSx}
                  />
                </Box>

                {isLogin && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <ButtonBase
                      type="button"
                      sx={{
                        fontSize: '0.75rem',
                        color: alpha(theme.palette.primary.main, 0.8),
                        fontWeight: 500,
                        transition: 'color 0.2s ease',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      Forgot password?
                    </ButtonBase>
                  </Box>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  sx={{
                    width: '100%',
                    borderRadius: '12px',
                    height: 44,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    boxShadow: `0 10px 15px -3px ${alpha(theme.palette.primary.main, 0.2)}`,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      boxShadow: `0 10px 15px -3px ${alpha(theme.palette.primary.main, 0.3)}`,
                    },
                    '&:active': {
                      transform: 'scale(0.98)',
                    },
                  }}
                >
                  {loading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={16} sx={{ color: alpha(theme.palette.common.white, 0.9) }} />
                      Please wait...
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {isLogin ? 'Sign In' : 'Create Account'}
                      <ArrowRight style={{ width: 16, height: 16 }} />
                    </Box>
                  )}
                </Button>
              </Box>

              {/* Toggle Login/Signup */}
              <Typography
                variant="body2"
                sx={{
                  textAlign: 'center',
                  color: 'text.secondary',
                  mt: 3,
                }}
              >
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
                <ButtonBase
                  type="button"
                  onClick={() => { setIsLogin(!isLogin); setError(''); }}
                  sx={{
                    color: 'primary.main',
                    fontWeight: 600,
                    ml: 0.75,
                    fontSize: 'inherit',
                    verticalAlign: 'baseline',
                    '&:hover': {
                      textDecoration: 'underline',
                      textUnderlineOffset: '2px',
                    },
                  }}
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </ButtonBase>
              </Typography>
            </Box>

            {/* Footer */}
            <Typography
              sx={{
                textAlign: 'center',
                fontSize: '0.6875rem',
                color: alpha(theme.palette.text.secondary, 0.6),
                mt: 2.5,
              }}
            >
              By continuing, you agree to our Terms of Service & Privacy Policy
            </Typography>
          </Box>
        </Box>
      </Box>
    </>
  );
}
