// Sidebar Component - MUI-based professional navigation sidebar
import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import { useTheme as useMuiTheme, alpha } from '@mui/material/styles';
import {
  LayoutDashboard,
  ScanSearch,
  LineChart,
  TrendingUp,
  Activity,
  Calculator,
  Brain,
  Settings,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Target,
  Zap,
  BookOpen,
  Users,
  User,
  Shield,
  Crown,
  Lock,
  Sparkles,
  Bot,
  Coins,
  Layers,
  Star,
} from 'lucide-react';
import { storage, isAdmin as isAdminCheck } from '../lib/utils';

// Check if user has pro access
const checkProAccess = () => {
  try {
    const user = JSON.parse(localStorage.getItem('ms_user') || '{}');
    if (user.isAdmin) return true;
    const sub = user.subscription;
    if (!sub || sub.plan !== 'pro' || sub.status !== 'active') return false;
    if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) return false;
    return true;
  } catch {
    return false;
  }
};

// Navigation Items grouped by section
const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
      { id: 'scanners', label: 'Scanners', icon: ScanSearch, path: '/signals', badge: '15+', badgeColor: 'emerald', description: 'Stock screeners & filters' },
    ],
  },
  {
    label: 'Markets',
    items: [
      { id: 'options', label: 'Options Lab', icon: LineChart, path: '/options', badge: 'Pro', isPro: true, description: 'Options chain & analytics' },
      { id: 'market', label: 'Market Pulse', icon: Activity, path: '/market', badge: 'Pro', isPro: true, description: 'FII/DII, sectors, breadth' },
      { id: 'sectors', label: 'Sectors', icon: Layers, path: '/sectors', badge: 'Pro', isPro: true, description: 'Sectoral indices & stocks by sector' },
    ],
  },
  {
    label: 'AI & Automation',
    items: [
      { id: 'ai-agent', label: 'AI Agent', icon: Brain, path: '/ai-agent', badge: 'New', badgeColor: 'cyan', isPro: true, description: 'Self-thinking autonomous trading' },
      { id: 'algo', label: 'Algo Trading', icon: Bot, path: '/algo', badge: 'Live', badgeColor: 'live', isPro: true, description: 'AI bots that trade for you' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { id: 'ltp-calculator', label: 'LTP Calculator', icon: Target, path: '/ltp-calculator', badge: 'New', badgeColor: 'cyan', description: 'P&L, Option Chain, COA Analysis' },
      { id: 'trade-finder', label: 'Trade Finder', icon: Zap, path: '/trade-finder', badge: 'New', badgeColor: 'cyan', description: 'Auto strategy suggestions from OI data' },
      { id: 'calculators', label: 'Calculators', icon: Calculator, path: '/calculators' },
      { id: 'journal', label: 'Trade Journal', icon: BookOpen, path: '/journal', badge: 'Pro', isPro: true },
      { id: 'backtest', label: 'Backtesting', icon: BarChart3, path: '/backtest', badge: 'Pro', isPro: true, description: 'Strategy backtesting' },
      { id: 'watchlist', label: 'Watchlist', icon: Star, path: '/watchlist', description: 'Track favorite stocks' },
    ],
  },
];

const BOTTOM_ITEMS = [
  { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

const isUserAdmin = () => {
  try {
    const stored = localStorage.getItem('ms_user');
    if (stored) {
      const user = JSON.parse(stored);
      return isAdminCheck(user?.email);
    }
  } catch (e) {}
  return false;
};

// Badge style helper
const getBadgeStyles = (item, isLocked, theme) => {
  if (item.badge === 'Pro' && isLocked) {
    return { bgcolor: alpha('#f59e0b', 0.15), color: '#fbbf24', borderColor: alpha('#f59e0b', 0.25) };
  }
  if (item.badge === 'Pro' && !isLocked) {
    return { bgcolor: alpha(theme.palette.success.main, 0.15), color: theme.palette.success.light, borderColor: alpha(theme.palette.success.main, 0.25) };
  }
  if (item.badgeColor === 'cyan') {
    return { bgcolor: alpha('#06b6d4', 0.15), color: '#22d3ee', borderColor: alpha('#06b6d4', 0.25) };
  }
  if (item.badgeColor === 'emerald') {
    return { bgcolor: alpha(theme.palette.success.main, 0.15), color: theme.palette.success.light, borderColor: alpha(theme.palette.success.main, 0.25) };
  }
  if (item.badgeColor === 'live') {
    return { bgcolor: alpha('#22c55e', 0.15), color: '#4ade80', borderColor: alpha('#22c55e', 0.25) };
  }
  return {};
};

// NavItem Component
const NavItem = ({ item, collapsed, hasPro }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useMuiTheme();
  const isActive = location.pathname === item.path ||
    (item.path !== '/' && location.pathname.startsWith(item.path));
  const isLocked = item.isPro && !hasPro;

  const handleClick = (e) => {
    if (isLocked) {
      e.preventDefault();
      navigate('/pricing');
    }
  };

  const badgeStyles = item.badge ? getBadgeStyles(item, isLocked, theme) : null;

  const buttonContent = (
    <ListItemButton
      component={NavLink}
      to={item.path}
      onClick={handleClick}
      selected={isActive && !isLocked}
      sx={{
        borderRadius: 2,
        py: 0.75,
        px: 1.25,
        minHeight: 38,
        mb: 0.25,
        opacity: isLocked ? 0.6 : 1,
        position: 'relative',
        '&.Mui-selected': {
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.15) },
        },
        '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.04) },
      }}
    >
      {/* Active Indicator */}
      {isActive && !isLocked && (
        <motion.div
          layoutId="activeIndicator"
          style={{
            position: 'absolute',
            left: 0,
            width: 3,
            height: 20,
            borderRadius: 4,
            background: `linear-gradient(to bottom, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.main, 0.6)})`,
            boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.3)}`,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}

      {/* Icon */}
      <ListItemIcon sx={{ minWidth: collapsed ? 'auto' : 36 }}>
        <Box sx={{
          width: 28,
          height: 28,
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: isActive ? alpha(theme.palette.primary.main, 0.15) : 'transparent',
          transition: 'all 0.2s',
        }}>
          <item.icon
            size={16}
            style={{ color: isActive ? theme.palette.primary.main : theme.palette.text.secondary }}
          />
        </Box>
      </ListItemIcon>

      {/* Label + Badge */}
      {!collapsed && (
        <>
          <Typography
            variant="body2"
            sx={{
              fontWeight: isActive ? 600 : 500,
              fontSize: '0.8125rem',
              color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              flex: 1,
            }}
          >
            {item.label}
          </Typography>

          {item.badge && (
            <Chip
              size="small"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {isLocked && <Lock size={10} />}
                  {item.badgeColor === 'live' && (
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#4ade80', boxShadow: '0 0 4px rgba(74,222,128,0.5)' }} />
                  )}
                  {item.badge}
                </Box>
              }
              variant="outlined"
              sx={{
                height: 20,
                fontSize: '0.625rem',
                fontWeight: 700,
                borderRadius: 1.5,
                ...badgeStyles,
                ...(item.badgeColor === 'live' && { animation: 'pulse 2s infinite' }),
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.7 },
                },
              }}
            />
          )}
        </>
      )}
    </ListItemButton>
  );

  // Wrap with Tooltip when collapsed
  if (collapsed) {
    return (
      <Tooltip
        title={
          <Box sx={{ p: 0.5 }}>
            <Typography variant="body2" fontWeight={600}>{item.label}</Typography>
            {item.description && (
              <Typography variant="caption" color="text.secondary">{item.description}</Typography>
            )}
          </Box>
        }
        placement="right"
        arrow
      >
        {buttonContent}
      </Tooltip>
    );
  }

  return buttonContent;
};

// Main Sidebar Component
export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(() => storage.get('sidebarCollapsed', false));
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasPro, setHasPro] = useState(false);
  const navigate = useNavigate();
  const theme = useMuiTheme();

  useEffect(() => {
    storage.set('sidebarCollapsed', collapsed);
    window.dispatchEvent(new CustomEvent('sidebarToggle', { detail: { collapsed } }));
  }, [collapsed]);

  useEffect(() => {
    const updateStatus = () => {
      setIsAdmin(isUserAdmin());
      setHasPro(checkProAccess());
    };

    updateStatus();

    window.addEventListener('storage', updateStatus);
    const interval = setInterval(() => { if (!document.hidden) updateStatus(); }, 60000);

    return () => {
      window.removeEventListener('storage', updateStatus);
      clearInterval(interval);
    };
  }, []);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        height: '100vh',
        zIndex: theme.zIndex.drawer,
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid ${theme.palette.divider}`,
        backgroundColor: alpha(theme.palette.background.default, 0.8),
        backdropFilter: 'blur(20px) saturate(180%)',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <Box sx={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        borderBottom: 1,
        borderColor: 'divider',
        flexShrink: 0,
      }}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <Box sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: 2.5,
              background: 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(249,115,22,0.2))',
              filter: 'blur(8px)',
              opacity: 0.6,
            }} />
            <img
              src="/logo.png"
              alt="Money Saarthi"
              style={{
                position: 'relative',
                width: 40,
                height: 40,
                objectFit: 'contain',
                borderRadius: 12,
                border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
              }}
            />
          </Box>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                style={{ overflow: 'hidden' }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 800,
                    fontSize: '1rem',
                    lineHeight: 1.2,
                    background: 'linear-gradient(to right, #fcd34d, #fb923c, #fcd34d)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Money Saarthi
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                  <Chip
                    label="AI"
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: '0.5625rem',
                      fontWeight: 700,
                      bgcolor: alpha('#8b5cf6', 0.15),
                      color: '#a78bfa',
                      border: `1px solid ${alpha('#8b5cf6', 0.2)}`,
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem', fontWeight: 500 }}>
                    Market Intelligence
                  </Typography>
                </Box>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
      </Box>

      {/* Navigation */}
      <Box sx={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        py: 1,
        px: 1.25,
        '&::-webkit-scrollbar': { width: 3 },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': {
          background: alpha(theme.palette.text.primary, 0.08),
          borderRadius: 10,
        },
      }}>
        <List disablePadding>
          {NAV_SECTIONS.map((section, sIdx) => (
            <Box key={sIdx}>
              {section.label && !collapsed && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 2, pb: 0.5, px: 1.25 }}>
                  <Typography
                    variant="overline"
                    sx={{
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      color: alpha(theme.palette.text.secondary, 0.5),
                      letterSpacing: '0.1em',
                    }}
                  >
                    {section.label}
                  </Typography>
                  <Box sx={{ flex: 1, height: '1px', bgcolor: alpha(theme.palette.divider, 0.5) }} />
                </Box>
              )}
              {section.label && collapsed && (
                <Divider sx={{ my: 1, mx: 1.5 }} />
              )}
              {section.items.map((item) => (
                <NavItem key={item.id} item={item} collapsed={collapsed} hasPro={hasPro} />
              ))}
            </Box>
          ))}
        </List>

        {/* Upgrade CTA */}
        {!hasPro && !collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: 16, marginLeft: 4, marginRight: 4 }}
          >
            <Paper
              elevation={0}
              onClick={() => navigate('/pricing')}
              sx={{
                p: 2,
                borderRadius: 3,
                cursor: 'pointer',
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)}, ${alpha('#f59e0b', 0.1)}, ${alpha(theme.palette.primary.main, 0.2)})`,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.5) },
                transition: 'all 0.2s',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Box sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.2),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Crown size={16} style={{ color: theme.palette.primary.main }} />
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={600}>Upgrade to Pro</Typography>
                  <Typography variant="caption" color="text.secondary">₹899/mo or ₹4,999/yr</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: theme.palette.primary.main }}>
                <Sparkles size={12} />
                <Typography variant="caption" fontWeight={500}>Unlock all features</Typography>
              </Box>
            </Paper>
          </motion.div>
        )}

        {/* Pro Badge */}
        {hasPro && !isAdmin && !collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: 16, marginLeft: 4, marginRight: 4 }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: 3,
                background: `linear-gradient(135deg, ${alpha('#22c55e', 0.1)}, ${alpha(theme.palette.success.main, 0.1)})`,
                border: `1px solid ${alpha('#22c55e', 0.3)}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Crown size={16} style={{ color: theme.palette.success.main }} />
                <Typography variant="body2" fontWeight={500} sx={{ color: theme.palette.success.main }}>
                  Pro Member
                </Typography>
              </Box>
            </Paper>
          </motion.div>
        )}
      </Box>

      {/* Bottom Section */}
      <Box sx={{ borderTop: 1, borderColor: 'divider', py: 1, px: 1.25, flexShrink: 0 }}>
        <List disablePadding>
          {BOTTOM_ITEMS.map((item) => (
            <NavItem key={item.id} item={item} collapsed={collapsed} />
          ))}

          {/* Collapse Button */}
          <Tooltip title={collapsed ? 'Expand' : ''} placement="right" arrow disableHoverListener={!collapsed}>
            <ListItemButton
              onClick={() => setCollapsed(!collapsed)}
              sx={{
                borderRadius: 2,
                py: 0.75,
                px: 1.25,
                minHeight: 38,
                color: theme.palette.text.secondary,
                '&:hover': {
                  color: theme.palette.text.primary,
                  bgcolor: alpha(theme.palette.text.primary, 0.04),
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? 'auto' : 36 }}>
                <Box sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </Box>
              </ListItemIcon>
              {!collapsed && (
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8125rem' }}>
                  Collapse
                </Typography>
              )}
            </ListItemButton>
          </Tooltip>
        </List>
      </Box>
    </motion.aside>
  );
};

export default Sidebar;
