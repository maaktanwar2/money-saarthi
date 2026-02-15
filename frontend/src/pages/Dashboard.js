// Dashboard - Main home page with market overview
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, ChevronRight, Sparkles } from 'lucide-react';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { PageLayout, Section } from '../components/PageLayout';
import { Card, Badge, Button } from '../components/ui';
import { cn, getMarketSession } from '../lib/utils';

// Sub-components (extracted)
import MarketOverview from '../components/dashboard/MarketOverview';
import QuickTools from '../components/dashboard/QuickTools';
import SectorPerformance from '../components/dashboard/SectorPerformance';
import TopMovers from '../components/dashboard/TopMovers';
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

const Dashboard = () => {
  const marketSession = getMarketSession();
  const seo = getSeoConfig('/dashboard');

  return (
    <PageLayout>
      <SEO title={seo.title} description={seo.description} keywords={seo.keywords} path="/dashboard" jsonLd={seo.jsonLd} />
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <Badge
            variant={marketSession.status === 'open' ? 'success' : 'secondary'}
            className="flex items-center gap-1"
          >
            <span className={cn(
              'w-2 h-2 rounded-full',
              marketSession.status === 'open' ? 'bg-bullish animate-pulse' : 'bg-muted-foreground'
            )} />
            {marketSession.label}
          </Badge>
        </div>
        <p className="text-lg text-muted-foreground font-medium" style={{ color: '#D4A574' }}>
          {getUserFirstName()}
        </p>
        <p className="text-muted-foreground mt-1">
          Here's what's happening in the market today
        </p>
      </motion.div>

      {/* Market Overview */}
      <Section title="Market Overview" className="mb-8">
        <MarketOverview />
      </Section>

      {/* Sector Performance */}
      <Section
        title="Sector Performance"
        description="Click any sector to see its top stocks — momentum movers & healthy pullbacks"
        className="mb-8"
      >
        <SectorPerformance />
      </Section>

      {/* Top Gainers & Losers */}
      <Section
        title="Top Movers"
        description="Today's top performing and declining F&O stocks"
        className="mb-8"
      >
        <TopMovers />
      </Section>

      {/* Quick Tools */}
      <Section
        title="Trading Tools"
        description="Access powerful tools with backtested accuracy"
        action={
          <Link to="/scanners">
            <Button variant="ghost" size="sm">
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        }
        className="mb-8"
      >
        <QuickTools />
      </Section>

      {/* FII/DII Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <FIIDIIData />
        </div>
      </div>

      {/* AI Advisor CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8"
      >
        <Card className="p-6 bg-gradient-to-r from-violet-500/10 to-primary/10 border-violet-500/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/20 flex items-center justify-center">
                <Brain className="w-7 h-7 text-violet-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold flex items-center gap-2">
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
