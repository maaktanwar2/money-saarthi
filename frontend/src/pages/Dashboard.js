// Dashboard - Main home page with market overview
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, Sparkles, Sun, Moon, CloudSun, Lock, Crown, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { PageLayout, Section } from '../components/PageLayout';
import { Card, Badge, Button } from '../components/ui';
import { cn, getMarketSession } from '../lib/utils';

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
  if (h < 12) return { text: 'Good Morning', icon: Sun, color: 'from-amber-400 to-orange-400' };
  if (h < 17) return { text: 'Good Afternoon', icon: CloudSun, color: 'from-sky-400 to-blue-400' };
  return { text: 'Good Evening', icon: Moon, color: 'from-indigo-400 to-violet-400' };
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
const LockedOverlay = ({ label, navigate }) => (
  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-[2px]">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center"
    >
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/30 to-primary/30 border border-amber-500/30 flex items-center justify-center mx-auto mb-2 shadow-lg shadow-amber-500/10">
        <Lock className="w-4 h-4 text-amber-400" />
      </div>
      <p className="text-sm font-semibold text-white mb-1">{label}</p>
      <button
        onClick={() => navigate('/pricing')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/90 hover:bg-primary text-white text-xs font-semibold transition-all shadow-lg shadow-primary/20"
      >
        <Crown className="w-3 h-3" />
        Unlock Pro
        <ArrowRight className="w-3 h-3" />
      </button>
    </motion.div>
  </div>
);

// Wrapper that blurs content and shows lock for non-pro users
const ProSection = ({ children, isPro, label, navigate }) => {
  if (isPro) return children;
  return (
    <div className="relative">
      <div className="filter blur-[6px] pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>
      <LockedOverlay label={label} navigate={navigate} />
    </div>
  );
};

const Dashboard = () => {
  const marketSession = getMarketSession();
  const seo = getSeoConfig('/dashboard');
  const navigate = useNavigate();
  const isPro = hasProAccess();

  const greeting = getGreeting();
  const GreetIcon = greeting.icon;
  const firstName = getUserFirstName();

  return (
    <PageLayout>
      <SEO title={seo.title} description={seo.description} keywords={seo.keywords} path="/dashboard" jsonLd={seo.jsonLd} />
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="relative mb-5 rounded-xl border border-border/40 bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm overflow-hidden p-3.5"
      >
        {/* Accent strip */}
        <div className={cn('absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r', greeting.color)} />
        {/* Background glow */}
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-[0.06] pointer-events-none bg-primary" />

        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {/* Greeting icon */}
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-lg',
              greeting.color
            )}>
              <GreetIcon className="w-5 h-5 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-extrabold tracking-tight">
                  {greeting.text},
                </h1>
                <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-amber-300 via-orange-300 to-amber-400 bg-clip-text text-transparent">
                  {firstName}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Here's your market snapshot for today
              </p>
            </div>
          </div>

          {/* Market status pill */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold',
            marketSession.status === 'open'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : marketSession.status === 'pre-market'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                : 'border-border/50 bg-white/[0.03] text-muted-foreground'
          )}>
            <span className={cn(
              'w-2 h-2 rounded-full',
              marketSession.status === 'open' ? 'bg-emerald-400 animate-pulse'
                : marketSession.status === 'pre-market' ? 'bg-amber-400 animate-pulse'
                : 'bg-muted-foreground'
            )} />
            {marketSession.label}
          </div>
        </div>
      </motion.div>

      {/* Market Overview */}
      <Section title="Market Overview" className="mb-5">
        <MarketOverview />
      </Section>

      {/* Market Pulse — PCR, IV, Basis, Rollover */}
      <Section title="Market Pulse" description="Key derivatives indicators at a glance" className="mb-5">
        <ProSection isPro={isPro} label="Market Pulse" navigate={navigate}>
          <MarketPulseCards />
        </ProSection>
      </Section>

      {/* Advance-Decline Breadth */}
      <Section title="Market Breadth" className="mb-5">
        <ProSection isPro={isPro} label="Market Breadth" navigate={navigate}>
          <AdvanceDeclineBar />
        </ProSection>
      </Section>

      {/* Sector Performance */}
      <Section
        title="Sector Performance"
        description="Click any sector to see its top stocks — momentum movers & healthy pullbacks"
        className="mb-5"
      >
        <ProSection isPro={isPro} label="Sector Performance" navigate={navigate}>
          <SectorPerformance />
        </ProSection>
      </Section>

      {/* OI Scans — OI Up + OI Down */}
      <Section
        title="OI Scans"
        description="Top stocks by Open Interest change — buildup & unwinding"
        className="mb-5"
      >
        <ProSection isPro={isPro} label="OI Scans" navigate={navigate}>
          <OIScans />
        </ProSection>
      </Section>

      {/* Market Heatmap */}
      <Section
        title="Market Heatmap"
        description="F&O stocks treemap — size by impact, color by change"
        className="mb-5"
      >
        <ProSection isPro={isPro} label="Market Heatmap" navigate={navigate}>
          <MarketHeatmap />
        </ProSection>
      </Section>

      {/* FII/DII Data */}
      <Section title="FII / DII Activity" description="Institutional money flow — foreign & domestic" className="mb-5">
        <ProSection isPro={isPro} label="FII / DII Activity" navigate={navigate}>
          <FIIDIIData />
        </ProSection>
      </Section>

      {/* AI Advisor CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-5"
      >
        <Card className="p-4 bg-gradient-to-r from-violet-500/10 to-primary/10 border-violet-500/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <Brain className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  AI Trade Advisor
                  <Badge variant="default" className="bg-violet-500/20 text-violet-400 border-violet-500/30">
                    AI
                  </Badge>
                </h3>
                <p className="text-muted-foreground">
                  Get AI-powered recommendations based on your trades and market sentiment
                </p>
              </div>
            </div>
            <Link to="/algo">
              <Button variant="gradient" className="whitespace-nowrap">
                <Sparkles className="w-4 h-4 mr-2" />
                Open Advisor
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    </PageLayout>
  );
};

export default Dashboard;
