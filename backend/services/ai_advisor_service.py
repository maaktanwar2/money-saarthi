"""
AI Trading Advisor Service
Analyzes user trades and provides strategy adjustments using AI
"""

import os
import httpx
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import logging
import json

logger = logging.getLogger(__name__)

# OpenAI Configuration (can also use local LLM or other providers)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# Dhan API for fetching trades
DHAN_BASE_URL = "https://api.dhan.co/v2"


class AITradingAdvisor:
    """
    AI-powered trading analysis and strategy advisor
    Fetches trades from broker and provides intelligent insights
    """
    
    def __init__(self):
        self.openai_key = OPENAI_API_KEY
        self.model = OPENAI_MODEL
    
    async def fetch_user_trades(self, access_token: str, from_date: str = None, to_date: str = None) -> Dict[str, Any]:
        """
        Fetch user's trades from Dhan broker
        """
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
                # Fetch orders
                orders_response = await client.get(
                    f"{DHAN_BASE_URL}/orders",
                    headers=headers
                )
                
                # Fetch positions
                positions_response = await client.get(
                    f"{DHAN_BASE_URL}/positions",
                    headers=headers
                )
                
                # Fetch holdings
                holdings_response = await client.get(
                    f"{DHAN_BASE_URL}/holdings",
                    headers=headers
                )
                
                orders = orders_response.json() if orders_response.status_code == 200 else []
                positions = positions_response.json() if positions_response.status_code == 200 else []
                holdings = holdings_response.json() if holdings_response.status_code == 200 else []
                
                return {
                    "success": True,
                    "orders": orders.get("data", orders) if isinstance(orders, dict) else orders,
                    "positions": positions.get("data", positions) if isinstance(positions, dict) else positions,
                    "holdings": holdings.get("data", holdings) if isinstance(holdings, dict) else holdings,
                    "fetched_at": datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error fetching trades: {e}")
            return {
                "success": False,
                "error": str(e),
                "orders": [],
                "positions": [],
                "holdings": []
            }
    
    async def analyze_trades(self, trades_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Use AI to analyze trades and provide insights
        """
        if not self.openai_key:
            return self._fallback_analysis(trades_data)
        
        orders = trades_data.get("orders", [])
        positions = trades_data.get("positions", [])
        holdings = trades_data.get("holdings", [])
        
        # Prepare trade summary for AI
        trade_summary = self._prepare_trade_summary(orders, positions, holdings)
        
        prompt = f"""You are an expert trading advisor for Indian stock market (NSE/BSE).
Analyze the following trading data and provide actionable insights.

TRADING DATA:
{json.dumps(trade_summary, indent=2)}

Please provide:
1. PORTFOLIO ANALYSIS: Overall assessment of the portfolio
2. RISK ASSESSMENT: Current risk level (Low/Medium/High) with reasons
3. WINNING PATTERNS: What's working well in the trades
4. LOSING PATTERNS: Common mistakes or issues identified
5. STRATEGY ADJUSTMENTS: Specific recommendations to improve
6. POSITION SIZING: Are position sizes appropriate?
7. TIMING ANALYSIS: Entry/exit timing patterns
8. ACTION ITEMS: Top 3 immediate actions to take

Keep response concise and actionable. Use bullet points.
Format as JSON with keys: portfolio_analysis, risk_assessment, winning_patterns, losing_patterns, strategy_adjustments, position_sizing, timing_analysis, action_items"""

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.openai_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": "You are an expert Indian stock market trading advisor. Respond in JSON format only."},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.7,
                        "max_tokens": 1500
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    content = result["choices"][0]["message"]["content"]
                    
                    # Try to parse as JSON
                    try:
                        # Remove markdown code blocks if present
                        if content.startswith("```"):
                            content = content.split("```")[1]
                            if content.startswith("json"):
                                content = content[4:]
                        analysis = json.loads(content)
                    except json.JSONDecodeError:
                        analysis = {"raw_analysis": content}
                    
                    return {
                        "success": True,
                        "analysis": analysis,
                        "model": self.model,
                        "analyzed_at": datetime.now().isoformat()
                    }
                else:
                    logger.error(f"OpenAI API error: {response.text}")
                    return self._fallback_analysis(trades_data)
                    
        except Exception as e:
            logger.error(f"AI analysis error: {e}")
            return self._fallback_analysis(trades_data)
    
    def _prepare_trade_summary(self, orders: list, positions: list, holdings: list) -> Dict[str, Any]:
        """Prepare a summary of trading data for AI analysis"""
        
        # Calculate metrics from orders
        total_orders = len(orders)
        buy_orders = [o for o in orders if o.get("transactionType", "").upper() == "BUY"]
        sell_orders = [o for o in orders if o.get("transactionType", "").upper() == "SELL"]
        
        # Calculate P&L from positions
        total_pnl = sum(float(p.get("realizedProfit", 0) or 0) for p in positions)
        unrealized_pnl = sum(float(p.get("unrealizedProfit", 0) or 0) for p in positions)
        
        # Holdings summary
        holdings_value = sum(
            float(h.get("avgCostPrice", 0) or 0) * float(h.get("quantity", 0) or 0) 
            for h in holdings
        )
        
        return {
            "summary": {
                "total_orders": total_orders,
                "buy_orders": len(buy_orders),
                "sell_orders": len(sell_orders),
                "realized_pnl": total_pnl,
                "unrealized_pnl": unrealized_pnl,
                "holdings_value": holdings_value,
                "open_positions": len([p for p in positions if float(p.get("quantity", 0) or 0) != 0])
            },
            "recent_orders": orders[:20] if orders else [],
            "current_positions": positions[:10] if positions else [],
            "top_holdings": sorted(
                holdings, 
                key=lambda x: float(x.get("avgCostPrice", 0) or 0) * float(x.get("quantity", 0) or 0),
                reverse=True
            )[:10] if holdings else []
        }
    
    def _fallback_analysis(self, trades_data: Dict[str, Any]) -> Dict[str, Any]:
        """Provide basic analysis when AI is not available"""
        orders = trades_data.get("orders", [])
        positions = trades_data.get("positions", [])
        holdings = trades_data.get("holdings", [])
        
        total_pnl = sum(float(p.get("realizedProfit", 0) or 0) for p in positions)
        
        return {
            "success": True,
            "analysis": {
                "portfolio_analysis": f"You have {len(orders)} orders, {len(positions)} positions, and {len(holdings)} holdings.",
                "risk_assessment": {
                    "level": "Medium",
                    "reason": "Unable to perform detailed AI analysis. Please configure OpenAI API key."
                },
                "winning_patterns": ["Data insufficient for pattern analysis"],
                "losing_patterns": ["Data insufficient for pattern analysis"],
                "strategy_adjustments": [
                    "Maintain diversification across sectors",
                    "Use stop-losses for all trades",
                    "Avoid overtrading"
                ],
                "position_sizing": "Review position sizes to ensure no single position exceeds 10% of portfolio",
                "timing_analysis": "Analyze your entry and exit times for optimization",
                "action_items": [
                    "Set up AI analysis for detailed insights",
                    "Review your losing trades for patterns",
                    "Maintain a trading journal"
                ]
            },
            "model": "fallback",
            "analyzed_at": datetime.now().isoformat()
        }
    
    async def get_strategy_suggestion(self, position: Dict[str, Any], access_token: str = None) -> Dict[str, Any]:
        """
        Get AI suggestion for a specific position
        """
        if not self.openai_key:
            return {
                "success": False,
                "error": "AI not configured",
                "suggestion": "Configure OpenAI API key for AI-powered suggestions"
            }
        
        prompt = f"""Analyze this trading position and provide strategy adjustment:

POSITION:
{json.dumps(position, indent=2)}

Provide:
1. ASSESSMENT: Current position status
2. RECOMMENDATION: Hold/Add/Exit/Partial Exit
3. STOP LOSS: Suggested stop loss level
4. TARGET: Suggested target levels
5. RISK: Position risk assessment
6. ACTION: Immediate action to take

Keep response brief and actionable. Format as JSON."""

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.openai_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": "You are an expert Indian stock market advisor. Be brief and actionable."},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.5,
                        "max_tokens": 500
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    content = result["choices"][0]["message"]["content"]
                    
                    try:
                        if content.startswith("```"):
                            content = content.split("```")[1]
                            if content.startswith("json"):
                                content = content[4:]
                        suggestion = json.loads(content)
                    except:
                        suggestion = {"raw_suggestion": content}
                    
                    return {
                        "success": True,
                        "suggestion": suggestion
                    }
                else:
                    return {
                        "success": False,
                        "error": "AI request failed"
                    }
                    
        except Exception as e:
            logger.error(f"Strategy suggestion error: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Singleton instance
ai_advisor = AITradingAdvisor()
