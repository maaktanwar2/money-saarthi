// Mobile Bottom Navigation - MUI BottomNavigation for mobile devices
import { useLocation, useNavigate } from 'react-router-dom';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import {
  LayoutDashboard,
  Star,
  LineChart,
  Activity,
  Menu,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Home', icon: LayoutDashboard, path: '/' },
  { label: 'Watchlist', icon: Star, path: '/watchlist' },
  { label: 'Options', icon: LineChart, path: '/options' },
  { label: 'Market', icon: Activity, path: '/market' },
];

const MobileNav = ({ onMoreClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();

  // Determine the active nav index based on current path
  const activeIndex = NAV_ITEMS.findIndex((item) =>
    item.path === '/'
      ? location.pathname === '/' || location.pathname === '/dashboard'
      : location.pathname.startsWith(item.path)
  );

  const handleChange = (_event, newValue) => {
    // Last index (4) is the "More" button
    if (newValue === NAV_ITEMS.length) {
      onMoreClick?.();
      return;
    }
    const target = NAV_ITEMS[newValue];
    if (target) {
      navigate(target.path);
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: theme.zIndex.appBar + 10,
        display: { lg: 'none' },
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      <BottomNavigation
        value={activeIndex >= 0 ? activeIndex : false}
        onChange={handleChange}
        showLabels
      >
        {NAV_ITEMS.map((item) => (
          <BottomNavigationAction
            key={item.path}
            label={item.label}
            icon={<item.icon size={20} />}
          />
        ))}
        <BottomNavigationAction
          label="More"
          icon={<Menu size={20} />}
          sx={{
            // More button never appears selected
            '&.Mui-selected': {
              color: theme.palette.text.secondary,
            },
          }}
        />
      </BottomNavigation>
    </Box>
  );
};

export default MobileNav;
