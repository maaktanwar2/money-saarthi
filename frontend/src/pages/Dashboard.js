// Dashboard - Main home page with market overview
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, Sparkles, Sun, Moon, CloudSun, Lock, Crown, ArrowRight } from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { useTheme, alpha } from '@mui/material/styles';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { PageLayout, Section } from '../components/PageLayout';
import { Card, Badge, Button } from '../components/ui';
import { getMarketSession } from '../lib/utils';

// Sub-components (extracted)
import MarketOverview from '../components/dashboard/MarketOverview';
import MarketPulseCards from '../components/dashboard/MarketPulseCards';
import AdvanceDeclineBar from '../components/dashboard/AdvanceDeclineBar';
import SectorPerformance from '../components/dashboard/SectorPerformance';
import OIScans from '../components/dashboard/OIScans';
import MarketHeatmap from '../components/dashboard/MarketHeatmap';
import FIIDIIData from '../components/dashboard/FIIDIIData';

// Get user's first name from localStorage
const getUserFirstName = () => {
  try {
    const stored = localStorage.getItem('ms_user');
    if (stored) {
      const user = JSON.parse(stored);
      const name = user?.name || user?.displayName || '';
      return name.split(' ')[0] || 'Trader';
    }
  } catch (e) {}
  return 'Trader';
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good Morning', icon: Sun, gradient: 'linear-gradient(to right, #fbbf24, #f97316)' };
  if (h < 17) return { text: 'Good Afternoon', icon: CloudSun, gradient: 'linear-gradient(to right, #38bdf8, #3b82f6)' };
  return { text: 'Good Evening', icon: Moon, gradient: 'linear-gradient(to right, #818cf8, #8b5cf6)' };
};

// Check if current user has active pro subscription
const hasProAccess = () => {
  try {
    const user = JSON.parse(localStorage.getItem('ms_user') || '{}');
    if (user.isAdmin) return true;
    const sub = user.subscription;
    if (!sub || sub.plan !== 'pro' || sub.status !== 'active') return false;
    if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) return false;
    return true;
  } catch { return false; }
};

// Locked section overlay for non-pro users
const LockedOverlay = ({ label, navigate }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 3,
        bgcolor: alpha('#000', 0.4),
        backdropFilter: 'blur(2px)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ textAlign: 'center' }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.3)}, ${alpha(theme.palette.primary.main, 0.3)})`,
            border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 1,
            boxShadow: `0 4px 14px ${alpha(theme.palette.warning.main, 0.1)}`,
          }}
        >
          <Lock style={{ width: 16, height: 16, color: theme.palette.warning.light }} />
        </Box>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff', mb: 0.5 }}>
          {label}
        </Typography>
        <Box
          component="button"
          onClick={() => navigate('/pricing')}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.5,
            py: 0.75,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.9),
            '&:hover': { bgcolor: 'primary.main' },
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.2)}`,
          }}
        >
          <Crown style={{ width: 12, height: 12 }} />
          Unlock Pro
          <ArrowRight style={{ width: 12, height: 12 }} />
        </Box>
      </motion.div>
    </Box>
  );
};

// Wrapper that blurs content and shows lock for non-pro users
const ProSection = ({ children, isPro, label, navigate }) => {
  if (isPro) return children;
  return (
    <Box sx={{ position: 'relative' }}>
      <Box aria-hidden="true" sx={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }}>
        {children}
      </Box>
      <LockedOverlay label={label} navigate={navigate} />
    </Box>
  );
};

const Dashboard = () => {
  const theme = useTheme();
  const marketSession = getMarketSession();
  const seo = getSeoConfig('/dashboard');
  const navigate = useNavigate();
  const isPro = hasProAccess();

  const greeting = getGreeting();
  const GreetIcon = greeting.icon;
  const firstName = getUserFirstName();

  const getMarketStatusSx = () => {
    if (marketSession.status === 'open') {
      return {
        borderColor: alpha(theme.palette.success.main, 0.3),
        bgcolor: alpha(theme.palette.success.main, 0.1),
        color: theme.palette.success.light,
        dotBg: theme.palette.success.light,
        pulse: true,
      };
    }
    if (marketSession.status === 'pre-market') {
      return {
        borderColor: alpha(theme.palette.warning.main, 0.3),
        bgcolor: alpha(theme.palette.warning.main, 0.1),
        color: theme.palette.warning.light,
        dotBg: theme.palette.warning.light,
        pulse: true,
      };
    }
    return {
      borderColor: alpha(theme.palette.divider, 0.5),
      bgcolor: alpha(theme.palette.text.primary, 0.03),
      color: theme.palette.text.secondary,
      dotBg: theme.palette.text.secondary,
      pulse: false,
    };
  };

  const mStatus = getMarketStatusSx();

  return (
    <PageLayout>
      <SEO title={seo.title} description={seo.description} keywords={seo.keywords} path="/dashboard" jsonLd={seo.jsonLd} />

      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <Box
          sx={{
            position: 'relative',
            mb: 2.5,
            borderRadius: 3,
            border: 1,
            borderColor: alpha(theme.palette.divider, 0.4),
            background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)}, ${alpha(theme.palette.background.paper, 0.5)})`,
            backdropFilter: 'blur(8px)',
            overflow: 'hidden',
            p: 1.75,
          }}
        >
          {/* Accent strip */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: greeting.gradient,
            }}
          />
          {/* Background glow */}
          <Box
            sx={{
              position: 'absolute',
              top: -64,
              right: -64,
              width: 192,
              height: 192,
              borderRadius: '50%',
              filter: 'blur(48px)',
              opacity: 0.06,
              pointerEvents: 'none',
              bgcolor: 'primary.main',
            }}
          />

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            gap={2}
            sx={{ position: 'relative' }}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              {/* Greeting icon */}
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: greeting.gradient,
                  boxShadow: 3,
                }}
              >
                <GreetIcon style={{ width: 20, height: 20, color: '#fff' }} />
              </Box>

              <Box>
                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                  <Typography sx={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.025em' }}>
                    {greeting.text},
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '1.125rem',
                      fontWeight: 800,
                      letterSpacing: '-0.025em',
                      background: 'linear-gradient(to right, #fcd34d, #fdba74, #fcd34d)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {firstName}
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                  Here's your market snapshot for today
                </Typography>
              </Box>
            </Stack>

            {/* Market status pill */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.75,
                borderRadius: 50,
                border: 1,
                borderColor: mStatus.borderColor,
                bgcolor: mStatus.bgcolor,
                color: mStatus.color,
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: mStatus.dotBg,
                  ...(mStatus.pulse && {
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.5 },
                    },
                  }),
                }}
              />
              {marketSession.label}
            </Box>
          </Stack>
        </Box>
      </motion.div>

      {/* Market Overview */}
      <Section title="Market Overview">
        <MarketOverview />
      </Section>

      {/* Market Pulse -- PCR, IV, Basis, Rollover */}
      <Section title="Market Pulse" description="Key derivatives indicators at a glance">
        <ProSection isPro={isPro} label="Market Pulse" navigate={navigate}>
          <MarketPulseCards />
        </ProSection>
      </Section>

      {/* Advance-Decline Breadth */}
      <Section title="Market Breadth">
        <ProSection isPro={isPro} label="Market Breadth" navigate={navigate}>
          <AdvanceDeclineBar />
        </ProSection>
      </Section>

      {/* Sector Performance */}
      <Section
        title="Sector Performance"
        description="Click any sector to see its top stocks — momentum movers & healthy pullbacks"
      >
        <ProSection isPro={isPro} label="Sector Performance" navigate={navigate}>
          <SectorPerformance />
        </ProSection>
      </Section>

      {/* OI Scans -- OI Up + OI Down */}
      <Section
        title="OI Scans"
        description="Top stocks by Open Interest change — buildup & unwinding"
      >
        <ProSection isPro={isPro} label="OI Scans" navigate={navigate}>
          <OIScans />
        </ProSection>
      </Section>

      {/* Market Heatmap */}
      <Section
        title="Market Heatmap"
        description="F&O stocks treemap — size by impact, color by change"
      >
        <ProSection isPro={isPro} label="Market Heatmap" navigate={navigate}>
          <MarketHeatmap />
        </ProSection>
      </Section>

      {/* FII/DII Data */}
      <Section title="FII / DII Activity" description="Institutional money flow — foreign & domestic">
        <ProSection isPro={isPro} label="FII / DII Activity" navigate={navigate}>
          <FIIDIIData />
        </ProSection>
      </Section>

      {/* AI Advisor CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Box sx={{ mt: 2.5 }}>
          <Card
            sx={{
              p: 2,
              background: `linear-gradient(to right, ${alpha(theme.palette.secondary.main, 0.1)}, ${alpha(theme.palette.primary.main, 0.1)})`,
              borderColor: alpha(theme.palette.secondary.main, 0.2),
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems="center"
              justifyContent="space-between"
              spacing={2}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 3,
                    bgcolor: alpha(theme.palette.secondary.main, 0.2),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Brain style={{ width: 20, height: 20, color: theme.palette.secondary.light }} />
                </Box>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 600 }}>
                      AI Trade Advisor
                    </Typography>
                    <Badge
                      variant="default"
                      sx={{
                        bgcolor: alpha(theme.palette.secondary.main, 0.2),
                        color: theme.palette.secondary.light,
                        borderColor: alpha(theme.palette.secondary.main, 0.3),
                      }}
                    >
                      AI
                    </Badge>
                  </Stack>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Get AI-powered recommendations based on your trades and market sentiment
                  </Typography>
                </Box>
              </Stack>
              <Link to="/algo">
                <Button variant="gradient" sx={{ whiteSpace: 'nowrap' }}>
                  <Sparkles style={{ width: 16, height: 16, marginRight: 8 }} />
                  Open Advisor
                </Button>
              </Link>
            </Stack>
          </Card>
        </Box>
      </motion.div>
    </PageLayout>
  );
};

export default Dashboard;
