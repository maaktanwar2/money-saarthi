// Header Component - Top navigation bar with market info (MUI)
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search, Bell, Sun, Moon, User, Menu as MenuIcon,
  TrendingUp, TrendingDown, Activity, LogOut, Coins, Crown, Settings
} from 'lucide-react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import MuiBadge from '@mui/material/Badge';
import MuiMenu from '@mui/material/Menu';
import MuiMenuItem from '@mui/material/MenuItem';
import MuiAvatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import { formatNumber, formatPercent, getMarketSession, fetchAPI } from '../lib/utils';
import { Input } from './ui';
import { useTheme } from './ThemeProvider';

// Market Ticker Component
const MarketTicker = () => {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const data = await fetchAPI('/nse/indices');
        const indicesArray = data?.all_indices || data?.data || [];
        if (indicesArray.length > 0) {
          setIndices(indicesArray.slice(0, 8)); // Top 8 indices for ticker
        }
      } catch (error) {
        // Use fallback data
        setIndices([
          { symbol: 'NIFTY 50', last: 25727, change: 639, pChange: 2.55 },
          { symbol: 'NIFTY BANK', last: 60041, change: 1422, pChange: 2.43 },
          { symbol: 'NIFTY IT', last: 35420, change: 280, pChange: 0.80 },
          { symbol: 'NIFTY MIDCAP 50', last: 17013, change: 464, pChange: 2.80 },
          { symbol: 'INDIA VIX', last: 12.9, change: -0.97, pChange: -6.99 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchIndices();
    const interval = setInterval(() => { if (!document.hidden) fetchIndices(); }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <Skeleton variant="rectangular" height={24} sx={{ width: '100%', borderRadius: 1 }} />;
  }

  // Duplicate for seamless scroll
  const tickerItems = [...indices, ...indices];

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', flex: 1, mx: 1.5 }}>
      {/* Left fade mask */}
      <Box
        sx={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 32, zIndex: 1,
          pointerEvents: 'none',
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(to right, rgba(10,14,23,0.95), transparent)'
              : 'linear-gradient(to right, rgba(255,255,255,0.95), transparent)',
        }}
      />
      {/* Right fade mask */}
      <Box
        sx={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 32, zIndex: 1,
          pointerEvents: 'none',
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(to left, rgba(10,14,23,0.95), transparent)'
              : 'linear-gradient(to left, rgba(255,255,255,0.95), transparent)',
        }}
      />

      <Box sx={{ overflow: 'hidden' }}>
        <Box
          className="animate-ticker"
          sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}
        >
          {tickerItems.map((index, i) => {
            const pct = index.pChange || 0;
            const isUp = pct >= 0;
            return (
              <Box
                key={`${index.symbol || index.name}-${i}`}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.75,
                  fontSize: '13px', whiteSpace: 'nowrap',
                  px: 1.25, py: 0.5, borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  transition: 'background-color 0.2s',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                }}
              >
                <Typography
                  component="span"
                  sx={{ fontWeight: 600, fontSize: '13px', color: 'text.primary', opacity: 0.9 }}
                >
                  {(index.symbol || index.name || '').replace('NIFTY ', '').replace('INDIA ', '')}
                </Typography>
                <Typography
                  component="span"
                  sx={{ fontWeight: 500, fontSize: '13px', color: 'text.secondary' }}
                >
                  {formatNumber(index.last || index.lastPrice, { decimals: (index.last || 0) < 100 ? 2 : 0 })}
                </Typography>
                <Chip
                  size="small"
                  icon={isUp ? <TrendingUp style={{ width: 12, height: 12 }} /> : <TrendingDown style={{ width: 12, height: 12 }} />}
                  label={`${isUp ? '+' : ''}${pct.toFixed(2)}%`}
                  sx={{
                    height: 22, fontSize: '11px', fontWeight: 700,
                    '& .MuiChip-icon': { fontSize: 12, ml: 0.5 },
                    '& .MuiChip-label': { px: 0.5 },
                    ...(isUp
                      ? { color: '#34d399', bgcolor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }
                      : { color: '#f87171', bgcolor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }),
                    border: '1px solid',
                  }}
                />
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* CSS for ticker animation */}
      <style>{`
        .animate-ticker {
          animation: ticker 35s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </Box>
  );
};

// Main Header Component
export const Header = ({ onMenuClick }) => {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState(3);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(null);
  const marketSession = getMarketSession();
  const userMenuAnchorRef = useRef(null);

  // Get user info (must be before useEffect that references it)
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('ms_user') || '{}'); } catch { return {}; }
  })();
  const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const photoURL = user.photoURL || user.picture || null;

  // Fetch token balance
  const userEmail = user?.email;
  useEffect(() => {
    if (!userEmail) return;

    let cancelled = false;
    const loadTokens = async () => {
      try {
        const data = await fetchAPI('/ai/tokens/balance', { headers: { 'X-User-Id': userEmail } });
        if (!cancelled) setTokenBalance(data?.unlimited ? '\u221e' : (data?.balance ?? null));
      } catch { /* ignore */ }
    };
    loadTokens();
    const interval = setInterval(() => { if (!document.hidden) loadTokens(); }, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [userEmail]);

  const handleLogout = () => {
    localStorage.removeItem('ms_user');
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('authToken');
    navigate('/login');
  };

  const handleUserMenuClose = () => {
    setUserMenuOpen(false);
  };

  return (
    <AppBar position="sticky" sx={{ zIndex: 30 }}>
      <Toolbar
        sx={{
          height: 64, minHeight: '64px !important',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: { xs: 2, sm: 2 }, gap: 1,
        }}
      >
        {/* Left: Mobile Menu + Logo + Market Status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <IconButton
            aria-label="Open navigation menu"
            onClick={onMenuClick}
            size="medium"
            sx={{ display: { lg: 'none' } }}
          >
            <MenuIcon style={{ width: 20, height: 20 }} />
          </IconButton>

          {/* Mobile logo -- visible only on small screens when sidebar is hidden */}
          <Box sx={{ display: { xs: 'flex', lg: 'none' }, alignItems: 'center', gap: 1 }}>
            <Box sx={{ position: 'relative' }}>
              <Box
                sx={{
                  position: 'absolute', inset: 0, borderRadius: 2,
                  background: 'linear-gradient(to bottom right, rgba(245,158,11,0.25), rgba(249,115,22,0.15))',
                  filter: 'blur(4px)',
                }}
              />
              <Box
                component="img"
                src="/logo.png"
                alt="Money Saarthi"
                sx={{
                  position: 'relative', width: 32, height: 32,
                  objectFit: 'contain', borderRadius: 2,
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
                }}
              />
            </Box>
            <Typography
              sx={{
                fontWeight: 800, fontSize: '0.875rem', letterSpacing: '-0.025em',
                background: 'linear-gradient(to right, #fcd34d, #fdba74, #fbbf24)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}
            >
              Money Saarthi
            </Typography>
          </Box>

          {/* Market Status */}
          <Box
            sx={{
              display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1,
              px: 1.5, py: 0.75, borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Box
              sx={{
                width: 8, height: 8, borderRadius: '50%',
                animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
                bgcolor:
                  marketSession.status === 'open' ? 'success.main'
                  : marketSession.status === 'pre-market' ? 'warning.main'
                  : 'text.disabled',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                },
              }}
            />
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {marketSession.label}
            </Typography>
          </Box>
        </Box>

        {/* Center: Running Ticker Banner */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, flex: 1, minWidth: 0 }}>
          <MarketTicker />
        </Box>

        {/* Right: Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
          {/* Search */}
          <Box sx={{ position: 'relative' }}>
            {searchOpen ? (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 280, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}
              >
                <Input
                  placeholder="Search stocks, tools..."
                  autoFocus
                  onBlur={() => setSearchOpen(false)}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      height: 36, borderRadius: 3,
                      bgcolor: 'action.hover',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
                    },
                  }}
                />
              </motion.div>
            ) : (
              <IconButton
                aria-label="Search stocks and tools"
                onClick={() => setSearchOpen(true)}
                size="small"
                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
              >
                <Search style={{ width: 16, height: 16 }} />
              </IconButton>
            )}
          </Box>

          {/* Theme Toggle */}
          <IconButton
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            size="small"
            sx={{ color: 'text.secondary', '&:hover': { color: '#fbbf24', bgcolor: 'rgba(245,158,11,0.1)' } }}
          >
            {theme === 'dark' ? (
              <Sun style={{ width: 16, height: 16 }} />
            ) : (
              <Moon style={{ width: 16, height: 16 }} />
            )}
          </IconButton>

          {/* Token Balance */}
          {tokenBalance !== null && (
            <Chip
              icon={<Coins style={{ width: 12, height: 12, color: '#a78bfa' }} />}
              label={tokenBalance}
              size="small"
              onClick={() => navigate('/profile')}
              title="AI Tokens"
              sx={{
                display: { xs: 'none', sm: 'flex' },
                height: 26, fontSize: '11px', fontWeight: 700,
                color: '#a78bfa',
                bgcolor: 'rgba(139,92,246,0.1)',
                border: '1px solid rgba(139,92,246,0.2)',
                '&:hover': { bgcolor: 'rgba(139,92,246,0.2)', borderColor: 'rgba(139,92,246,0.3)' },
                cursor: 'pointer',
                '& .MuiChip-icon': { ml: 0.5 },
                '& .MuiChip-label': { px: 0.5 },
              }}
            />
          )}

          {/* Notifications */}
          <IconButton
            aria-label="Notifications"
            size="small"
            sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
          >
            <MuiBadge
              badgeContent={notifications}
              color="error"
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '9px', fontWeight: 700,
                  minWidth: 16, height: 16,
                  boxShadow: (t) => `0 0 0 2px ${t.palette.background.default}`,
                },
              }}
            >
              <Bell style={{ width: 16, height: 16 }} />
            </MuiBadge>
          </IconButton>

          {/* Divider */}
          <Divider orientation="vertical" flexItem sx={{ mx: 0.75, my: 'auto', height: 28, alignSelf: 'center' }} />

          {/* User Menu */}
          <Box>
            <IconButton
              ref={userMenuAnchorRef}
              aria-label="User menu"
              aria-controls={userMenuOpen ? 'user-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={userMenuOpen ? 'true' : undefined}
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              disableRipple
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                pl: 0.25, pr: 0.75, py: 0.25, borderRadius: 3,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              {/* Avatar with ring */}
              <Box sx={{ position: 'relative' }}>
                <MuiAvatar
                  src={photoURL || undefined}
                  alt={user.name || 'User'}
                  sx={{
                    width: 32, height: 32, fontSize: '11px', fontWeight: 700,
                    background: photoURL ? 'transparent' : 'linear-gradient(to bottom right, #10b981, #0d9488)',
                    color: '#fff',
                    border: '2px solid',
                    borderColor: 'rgba(255,255,255,0.1)',
                    transition: 'border-color 0.2s',
                    '.MuiIconButton-root:hover &': { borderColor: 'primary.main' },
                  }}
                >
                  {!photoURL && initials}
                </MuiAvatar>
                {/* Pro indicator dot */}
                {user.subscription?.plan === 'pro' && (
                  <Box
                    sx={{
                      position: 'absolute', bottom: -2, right: -2,
                      width: 14, height: 14, borderRadius: '50%',
                      bgcolor: '#f59e0b',
                      boxShadow: (t) => `0 0 0 2px ${t.palette.background.default}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Crown style={{ width: 8, height: 8, color: '#fff' }} />
                  </Box>
                )}
              </Box>

              {/* Name + badge */}
              <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography
                  sx={{
                    fontSize: '12px', fontWeight: 600, lineHeight: 1.2,
                    maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: 'text.primary', opacity: 0.9,
                  }}
                >
                  {(user.name || 'User').split(' ')[0]}
                </Typography>
                {user.subscription?.plan === 'pro' ? (
                  <Typography
                    sx={{
                      fontSize: '9px', fontWeight: 700, lineHeight: 1.2,
                      color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 0.25,
                    }}
                  >
                    <Crown style={{ width: 8, height: 8 }} /> PRO
                  </Typography>
                ) : (
                  <Typography sx={{ fontSize: '9px', lineHeight: 1.2, color: 'text.secondary' }}>
                    Free
                  </Typography>
                )}
              </Box>
            </IconButton>

            {/* User Dropdown Menu */}
            <MuiMenu
              id="user-menu"
              anchorEl={userMenuAnchorRef.current}
              open={userMenuOpen}
              onClose={handleUserMenuClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{
                paper: {
                  sx: {
                    width: 240, mt: 1, overflow: 'visible',
                    borderRadius: 4,
                  },
                },
              }}
            >
              {/* User card header */}
              <Box
                sx={{
                  p: 2, borderBottom: '1px solid',
                  borderColor: 'divider',
                  background: (t) =>
                    t.palette.mode === 'dark'
                      ? 'linear-gradient(to bottom right, rgba(255,255,255,0.03), transparent)'
                      : 'linear-gradient(to bottom right, rgba(0,0,0,0.02), transparent)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <MuiAvatar
                    src={photoURL || undefined}
                    alt={user.name || 'User'}
                    sx={{
                      width: 40, height: 40, fontSize: '0.875rem', fontWeight: 700,
                      background: photoURL ? 'transparent' : 'linear-gradient(to bottom right, #10b981, #0d9488)',
                      color: '#fff',
                      border: '2px solid',
                      borderColor: 'rgba(255,255,255,0.1)',
                    }}
                  >
                    {!photoURL && initials}
                  </MuiAvatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }} noWrap>
                      {user.name || 'User'}
                    </Typography>
                    <Typography sx={{ fontSize: '11px', color: 'text.secondary' }} noWrap>
                      {user.email || ''}
                    </Typography>
                  </Box>
                </Box>
                {/* Plan badge */}
                {user.subscription?.plan === 'pro' && (
                  <Chip
                    icon={<Crown style={{ width: 12, height: 12, color: '#fbbf24' }} />}
                    label="Pro Member"
                    size="small"
                    sx={{
                      mt: 1.25, height: 24, fontSize: '10px', fontWeight: 700,
                      color: '#fbbf24',
                      bgcolor: 'rgba(245,158,11,0.1)',
                      border: '1px solid rgba(245,158,11,0.2)',
                      '& .MuiChip-icon': { ml: 0.5 },
                    }}
                  />
                )}
                {/* Token balance in dropdown */}
                {tokenBalance !== null && (
                  <Chip
                    icon={<Coins style={{ width: 12, height: 12, color: '#a78bfa' }} />}
                    label={`${tokenBalance} AI Tokens`}
                    size="small"
                    sx={{
                      mt: 1, height: 24, fontSize: '10px', fontWeight: 700,
                      color: '#a78bfa',
                      bgcolor: 'rgba(139,92,246,0.1)',
                      border: '1px solid rgba(139,92,246,0.2)',
                      '& .MuiChip-icon': { ml: 0.5 },
                    }}
                  />
                )}
              </Box>

              {/* Menu items */}
              <Box sx={{ py: 0.75 }}>
                <MuiMenuItem
                  onClick={() => { handleUserMenuClose(); navigate('/profile'); }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <User style={{ width: 16, height: 16 }} />
                  </ListItemIcon>
                  <ListItemText primaryTypographyProps={{ fontSize: '0.875rem' }}>
                    Profile &amp; Tokens
                  </ListItemText>
                </MuiMenuItem>
                <MuiMenuItem
                  onClick={() => { handleUserMenuClose(); navigate('/settings'); }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Settings style={{ width: 16, height: 16 }} />
                  </ListItemIcon>
                  <ListItemText primaryTypographyProps={{ fontSize: '0.875rem' }}>
                    Settings
                  </ListItemText>
                </MuiMenuItem>

                <Divider sx={{ my: 0.5 }} />

                <MuiMenuItem
                  onClick={() => { handleUserMenuClose(); handleLogout(); }}
                  sx={{ color: 'error.main' }}
                >
                  <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
                    <LogOut style={{ width: 16, height: 16 }} />
                  </ListItemIcon>
                  <ListItemText primaryTypographyProps={{ fontSize: '0.875rem' }}>
                    Logout
                  </ListItemText>
                </MuiMenuItem>
              </Box>
            </MuiMenu>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
