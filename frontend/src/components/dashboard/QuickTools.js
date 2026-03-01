// Dashboard — Quick Tools Navigation Grid
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ScanSearch, LineChart, Brain, Zap, Activity, BarChart3,
  ChevronRight, Target
} from 'lucide-react';
import { Card, Badge } from '../ui';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme, alpha } from '@mui/material/styles';

const QUICK_TOOLS = [
  {
    id: 'scanners',
    title: 'Stock Scanners',
    description: '15+ pre-built scanners for gainers, breakouts, momentum',
    icon: ScanSearch,
    path: '/scanners',
    color: 'success',
  },
  {
    id: 'options',
    title: 'Options Lab',
    description: 'Chain analysis, Greeks, OI analytics, payoff charts',
    icon: LineChart,
    path: '/options',
    color: 'info',
    badge: 'Pro',
  },
  {
    id: 'advisor',
    title: 'AI Agent',
    description: 'Autonomous AI trading agent with OODA cycle',
    icon: Brain,
    path: '/ai-agent',
    color: 'secondary',
    badge: 'AI',
  },
  {
    id: 'signals',
    title: 'Trade Signals',
    description: 'AI-generated buy/sell signals with confidence scores',
    icon: Zap,
    path: '/signals',
    color: 'warning',
  },
  {
    id: 'market',
    title: 'Market Pulse',
    description: 'FII/DII flows, sector performance, market breadth',
    icon: Activity,
    path: '/market',
    color: 'primary',
  },
  {
    id: 'backtest',
    title: 'Backtesting',
    description: 'Test your strategies against historical data',
    icon: BarChart3,
    path: '/backtest',
    color: 'error',
  },
];

const QuickTools = () => {
  const theme = useTheme();

  const getToolColor = (colorKey) => {
    const paletteColor = theme.palette[colorKey];
    return paletteColor?.main || theme.palette.primary.main;
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
        gap: 2,
      }}
    >
      {QUICK_TOOLS.map((tool, i) => {
        const toolColor = getToolColor(tool.color);

        return (
          <motion.div
            key={tool.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
          >
            <Box
              component={Link}
              to={tool.path}
              sx={{ textDecoration: 'none', display: 'block' }}
            >
              <Card
                sx={{
                  p: 2.5,
                  height: '100%',
                  transition: 'all 0.3s',
                  '&:hover': {
                    borderColor: (t) => alpha(t.palette.primary.main, 0.3),
                    boxShadow: (t) => `0 8px 24px ${alpha(t.palette.primary.main, 0.05)}`,
                  },
                  '&:hover .tool-title': {
                    color: 'primary.main',
                  },
                  '&:hover .tool-cta': {
                    opacity: 1,
                  },
                  '&:hover .tool-chevron': {
                    transform: 'translateX(4px)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: alpha(toolColor, 0.15),
                      color: toolColor,
                    }}
                  >
                    <tool.icon style={{ width: 24, height: 24 }} />
                  </Box>
                  {tool.badge && (
                    <Badge variant={tool.badge === 'AI' ? 'default' : 'warning'}>
                      {tool.badge}
                    </Badge>
                  )}
                </Box>

                <Typography
                  className="tool-title"
                  sx={{
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    mb: 0.5,
                    transition: 'color 0.2s',
                    color: 'text.primary',
                  }}
                >
                  {tool.title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.875rem',
                    color: 'text.secondary',
                    mb: 1.5,
                  }}
                >
                  {tool.description}
                </Typography>

                {tool.accuracy && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: '0.75rem' }}>
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Target style={{ width: 12, height: 12, color: theme.palette.primary.main }} />
                      <Typography component="span" sx={{ fontWeight: 600, color: 'primary.main', fontSize: '0.75rem' }}>
                        {tool.accuracy}%
                      </Typography>
                      <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                        accuracy
                      </Typography>
                    </Box>
                    <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                      {tool.trades?.toLocaleString()} trades
                    </Typography>
                  </Box>
                )}

                <Box
                  className="tool-cta"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '0.875rem',
                    color: 'primary.main',
                    mt: 2,
                    opacity: 0,
                    transition: 'opacity 0.2s',
                  }}
                >
                  <Typography component="span" sx={{ fontSize: '0.875rem', color: 'inherit' }}>
                    Open Tool
                  </Typography>
                  <ChevronRight
                    className="tool-chevron"
                    style={{
                      width: 16,
                      height: 16,
                      marginLeft: 4,
                      transition: 'transform 0.2s',
                    }}
                  />
                </Box>
              </Card>
            </Box>
          </motion.div>
        );
      })}
    </Box>
  );
};

export default QuickTools;
