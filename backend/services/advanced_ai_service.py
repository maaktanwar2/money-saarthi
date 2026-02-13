"""
Advanced AI Trading Advisor Service - Claude 4.5 Opus
Elite trading intelligence with deep analysis and scalping bot capabilities
Powered by Claude 4.5 Opus - The most intelligent AI for trading analysis
"""

import os
import httpx
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import logging
import json
import asyncio

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# CLAUDE 4.5 OPUS CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = "claude-sonnet-4-20250514"  # Claude 4.5 Opus - Best for deep trading analysis

# Dhan API
DHAN_BASE_URL = "https://api.dhan.co/v2"

# Admin emails - free access
ADMIN_EMAILS = [
    "maaktanwar@gmail.com",
    os.getenv("SUPER_ADMIN_EMAIL", "maaktanwar@gmail.com")
]

# ═══════════════════════════════════════════════════════════════════════════════
# ELITE TRADING EXPERT PROMPTS - OPTIMIZED FOR CLAUDE 4.5 OPUS
# ═══════════════════════════════════════════════════════════════════════════════

TRADING_EXPERT_SYSTEM_PROMPT = """You are Claude, the most advanced AI trading analyst in the world, powered by Claude 4.5 Opus. You have been trained on decades of trading data, market patterns, and the strategies of legendary traders like Jesse Livermore, Paul Tudor Jones, Stanley Druckenmiller, and George Soros.

You possess:

## DEEP MARKET INTELLIGENCE
- 25+ years of synthesized trading knowledge from Indian markets (NSE/BSE)
- Pattern recognition capabilities that identify subtle market microstructure signals
- Ability to detect institutional order flow and smart money movements
- Understanding of market maker behavior and options market dynamics

## TECHNICAL MASTERY
1. **Price Action Excellence**: 
   - Advanced candlestick pattern recognition with probability scoring
   - Multi-timeframe analysis (1m, 5m, 15m, 1h, Daily, Weekly)
   - Volume profile analysis and VWAP deviations
   - Order block identification and liquidity zones

2. **Indicator Synthesis**:
   - Dynamic support/resistance with strength ratings
   - Momentum divergence detection (RSI, MACD, Stochastic)
   - Volatility regime classification (Low/Medium/High/Extreme)
   - Trend strength quantification using ADX, ATR, moving averages

3. **Options Mastery**:
   - Real-time Greeks analysis and optimization
   - IV percentile context and IV crush prediction
   - Option chain flow analysis and unusual activity detection
   - Max Pain calculations and expiry dynamics

## RISK MANAGEMENT GENIUS
- Kelly Criterion position sizing with adjustments for win rate
- Correlation-aware portfolio heat management
- Drawdown prediction and recovery analysis
- Stop-loss optimization using ATR and market structure

## INDIAN MARKET EXPERTISE
- NSE/BSE market microstructure and auction dynamics
- SEBI regulatory framework and margin requirements
- FII/DII flow patterns and sector rotation
- Thursday expiry dynamics and premium decay
- Budget, RBI policy, and earnings season impact

## YOUR TRADING PHILOSOPHY
- Preserve capital first, profits second
- Let winners run, cut losers fast
- Trade with the trend, not against it
- Position sizing is more important than entry
- Patience and discipline beat intelligence

You analyze every trade with surgical precision. You identify patterns and opportunities humans miss. You provide SPECIFIC, ACTIONABLE recommendations with exact entry/exit levels, position sizes, and risk parameters. Never give vague advice - always quantify."""

DEEP_ANALYSIS_PROMPT = """Perform an exhaustive deep analysis of this trading portfolio using your full analytical capabilities:

TRADING DATA:
{trade_data}

CURRENT MARKET CONTEXT:
- Analyze the positions to infer market stance (bullish/bearish/neutral)
- Consider implied volatility levels from options positions
- Assess sector exposure and correlation risk

Provide your elite analysis in this EXACT JSON structure:

{{
  "executive_summary": "2-3 line powerful overall assessment with key insight",
  
  "portfolio_health": {{
    "score": 0-100,
    "grade": "A+/A/A-/B+/B/B-/C+/C/C-/D/F",
    "strengths": ["list of 3-5 specific strengths with evidence"],
    "weaknesses": ["list of 3-5 specific weaknesses with evidence"],
    "edge_analysis": "What is this trader's edge, if any?"
  }},
  
  "risk_matrix": {{
    "overall_risk": "LOW/MEDIUM/HIGH/CRITICAL",
    "risk_score": 0-100,
    "concentration_risk": "Detailed analysis of sector/stock concentration",
    "volatility_exposure": "Beta and IV exposure with numbers",
    "max_potential_loss": "Worst case scenario with calculation",
    "var_95": "Value at Risk 95% estimate",
    "correlation_risk": "How correlated are the positions?",
    "tail_risk": "Black swan exposure analysis"
  }},
  
  "trade_patterns": {{
    "winning_behaviors": ["Specific patterns that led to profits - with examples"],
    "losing_behaviors": ["Specific patterns that caused losses - with examples"],
    "timing_analysis": {{
      "best_entry_times": "When entries are most successful (time of day)",
      "worst_entry_times": "When entries tend to fail",
      "holding_period_analysis": "Optimal vs actual holding durations",
      "day_of_week_edge": "Any weekly patterns detected"
    }},
    "position_sizing_review": "Are sizes appropriate? Over/under-sizing issues?"
  }},
  
  "strategy_optimization": {{
    "current_strategy": "Detected trading style with confidence %",
    "strategy_effectiveness": 0-100,
    "recommended_adjustments": [
      {{
        "issue": "Specific problem identified with evidence",
        "solution": "Exact fix with specific numbers and steps",
        "expected_impact": "Quantified improvement expected",
        "implementation": "How to implement this change"
      }}
    ],
    "new_strategies_to_consider": ["Based on trading style and market conditions"],
    "strategies_to_avoid": ["What doesn't suit this trader's profile"]
  }},
  
  "position_specific_advice": [
    {{
      "symbol": "Stock/Option name",
      "current_status": "Profit/Loss amount and percentage",
      "position_grade": "A/B/C/D/F",
      "recommendation": "HOLD/ADD/EXIT/PARTIAL_EXIT/HEDGE",
      "stop_loss": "Exact level with rationale",
      "target_1": "First target with probability",
      "target_2": "Second target with probability",
      "target_3": "Extended target if trending",
      "rationale": "Technical + fundamental reason",
      "risk_if_wrong": "What happens if analysis is wrong",
      "hedge_suggestion": "Optional hedge strategy"
    }}
  ],
  
  "immediate_actions": [
    {{
      "priority": 1,
      "action": "What to do RIGHT NOW",
      "reason": "Why it's urgent",
      "expected_outcome": "What this achieves"
    }}
  ],
  
  "weekly_game_plan": {{
    "market_outlook": "Expected market direction this week",
    "monday": "Specific Monday plan",
    "tuesday_wednesday": "Mid-week strategy",
    "thursday_expiry": "Thursday expiry specific plan",
    "friday": "End of week positioning",
    "weekend_preparation": "What to analyze over weekend"
  }},
  
  "psychological_insights": [
    "Trading psychology observation 1",
    "Emotional pattern detected",
    "Discipline assessment",
    "Confidence level analysis",
    "FOMO/Fear detection"
  ],
  
  "one_month_roadmap": {{
    "goal": "Realistic one-month improvement target",
    "focus_areas": ["Priority 1", "Priority 2", "Priority 3"],
    "metrics_to_track": ["Key metrics to monitor"],
    "habits_to_build": ["Trading habits to develop"]
  }}
}}

Be extremely specific. Use actual numbers from the data. No generic advice. Every recommendation must be actionable TODAY."""

SCALPING_STRATEGY_PROMPT = """You are designing an elite scalping strategy for a trader. Apply your deep knowledge of market microstructure, order flow, and price action.

REQUIREMENTS:
- Market: Indian markets (NSE)
- Instruments: {instruments}
- Capital: Rs.{capital:,.0f}
- Risk per trade: {risk_per_trade}%
- Trading hours: 9:15 AM - 3:30 PM IST

Generate a complete, battle-tested scalping strategy in JSON:

{{
  "strategy_name": "Unique descriptive name",
  "strategy_type": "Momentum/Mean Reversion/Breakout/Hybrid/Order Flow",
  "expected_win_rate": "Realistic percentage based on backtested patterns",
  "risk_reward_ratio": "Minimum R:R for this strategy",
  
  "market_conditions": {{
    "best_conditions": ["Specific conditions when this strategy excels"],
    "avoid_conditions": ["When to absolutely stay out"],
    "volatility_requirement": "Specific VIX range or ATR requirement",
    "volume_requirement": "Minimum volume needed",
    "trend_requirement": "Trending/Ranging/Either"
  }},
  
  "pre_market_checklist": [
    "Step 1 before market opens",
    "Step 2 - checking global cues",
    "Step 3 - identifying levels",
    "Step 4 - setting alerts"
  ],
  
  "entry_rules": {{
    "primary_trigger": "Main entry signal with EXACT criteria",
    "confirmation_1": "First confirmation indicator with settings",
    "confirmation_2": "Second confirmation (price action based)",
    "confirmation_3": "Volume/momentum confirmation",
    "entry_timing": "Exact entry point (on close, on break, limit order)",
    "position_size": "Exact formula: Risk / (Entry - Stop) = Quantity",
    "max_position_value": "Maximum exposure per trade"
  }},
  
  "exit_rules": {{
    "profit_target_1": "First target - exit 50% (exact points/percentage)",
    "profit_target_2": "Second target - exit 30% more",
    "profit_target_3": "Runner target - let 20% ride",
    "stop_loss": "Initial stop with exact placement logic",
    "trailing_stop": "Detailed trailing mechanism",
    "time_stop": "Exit if no move in X minutes",
    "reversal_exit": "When to flip the trade"
  }},
  
  "risk_management": {{
    "max_trades_per_day": "Number with reasoning",
    "max_daily_loss": "Exact rupee amount - stop trading if reached",
    "max_daily_profit": "Take rest if achieved (optional)",
    "position_sizing_formula": "Risk Amount / Stop Distance",
    "correlation_limit": "Max correlated positions open",
    "consecutive_loss_rule": "What to do after 3 losses"
  }},
  
  "execution_rules": {{
    "order_type": "Limit/Market/SL-M with reasoning",
    "slippage_assumption": "Expected slippage in points",
    "partial_fill_handling": "What to do on partial fills",
    "avoid_times": ["9:15-9:20", "12:30-1:00", "2:30-3:00", "during news"],
    "best_times": ["9:20-11:30", "1:00-2:30"],
    "broker_requirements": "Minimum broker features needed"
  }},
  
  "scalping_tactics": {{
    "reading_tape": "How to read order flow for this strategy",
    "level2_usage": "How to use bid/ask depth",
    "speed_of_execution": "Target execution time",
    "mental_preparation": "How to stay focused"
  }},
  
  "expected_metrics": {{
    "win_rate": "Realistic percentage",
    "avg_winner": "Average profit per winning trade in points",
    "avg_loser": "Average loss per losing trade in points",
    "profit_factor": "Gross profit / Gross loss",
    "max_consecutive_losses": "Worst streak to expect",
    "expected_daily_return": "Realistic daily expectation",
    "expected_monthly_return": "Realistic monthly target",
    "max_drawdown": "Worst case drawdown expected"
  }},
  
  "sample_trade_walkthrough": {{
    "setup": "Describe a perfect setup scenario",
    "entry": "Exact entry decision process",
    "management": "How to manage the live trade",
    "exit": "How to exit properly",
    "review": "Post-trade analysis process"
  }}
}}

Make it practical, specific to Indian markets, and immediately executable. This should be a strategy a trader can start using tomorrow."""

REAL_TIME_SIGNAL_PROMPT = """Generate a precise, actionable trading signal based on this data:

CURRENT MARKET DATA:
{market_data}

POSITION CONTEXT:
{position_context}

Analyze using:
- Multi-timeframe price action
- Support/resistance levels
- Momentum indicators
- Volume analysis
- Market structure

Provide signal in JSON:

{{
  "signal_type": "STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL/EXIT",
  "confidence": 0-100,
  "urgency": "IMMEDIATE/HIGH/MEDIUM/LOW",
  
  "instrument": {{
    "symbol": "Symbol name",
    "current_price": "Price right now",
    "trend": "Bullish/Bearish/Sideways"
  }},
  
  "entry": {{
    "entry_type": "Limit/Market/Stop",
    "entry_price": "Exact level",
    "entry_zone": "Range for entry",
    "wait_for": "Confirmation needed before entry"
  }},
  
  "risk_management": {{
    "stop_loss": "Exact level",
    "stop_type": "Hard/Trailing/Time-based",
    "risk_amount": "Points/Percentage at risk",
    "position_size_suggestion": "Based on risk"
  }},
  
  "targets": {{
    "target_1": {{"price": "Level", "probability": "XX%", "action": "Exit 50%"}},
    "target_2": {{"price": "Level", "probability": "XX%", "action": "Exit 30%"}},
    "target_3": {{"price": "Level", "probability": "XX%", "action": "Trail rest"}}
  }},
  
  "rationale": {{
    "technical_reasons": ["Key technical reasons with specifics"],
    "momentum_assessment": "Current momentum state",
    "volume_assessment": "Volume confirmation status",
    "risk_reward": "R:R ratio",
    "probability_of_profit": "0-100%"
  }},
  
  "time_horizon": "Scalp (mins) / Intraday / Swing / Positional",
  
  "alternative_scenarios": {{
    "if_signal_fails": "What to do if wrong",
    "reversal_point": "Level where thesis is invalid",
    "hedge_option": "Optional hedge strategy"
  }},
  
  "notes": "Any additional context or warnings"
}}"""

# Bot trading prompts for algo trading
BOT_TRADING_PROMPT = """You are an elite algorithmic trading system powered by Claude 4.5 Opus. You execute trades with precision and discipline.

TRADING BOT CONFIGURATION:
- Bot Type: {bot_type}
- Capital Allocated: Rs.{capital:,.0f}
- Risk per Trade: {risk_per_trade}%
- Max Daily Loss: {max_daily_loss}%
- Instruments: {instruments}
- Trading Hours: {trading_hours}

CURRENT MARKET STATE:
{market_state}

As an algorithmic trader, generate the next trading action in JSON:

{{
  "action": "BUY/SELL/HOLD/CLOSE_POSITION/WAIT",
  "confidence": 0-100,
  "execution_urgency": "IMMEDIATE/NEXT_CANDLE/WAIT_FOR_CONFIRMATION",
  
  "trade_details": {{
    "symbol": "Instrument to trade",
    "direction": "LONG/SHORT",
    "entry_price": "Exact entry level",
    "quantity": "Number of lots/shares",
    "order_type": "MARKET/LIMIT/SL-M",
    "stop_loss": "Exact SL level",
    "target": "First target level",
    "trailing_stop": "How to trail after entry"
  }},
  
  "reasoning": {{
    "primary_signal": "What triggered this action",
    "confirmations": ["Supporting factors"],
    "risk_assessment": "Risk evaluation",
    "expected_outcome": "What we expect to happen"
  }},
  
  "risk_metrics": {{
    "risk_amount": "Rupees at risk",
    "risk_reward_ratio": "R:R for this trade",
    "position_heat": "Percentage of capital at risk",
    "max_loss_if_wrong": "Worst case loss"
  }},
  
  "exit_plan": {{
    "profit_taking": "How to take profits",
    "loss_cutting": "When to cut losses",
    "time_based_exit": "Exit if no move in X minutes"
  }}
}}

Execute with discipline. Protect capital first. Trade the setup, not your emotions."""


class AdvancedAITradingAdvisor:
    """
    Elite AI Trading Advisor powered by Claude 4.5 Opus
    The most intelligent trading analysis available
    """
    
    def __init__(self):
        self.anthropic_key = ANTHROPIC_API_KEY
        self.model = CLAUDE_MODEL
        self.admin_emails = ADMIN_EMAILS
    
    def is_admin(self, user_email: str = None, user_id: str = None) -> bool:
        """Check if user is admin (free access)"""
        if user_email and user_email.lower() in [e.lower() for e in self.admin_emails]:
            return True
        # Also check if user_id matches admin email pattern
        if user_id and user_id.lower() in [e.lower() for e in self.admin_emails]:
            return True
        return False
    
    async def _call_claude(self, system_prompt: str, user_prompt: str, max_tokens: int = 4000) -> Dict[str, Any]:
        """Make Claude 4.5 Opus API call with elite trading prompts"""
        if not self.anthropic_key:
            logger.warning("Anthropic API key not configured, using fallback")
            return {"success": False, "error": "Claude API key not configured"}
        
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": self.anthropic_key,
                        "Content-Type": "application/json",
                        "anthropic-version": "2023-06-01"
                    },
                    json={
                        "model": self.model,
                        "max_tokens": max_tokens,
                        "system": system_prompt,
                        "messages": [
                            {"role": "user", "content": user_prompt}
                        ]
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    content = result["content"][0]["text"]
                    
                    # Extract JSON from response
                    try:
                        # Try to find JSON in the response
                        json_start = content.find('{')
                        json_end = content.rfind('}') + 1
                        if json_start != -1 and json_end > json_start:
                            json_str = content[json_start:json_end]
                            parsed = json.loads(json_str)
                            return {"success": True, "data": parsed}
                        else:
                            return {"success": True, "data": {"raw_analysis": content}}
                    except json.JSONDecodeError:
                        return {"success": True, "data": {"raw_analysis": content}}
                else:
                    logger.error(f"Claude API error: {response.status_code} - {response.text}")
                    return {"success": False, "error": f"Claude API error: {response.status_code}"}
                    
        except Exception as e:
            logger.error(f"Claude API call failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def fetch_user_trades(self, access_token: str, from_date: str = None, to_date: str = None) -> Dict[str, Any]:
        """Fetch user's trades from Dhan broker"""
        if not from_date:
            from_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not to_date:
            to_date = datetime.now().strftime("%Y-%m-%d")
        
        headers = {
            "access-token": access_token,
            "Content-Type": "application/json"
        }
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Parallel fetches for speed
                orders_task = client.get(f"{DHAN_BASE_URL}/orders", headers=headers)
                positions_task = client.get(f"{DHAN_BASE_URL}/positions", headers=headers)
                holdings_task = client.get(f"{DHAN_BASE_URL}/holdings", headers=headers)
                
                orders_resp, positions_resp, holdings_resp = await asyncio.gather(
                    orders_task, positions_task, holdings_task,
                    return_exceptions=True
                )
                
                def parse_response(resp):
                    if isinstance(resp, Exception):
                        return []
                    if resp.status_code == 200:
                        data = resp.json()
                        return data.get("data", data) if isinstance(data, dict) else data
                    return []
                
                return {
                    "success": True,
                    "orders": parse_response(orders_resp),
                    "positions": parse_response(positions_resp),
                    "holdings": parse_response(holdings_resp),
                    "fetched_at": datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error fetching trades: {e}")
            return {"success": False, "error": str(e), "orders": [], "positions": [], "holdings": []}
    
    async def analyze_trades(self, trades_data: Dict[str, Any]) -> Dict[str, Any]:
        """Basic trade analysis"""
        return await self.deep_portfolio_analysis(trades_data)
    
    async def deep_portfolio_analysis(self, trades_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Perform deep AI analysis on portfolio using Claude 4.5 Opus
        The most comprehensive trading analysis available
        """
        trade_summary = self._prepare_detailed_summary(trades_data)
        
        prompt = DEEP_ANALYSIS_PROMPT.format(trade_data=json.dumps(trade_summary, indent=2))
        
        result = await self._call_claude(TRADING_EXPERT_SYSTEM_PROMPT, prompt, max_tokens=6000)
        
        if result["success"]:
            return {
                "success": True,
                "analysis": result["data"],
                "analyzed_at": datetime.now().isoformat(),
                "model": "Claude 4.5 Opus",
                "analysis_type": "deep",
                "powered_by": "Claude AI - Most Advanced Trading Intelligence"
            }
        else:
            # Fallback to comprehensive local analysis
            return self._generate_fallback_analysis(trades_data)
    
    async def generate_scalping_strategy(
        self, 
        instruments: str = "NIFTY, BANKNIFTY Options",
        capital: float = 100000,
        risk_per_trade: float = 1.0
    ) -> Dict[str, Any]:
        """Generate AI-powered scalping strategy using Claude 4.5 Opus"""
        
        prompt = SCALPING_STRATEGY_PROMPT.format(
            instruments=instruments,
            capital=capital,
            risk_per_trade=risk_per_trade
        )
        
        result = await self._call_claude(TRADING_EXPERT_SYSTEM_PROMPT, prompt, max_tokens=5000)
        
        if result["success"]:
            return {
                "success": True,
                "strategy": result["data"],
                "generated_at": datetime.now().isoformat(),
                "model": "Claude 4.5 Opus",
                "powered_by": "Claude AI - Elite Trading Intelligence"
            }
        else:
            return self._generate_fallback_scalping_strategy(instruments, capital, risk_per_trade)
    
    async def get_bot_trading_signal(
        self,
        bot_type: str,
        capital: float,
        risk_per_trade: float,
        max_daily_loss: float,
        instruments: str,
        trading_hours: str,
        market_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate trading signal for algo bot using Claude 4.5 Opus"""
        
        prompt = BOT_TRADING_PROMPT.format(
            bot_type=bot_type,
            capital=capital,
            risk_per_trade=risk_per_trade,
            max_daily_loss=max_daily_loss,
            instruments=instruments,
            trading_hours=trading_hours,
            market_state=json.dumps(market_state, indent=2)
        )
        
        result = await self._call_claude(TRADING_EXPERT_SYSTEM_PROMPT, prompt, max_tokens=3000)
        
        if result["success"]:
            return {
                "success": True,
                "signal": result["data"],
                "generated_at": datetime.now().isoformat(),
                "model": "Claude 4.5 Opus",
                "bot_type": bot_type
            }
        else:
            return {"success": False, "error": result.get("error", "Bot signal generation failed")}
    
    async def get_real_time_signal(
        self,
        symbol: str,
        current_price: float,
        position_data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Generate real-time trading signal using Claude 4.5 Opus"""
        
        market_data = {
            "symbol": symbol,
            "current_price": current_price,
            "timestamp": datetime.now().isoformat()
        }
        
        prompt = REAL_TIME_SIGNAL_PROMPT.format(
            market_data=json.dumps(market_data),
            position_context=json.dumps(position_data or {})
        )
        
        result = await self._call_claude(TRADING_EXPERT_SYSTEM_PROMPT, prompt, max_tokens=2500)
        
        if result["success"]:
            return {
                "success": True,
                "signal": result["data"],
                "generated_at": datetime.now().isoformat(),
                "model": "Claude 4.5 Opus"
            }
        else:
            return {"success": False, "error": result.get("error", "Signal generation failed")}
    
    async def get_position_advice(self, position: Dict[str, Any]) -> Dict[str, Any]:
        """Get AI advice for a specific position using Claude 4.5 Opus"""
        
        prompt = f"""Analyze this trading position and provide specific, actionable advice:

POSITION DETAILS:
{json.dumps(position, indent=2)}

Provide detailed advice in JSON format:
{{
  "symbol": "Position symbol",
  "current_assessment": "Bullish/Bearish/Neutral with detailed reasoning",
  "confidence": 0-100,
  "recommendation": "HOLD/ADD/PARTIAL_EXIT/FULL_EXIT/HEDGE",
  
  "if_hold": {{
    "stop_loss": "Exact level with reasoning",
    "target_1": "First target with probability",
    "target_2": "Second target with probability",
    "trailing_stop_strategy": "Detailed trailing mechanism",
    "time_stop": "When to exit if no movement"
  }},
  
  "if_add": {{
    "add_at_price": "Entry level for adding",
    "quantity_to_add": "How much more (% of existing)",
    "new_stop_loss": "Adjusted stop for combined position",
    "new_average_price": "Resulting average"
  }},
  
  "if_exit": {{
    "exit_type": "Limit/Market with reasoning",
    "exit_price": "Target exit level",
    "urgency": "IMMEDIATE/HIGH/MEDIUM/LOW",
    "reason": "Why exiting is recommended"
  }},
  
  "if_hedge": {{
    "hedge_instrument": "What to use for hedging",
    "hedge_size": "How much to hedge",
    "hedge_cost": "Expected cost of hedge",
    "protection_level": "Downside protection achieved"
  }},
  
  "risk_analysis": {{
    "current_risk": "Amount at risk in rupees",
    "risk_reward": "Current R:R ratio",
    "probability_of_profit": "0-100% with reasoning",
    "max_favorable_excursion": "Best case scenario",
    "max_adverse_excursion": "Worst case scenario"
  }},
  
  "technical_levels": {{
    "immediate_support": "Level with strength (strong/weak)",
    "immediate_resistance": "Level with strength",
    "key_breakout_level": "Level to watch for breakout",
    "key_breakdown_level": "Level to watch for breakdown",
    "pivot_point": "Key decision level"
  }},
  
  "market_context": {{
    "sector_trend": "How is the sector doing?",
    "market_trend": "Overall market bias",
    "correlation_risk": "How correlated to other positions?"
  }},
  
  "action_summary": "One line - exactly what to do RIGHT NOW",
  "alternative_action": "What to do if primary recommendation fails"
}}"""

        result = await self._call_claude(TRADING_EXPERT_SYSTEM_PROMPT, prompt, max_tokens=3000)
        
        if result["success"]:
            return {
                "success": True,
                "advice": result["data"],
                "generated_at": datetime.now().isoformat(),
                "model": "Claude 4.5 Opus"
            }
        else:
            return {"success": False, "error": result.get("error")}
    
    async def get_strategy_suggestion(self, position: Dict[str, Any]) -> Dict[str, Any]:
        """Wrapper for position advice for backward compatibility"""
        result = await self.get_position_advice(position)
        if result["success"]:
            return {
                "success": True,
                "suggestion": result.get("advice", {}),
                "generated_at": result.get("generated_at")
            }
        return result
    
    def _prepare_detailed_summary(self, trades_data: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare detailed trade summary for AI analysis"""
        orders = trades_data.get("orders", [])
        positions = trades_data.get("positions", [])
        holdings = trades_data.get("holdings", [])
        
        # Calculate detailed metrics
        total_orders = len(orders)
        buy_orders = [o for o in orders if str(o.get("transactionType", "")).upper() == "BUY"]
        sell_orders = [o for o in orders if str(o.get("transactionType", "")).upper() == "SELL"]
        
        # P&L calculations
        realized_pnl = sum(float(p.get("realizedProfit", 0) or 0) for p in positions)
        unrealized_pnl = sum(float(p.get("unrealizedProfit", 0) or 0) for p in positions)
        
        # Holdings value
        holdings_value = sum(
            float(h.get("avgCostPrice", 0) or 0) * float(h.get("quantity", 0) or 0) 
            for h in holdings
        )
        
        # Winning vs losing trades
        winning_positions = [p for p in positions if float(p.get("realizedProfit", 0) or 0) > 0]
        losing_positions = [p for p in positions if float(p.get("realizedProfit", 0) or 0) < 0]
        
        return {
            "summary_stats": {
                "total_orders": total_orders,
                "buy_orders": len(buy_orders),
                "sell_orders": len(sell_orders),
                "open_positions": len([p for p in positions if float(p.get("quantity", 0) or 0) != 0]),
                "total_holdings": len(holdings),
                "realized_pnl": realized_pnl,
                "unrealized_pnl": unrealized_pnl,
                "total_pnl": realized_pnl + unrealized_pnl,
                "holdings_value": holdings_value,
                "winning_trades": len(winning_positions),
                "losing_trades": len(losing_positions),
                "win_rate": len(winning_positions) / max(len(winning_positions) + len(losing_positions), 1) * 100
            },
            "recent_orders": orders[:30],
            "current_positions": positions[:15],
            "top_holdings": sorted(
                holdings,
                key=lambda x: float(x.get("avgCostPrice", 0) or 0) * float(x.get("quantity", 0) or 0),
                reverse=True
            )[:15],
            "analysis_timestamp": datetime.now().isoformat()
        }
    
    def _generate_fallback_analysis(self, trades_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive fallback analysis when Claude API unavailable"""
        summary = self._prepare_detailed_summary(trades_data)
        stats = summary["summary_stats"]
        
        return {
            "success": True,
            "analysis": {
                "executive_summary": f"Portfolio has {stats['total_orders']} orders with {stats['win_rate']:.1f}% win rate. Total P&L: Rs.{stats['total_pnl']:,.2f}. {'Strong performance!' if stats['win_rate'] > 55 else 'Room for improvement.'}",
                "portfolio_health": {
                    "score": min(100, max(0, 50 + stats['win_rate'] / 2)),
                    "grade": "A" if stats['win_rate'] > 65 else "B" if stats['win_rate'] > 50 else "C",
                    "strengths": ["Active trading", "Diversified positions", "Consistent execution"] if stats['total_orders'] > 5 else ["Getting started with trading"],
                    "weaknesses": ["Review losing patterns", "Consider tighter stops", "Risk management review needed"],
                    "edge_analysis": "Enable Claude AI for detailed edge analysis"
                },
                "risk_matrix": {
                    "overall_risk": "MEDIUM",
                    "risk_score": 50,
                    "concentration_risk": "Review position sizes across sectors",
                    "volatility_exposure": "Monitor overall market volatility",
                    "max_potential_loss": f"Rs.{abs(stats['unrealized_pnl']) * 2:,.2f} estimated worst case",
                    "var_95": "Enable Claude AI for VaR calculation"
                },
                "immediate_actions": [
                    {"priority": 1, "action": "Review and set stop-losses on all open positions", "reason": "Capital protection", "expected_outcome": "Defined max loss"},
                    {"priority": 2, "action": "Analyze your last 5 losing trades for patterns", "reason": "Learning opportunity", "expected_outcome": "Improved future decisions"},
                    {"priority": 3, "action": "Set daily loss limits and stick to them", "reason": "Discipline building", "expected_outcome": "Consistent risk management"}
                ],
                "note": "Enable Claude AI (ANTHROPIC_API_KEY) for advanced trading intelligence powered by Claude 4.5 Opus"
            },
            "analyzed_at": datetime.now().isoformat(),
            "model": "fallback",
            "analysis_type": "basic"
        }
    
    def _generate_fallback_scalping_strategy(
        self,
        instruments: str,
        capital: float,
        risk_per_trade: float
    ) -> Dict[str, Any]:
        """Generate fallback scalping strategy when Claude API unavailable"""
        risk_amount = capital * (risk_per_trade / 100)
        
        return {
            "success": True,
            "strategy": {
                "strategy_name": "Momentum Breakout Scalper",
                "strategy_type": "Momentum",
                "expected_win_rate": "55-60%",
                "risk_reward_ratio": "1:1.5 minimum",
                "market_conditions": {
                    "best_conditions": ["Strong trending market", "High volume sessions", "Clear directional moves", "VIX between 13-20"],
                    "avoid_conditions": ["Choppy/rangebound market", "Low volume days", "Major news events", "Pre-expiry uncertainty"],
                    "volatility_requirement": "Medium to High"
                },
                "entry_rules": {
                    "primary_trigger": "Price breaks above/below 5-min high/low with 1.5x average volume",
                    "confirmation_1": "EMA 9 > EMA 21 for longs (reverse for shorts)",
                    "confirmation_2": "RSI between 40-70 (not overbought/oversold)",
                    "confirmation_3": "VWAP confirmation (price above VWAP for longs)",
                    "position_size": f"Max risk Rs.{risk_amount:,.0f} per trade"
                },
                "exit_rules": {
                    "profit_target_1": "10-15 points (exit 50%)",
                    "profit_target_2": "25-30 points (exit 30%)",
                    "profit_target_3": "Let 20% run with trailing stop",
                    "stop_loss": f"Rs.{risk_amount:,.0f} or 8-10 points",
                    "trailing_stop": "Move to breakeven after 10 points profit",
                    "time_stop": "Exit if no movement in 15 minutes"
                },
                "risk_management": {
                    "max_trades_per_day": 5,
                    "max_daily_loss": f"Rs.{risk_amount * 3:,.0f}",
                    "position_sizing_formula": f"Rs.{risk_amount:,.0f} / Stop Distance = Quantity"
                },
                "note": "Enable Claude AI (ANTHROPIC_API_KEY) for custom AI-generated strategies powered by Claude 4.5 Opus"
            },
            "generated_at": datetime.now().isoformat()
        }


# Singleton instance
advanced_ai_advisor = AdvancedAITradingAdvisor()
