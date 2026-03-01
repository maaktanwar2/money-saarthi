// Page Layout Component - Main layout wrapper (MUI)
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import { useTheme } from '@mui/material/styles';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { storage } from '../lib/utils';

export const PageLayout = ({ children }) => {
  const theme = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => storage.get('sidebarCollapsed', false)
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync sidebar state via custom event (no polling)
  useEffect(() => {
    const handleStorageChange = () => {
      setSidebarCollapsed(storage.get('sidebarCollapsed', false));
    };
    const handleSidebarToggle = (e) => {
      setSidebarCollapsed(e.detail.collapsed);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('sidebarToggle', handleSidebarToggle);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sidebarToggle', handleSidebarToggle);
    };
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Sidebar - Desktop */}
      <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
        <Sidebar />
      </Box>

      {/* Mobile Menu Overlay - MUI Drawer (temporary) */}
      <Drawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        variant="temporary"
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { lg: 'none' },
          '& .MuiDrawer-paper': {
            width: 256,
          },
        }}
      >
        <Sidebar />
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          minHeight: '100vh',
          transition: theme.transitions.create(['padding-left'], {
            duration: theme.transitions.duration.standard,
          }),
          pl: { xs: 0, lg: sidebarCollapsed ? '72px' : '256px' },
        }}
      >
        <Header onMenuClick={() => setMobileMenuOpen(true)} />

        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

// Page Header Component
export const PageHeader = ({
  title,
  description,
  icon: Icon,
  badge,
  accuracy,
  trades,
  actions,
  breadcrumbs = [],
}) => {
  const theme = useTheme();

  // Map badge text to color config
  const getBadgeProps = (badgeText) => {
    switch (badgeText) {
      case 'AI':
        return {
          sx: {
            bgcolor: 'rgba(139,92,246,0.2)',
            color: theme.palette.mode === 'dark' ? '#a78bfa' : '#7c3aed',
            fontWeight: 700,
            fontSize: '0.75rem',
          },
        };
      case 'Pro':
        return {
          sx: {
            bgcolor: 'rgba(245,158,11,0.2)',
            color: theme.palette.mode === 'dark' ? '#fbbf24' : '#d97706',
            fontWeight: 700,
            fontSize: '0.75rem',
          },
        };
      case 'New':
        return {
          color: 'primary',
          sx: { fontWeight: 700, fontSize: '0.75rem' },
        };
      default:
        return {
          color: 'default',
          sx: { fontWeight: 700, fontSize: '0.75rem' },
        };
    }
  };

  // Accuracy dot color
  const getAccuracyColor = (val) => {
    if (val >= 70) return theme.palette.success.main;
    if (val >= 50) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  return (
    <Box sx={{ mb: 2.5 }}>
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator="/"
          sx={{
            mb: 1.5,
            '& .MuiBreadcrumbs-separator': {
              color: 'text.secondary',
              fontSize: '0.75rem',
            },
          }}
        >
          {breadcrumbs.map((crumb, i) =>
            crumb.link ? (
              <Link
                key={i}
                href={crumb.link}
                underline="hover"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.75rem',
                  '&:hover': { color: 'text.primary' },
                }}
              >
                {crumb.label}
              </Link>
            ) : (
              <Typography
                key={i}
                sx={{ color: 'text.primary', fontSize: '0.75rem' }}
              >
                {crumb.label}
              </Typography>
            )
          )}
        </Breadcrumbs>
      )}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'center' }}
        justifyContent="space-between"
        spacing={1.5}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            {Icon && (
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  bgcolor: (t) => `${t.palette.primary.main}1A`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon
                  size={18}
                  color={theme.palette.primary.main}
                />
              </Box>
            )}
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            {badge && (
              <Chip
                label={badge}
                size="small"
                variant="filled"
                {...getBadgeProps(badge)}
              />
            )}
          </Stack>
          {description && (
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', mt: 0.25 }}
            >
              {description}
            </Typography>
          )}

          {/* Accuracy Stats */}
          {(accuracy !== undefined || trades !== undefined) && (
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 1 }}>
              {accuracy !== undefined && (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: getAccuracyColor(accuracy),
                    }}
                  />
                  <Typography variant="body2">
                    <Box component="span" sx={{ fontWeight: 600 }}>
                      {accuracy}%
                    </Box>
                    <Box component="span" sx={{ color: 'text.secondary', ml: 0.5 }}>
                      Accuracy
                    </Box>
                  </Typography>
                </Stack>
              )}
              {trades !== undefined && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {trades.toLocaleString()} backtested trades
                </Typography>
              )}
            </Stack>
          )}
        </Box>

        {actions && (
          <Stack direction="row" alignItems="center" spacing={1}>
            {actions}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

// Section Component
export const Section = ({ title, description, children, className, action }) => (
  <Box
    component="section"
    className={className}
    sx={{ mb: 2.5 }}
  >
    {(title || action) && (
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
      >
        <Box>
          {title && (
            <Typography
              variant="subtitle1"
              component="h2"
              sx={{ fontWeight: 600, fontSize: '1rem' }}
            >
              {title}
            </Typography>
          )}
          {description && (
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', mt: 0.25, display: 'block' }}
            >
              {description}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
    )}
    {children}
  </Box>
);

export default PageLayout;
