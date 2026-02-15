// ═══════════════════════════════════════════════════════════════════════════════
// SEO Configuration — Per-page meta tags + JSON-LD structured data
// ═══════════════════════════════════════════════════════════════════════════════

const SITE_NAME = 'Money Saarthi';
const SITE_URL = 'https://moneysaarthi.in';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

/**
 * Per-page SEO config keyed by route path.
 * Each entry: { title, description, keywords, jsonLd }
 */
const seoConfig = {
  '/': {
    title: 'Money Saarthi | F&O Trading Companion for Indian Stock Market',
    description:
      'Money Saarthi – your all-in-one F&O trading companion. Live option chain, AI trade signals, stock scanners, FII/DII data, backtesting, and algo trading bots for NSE & BSE.',
    keywords:
      'Money Saarthi, F&O trading, Indian stock market, option chain, stock scanner, trading signals, NSE, BSE, algo trading, options analytics',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Money Saarthi',
      url: SITE_URL,
      description:
        'All-in-one F&O trading companion for Indian stock market with live option chain, AI signals, scanners, algo bots, and backtesting.',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '899',
        priceCurrency: 'INR',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        ratingCount: '150',
      },
    },
  },

  '/dashboard': {
    title: 'Live Market Dashboard | NIFTY, Bank NIFTY, SENSEX | Money Saarthi',
    description:
      'Real-time market dashboard with live NIFTY 50, Bank NIFTY, SENSEX prices, sector performance, top movers, and quick-access trading tools. Updated every 30 seconds.',
    keywords:
      'live market dashboard, NIFTY 50 live, Bank NIFTY today, SENSEX live price, sector performance, top gainers losers, India VIX, market overview',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Live Market Dashboard',
      description: 'Real-time market dashboard with NIFTY 50, Bank NIFTY, SENSEX, sectors, and top movers.',
      isPartOf: { '@type': 'WebApplication', name: SITE_NAME, url: SITE_URL },
    },
  },

  '/options': {
    title: 'Live Option Chain Scanner | Real-Time NSE/BSE Data | Money Saarthi',
    description:
      'Analyze real-time NSE option chains for NIFTY, Bank NIFTY, FIN NIFTY & MIDCAP NIFTY. View OI buildup, IV skew, Greeks, and build payoff charts — all in one terminal.',
    keywords:
      'option chain, live option chain, NSE option chain, NIFTY option chain, Bank NIFTY options, OI analysis, IV skew, Greeks calculator, payoff chart, options analytics',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Options Lab — Live Option Chain Scanner',
      url: `${SITE_URL}/options`,
      description:
        'Real-time option chain scanner with OI analysis, IV skew, Greeks calculator, and payoff chart builder for NSE indices.',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      featureList: 'Live Option Chain, OI Analysis, IV Skew Charts, Greeks Calculator, Payoff Chart Builder',
    },
  },

  '/signals': {
    title: 'Stock Scanner & Trade Signals | Intraday & Swing | Money Saarthi',
    description:
      'Real-time NSE stock scanner with AI-powered buy/sell signals. Filter top gainers, losers, and swing setups across intraday and 2–5 day timeframes. Updated live.',
    keywords:
      'stock scanner, trade signals, NSE scanner, intraday scanner, swing trade scanner, top gainers, top losers, buy sell signals, breakout scanner',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Stock Scanner — AI Trade Signals',
      url: `${SITE_URL}/signals`,
      description:
        'Real-time stock scanner with AI-powered buy/sell signals for intraday and swing trading on NSE.',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      featureList: 'Real-time Scanner, Buy/Sell Signals, Gainers & Losers, Swing Setups, Intraday Filters',
    },
  },

  '/market': {
    title: 'Market Pulse | FII/DII Data, Market Breadth & Indices | Money Saarthi',
    description:
      'Comprehensive NSE market dashboard — live indices ticker, FII/DII activity, market breadth, advance-decline data, and top gainers/losers. Auto-refreshed every 30 seconds.',
    keywords:
      'FII DII data, market breadth, NSE indices, advance decline, market pulse, FII activity, DII activity, NIFTY 50, Bank NIFTY, India VIX',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Market Pulse — FII/DII & Market Breadth',
      description: 'Live NSE market data dashboard with FII/DII flows, breadth, indices, and top movers.',
      isPartOf: { '@type': 'WebApplication', name: SITE_NAME, url: SITE_URL },
    },
  },

  '/sectors': {
    title: 'F&O Sector Map | All Stocks by Sector with Live Prices | Money Saarthi',
    description:
      'Browse all F&O stocks organized by sector. View live prices, percentage changes, gainers vs losers count per sector. Search and filter across all NSE F&O sectors.',
    keywords:
      'sector map, F&O stocks by sector, NSE sectors, sector wise stocks, live stock prices, sector analysis, F&O sector performance',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'F&O Sector Map — Stocks by Sector',
      description: 'All F&O stocks organized by sector with live prices and percentage changes.',
      isPartOf: { '@type': 'WebApplication', name: SITE_NAME, url: SITE_URL },
    },
  },

  '/sector-performance': {
    title: 'NSE Sector Performance | 11 Sectoral Indices Live | Money Saarthi',
    description:
      'Track 11 NSE F&O sectoral indices in real time. View bullish, bearish, and neutral sectors with horizontal bar charts and detailed drill-down into constituent stocks.',
    keywords:
      'NSE sector performance, sectoral indices, NIFTY IT, NIFTY Bank, NIFTY Pharma, sector wise performance, bullish sectors, bearish sectors',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'NSE Sector Performance — 11 Sectoral Indices',
      description: 'Real-time performance tracker for 11 NSE F&O sectoral indices with drill-down views.',
      isPartOf: { '@type': 'WebApplication', name: SITE_NAME, url: SITE_URL },
    },
  },

  '/ai-agent': {
    title: 'AI Trading Agent | Autonomous F&O Bot | Money Saarthi',
    description:
      'Autonomous AI trading agent powered by Claude LLM. Observes market, thinks, decides, and acts across 9 strategies — iron condor, strangle, straddle, VWAP reversal & more.',
    keywords:
      'AI trading agent, autonomous trading bot, algo trading AI, iron condor bot, strangle bot, AI options trading, Claude LLM trading, F&O bot',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'AI Trading Agent — Autonomous F&O Bot',
      url: `${SITE_URL}/ai-agent`,
      description:
        'Self-thinking, self-adjusting AI trading agent supporting 9 F&O strategies with real-time market observation.',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      featureList: 'Autonomous Trading, 9 Strategies, Claude LLM, Real-time P&L, Confidence Tracking',
    },
  },

  '/algo': {
    title: 'Algo Trading Bots | VWAP & QuantStrangle AI | Money Saarthi',
    description:
      'Deploy AI-powered algo trading bots — VWAP Momentum Bot and QuantStrangle AI Bot. Start/stop with one click, track win rates, and manage risk levels in real time.',
    keywords:
      'algo trading, trading bots, VWAP bot, strangle bot, automated trading, algo trading India, NSE algo trading, quantitative trading',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Algo Trading Bots',
      url: `${SITE_URL}/algo`,
      description:
        'AI-powered algo trading bots with VWAP Momentum and QuantStrangle strategies for automated NSE F&O trading.',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      featureList: 'VWAP Momentum Bot, QuantStrangle AI, One-click Start/Stop, Win Rate Tracking',
    },
  },

  '/calculators': {
    title: 'F&O Calculators | Margin, Brokerage & Position Size | Money Saarthi',
    description:
      'Professional-grade financial calculators — F&O margin calculator, brokerage calculator with STT/GST/stamp duty breakdown, and position size calculator for risk management.',
    keywords:
      'F&O margin calculator, brokerage calculator, position size calculator, STT calculator, option margin calculator, trading calculator India',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Financial Calculators — Margin, Brokerage & Position Size',
      url: `${SITE_URL}/calculators`,
      description:
        'Professional-grade F&O margin, brokerage (STT/GST/stamp duty), and position size calculators for Indian stock market.',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      featureList: 'Margin Calculator, Brokerage Calculator, Position Size Calculator, Risk Management',
    },
  },

  '/ltp-calculator': {
    title: 'LTP Calculator & Live Option Chain | P&L + COA Analysis | Money Saarthi',
    description:
      'Advanced options analysis tool — P&L calculator, live option chain with OI charts, COA 9-scenario framework, and intelligent auto strategy suggestions for NIFTY & Bank NIFTY.',
    keywords:
      'LTP calculator, option P&L calculator, COA analysis, option chain analysis, strategy suggestion, NIFTY options, breakeven calculator',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'LTP Calculator & Trade Finder',
      url: `${SITE_URL}/ltp-calculator`,
      description:
        'Multi-tool options analysis with P&L calculator, live chain, COA framework, and auto strategy suggestions.',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      featureList: 'P&L Calculator, Live Option Chain, COA Analysis, Auto Strategy Suggestions',
    },
  },

  '/trade-finder': {
    title: 'Trade Finder Pro | OI Sentiment & Strategy Suggestions | Money Saarthi',
    description:
      'OI-driven trade discovery engine — strategy suggestions backed by open interest, PCR & delta OI sentiment, option clock, OI blocks, and swing breakout scanners.',
    keywords:
      'trade finder, OI sentiment, PCR analysis, open interest analysis, option clock, OI blocks, swing scanner, breakout scanner, NR7 scanner',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Trade Finder Pro — OI-driven Strategy Engine',
      url: `${SITE_URL}/trade-finder`,
      description:
        'Advanced OI sentiment analysis with strategy suggestions, option clock, OI blocks, and swing spectrum scanners.',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      featureList: 'Strategy Finder, OI Sentiment, Option Clock, OI Blocks, Swing Spectrum',
    },
  },

  '/journal': {
    title: 'Trading Journal | Track & Analyze Your Trades | Money Saarthi',
    description:
      'Personal trading journal — log every trade with entry/exit, P&L auto-calculation, win rate, profit factor, and average win/loss analytics. Improve your trading performance.',
    keywords:
      'trading journal, trade tracker, trade log, win rate, profit factor, trading performance, trade analytics, trade diary',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Trading Journal — Track & Improve',
      url: `${SITE_URL}/journal`,
      description:
        'Personal trade logging with auto P&L, win rate, profit factor, and performance analytics.',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      featureList: 'Trade Logging, Auto P&L, Win Rate, Profit Factor, Performance Analytics',
    },
  },

  '/backtest': {
    title: 'Strategy Backtesting | Iron Condor, Strangle & More | Money Saarthi',
    description:
      'Backtest NIFTY 50 delta-neutral option selling strategies — Iron Condor, Iron Butterfly, Short Strangle & more. View equity curves, monthly P&L, Sharpe ratio, and max drawdown.',
    keywords:
      'backtesting, strategy backtest, iron condor backtest, iron butterfly backtest, short strangle backtest, NIFTY backtest, options backtesting',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Strategy Backtesting — NIFTY F&O',
      url: `${SITE_URL}/backtest`,
      description:
        'Visual backtesting of NIFTY 50 delta-neutral option selling strategies with equity curves, Sharpe ratio, and drawdown.',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      featureList: 'Iron Condor, Iron Butterfly, Short Strangle, Equity Curves, Sharpe Ratio, Max Drawdown',
    },
  },

  '/pricing': {
    title: 'Pricing Plans | Money Saarthi Pro Subscription',
    description:
      'Unlock all Money Saarthi features — AI signals, live option chain, algo bots, backtesting, FII/DII data & more. Plans starting at ₹899/month or ₹4,999/year (save 53%).',
    keywords:
      'Money Saarthi pricing, subscription plans, trading app subscription, F&O tools pricing, algo trading plan, Money Saarthi Pro',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Money Saarthi Pro',
      description:
        'Full access to all Money Saarthi trading tools — AI signals, options analytics, algo bots, backtesting, and more.',
      brand: { '@type': 'Brand', name: 'Money Saarthi' },
      offers: [
        {
          '@type': 'Offer',
          name: 'Monthly Plan',
          price: '899',
          priceCurrency: 'INR',
          url: `${SITE_URL}/pricing`,
          availability: 'https://schema.org/InStock',
        },
        {
          '@type': 'Offer',
          name: 'Yearly Plan',
          price: '4999',
          priceCurrency: 'INR',
          url: `${SITE_URL}/pricing`,
          availability: 'https://schema.org/InStock',
        },
      ],
    },
  },

  '/login': {
    title: 'Login | Money Saarthi — F&O Trading Companion',
    description:
      'Sign in to Money Saarthi to access your trading dashboard, AI signals, options analytics, and algo trading bots. Login with Google, Apple, or email.',
    keywords:
      'Money Saarthi login, sign in, trading app login, F&O tools login',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Login — Money Saarthi',
      description: 'Sign in to access your Money Saarthi trading tools and dashboard.',
      isPartOf: { '@type': 'WebApplication', name: SITE_NAME, url: SITE_URL },
    },
  },

  '/settings': {
    title: 'Settings | Customize Your Trading Experience | Money Saarthi',
    description:
      'Customize your Money Saarthi experience — adjust preferences, notifications, display settings, and trading defaults.',
    keywords:
      'Money Saarthi settings, trading preferences, app settings, customization',
    jsonLd: null,
  },

  '/profile': {
    title: 'My Profile | Account & Token Wallet | Money Saarthi',
    description:
      'Manage your Money Saarthi account — view subscription status, recharge tokens, and access billing history.',
    keywords:
      'Money Saarthi profile, account settings, token wallet, subscription management',
    jsonLd: null,
  },
};

/**
 * Get SEO config for a given route path.
 * Falls back to the root '/' config for unknown routes.
 */
export function getSeoConfig(path) {
  return seoConfig[path] || seoConfig['/'];
}

export { SITE_NAME, SITE_URL, DEFAULT_OG_IMAGE };
export default seoConfig;
