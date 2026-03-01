# Bot Trading Issue - Root Cause Analysis & Fix

## TL;DR - Why No Trades Are Happening

The bot endpoint routes **ARE defined** on the backend, but there are **two possible issues**:

1. **Missing bot service methods** - The routes call async methods that might not exist on bot classes
2. **Broker connection might be failing** - Without valid broker credentials, bots can't execute trades

---

## Architecture Overview

```
Frontend (AlgoTrading.js)
    ↓
    POST /api/trade-algo/vwap-bot/start (with config)
    ↓
Backend Routes (trade_algo_routes.py)
    ↓
    Bot Services (vwap_trading_bot.py, ai_delta_strangle_bot.py)
    ↓
    Broker Services (Dhan/Upstox APIs)
    ↓
    Place Actual Orders
```

---

## What We Found

### ✅ Routes ARE Defined:
- [x] `/api/trade-algo/vwap-bot/start` - POST
- [x] `/api/trade-algo/vwap-bot/stop` - POST
- [x] `/api/trade-algo/vwap-bot/status` - GET
- [x] `/api/trade-algo/vwap-bot/scan` - POST
- [x] `/api/trade-algo/ai-delta-strangle/start` - POST
- [x] `/api/trade-algo/ai-delta-strangle/stop` - POST
- [x] `/api/trade-algo/ai-delta-strangle/status` - GET
- [x] `/api/trade-algo/delta-neutral/start` - POST
- [x] `/api/trade-algo/delta-neutral/stop` - POST
- [x] `/api/trade-algo/delta-neutral/status` - GET

### ✅ Bot Service Classes Exist:
- [x] `VWAPTradingBot` - in `backend/services/vwap_trading_bot.py` ✅ HAS start(), stop(), get_status()
- [x] `AIStrangleBot` - in `backend/services/ai_strangle_bot.py` ✅ HAS getter functions
- [x] `AIDeltaStrangleBot` - in `backend/services/ai_delta_strangle_bot.py` ✅ HAS start() method
- [x] `AlgoTradingEngine` - in `backend/services/algo_trading_engine.py`

### ⚠️ Potential Issues:

1. **Routes use incorrect imports** - Some routes try to import functions that need to exist at module level
2. **Missing instance managers** - Not all bot services have proper `get_bot()` or `get_or_create_bot()` functions
3. **Broker connection validation** - Routes accept broker credentials but may not validate them properly

---

## Step-by-Step Fix

### Step 1: Ensure Bot Instance Managers Exist

All bot services should have these at the module level:

```python
# At end of vwap_trading_bot.py
_vwap_bot_instance = None

def get_vwap_bot(unified_service=None, broker_service=None) -> VWAPTradingBot:
    """Get or create VWAP bot instance"""
    global _vwap_bot_instance
    if _vwap_bot_instance is None:
        _vwap_bot_instance = VWAPTradingBot(...)
    return _vwap_bot_instance

# Status: ✅ ALREADY EXISTS
```

```python
# At end of ai_strangle_bot.py
_ai_strangle_bots: Dict[str, AIStrangleBot] = {}

def get_or_create_ai_strangle_bot(user_id: str, broker_service, access_token, broker) -> AIStrangleBot:
    """Get or create AI Strangle bot"""
    if user_id not in _ai_strangle_bots:
        _ai_strangle_bots[user_id] = AIStrangleBot(...)
    return _ai_strangle_bots[user_id]

def get_ai_strangle_bot(user_id: str) -> Optional[AIStrangleBot]:
    """Get existing AI Strangle bot"""
    return _ai_strangle_bots.get(user_id)

# Status: ✅ ALREADY EXISTS
```

```python
# At end of algo_trading_engine.py
_active_bots: Dict[str, AlgoTradingEngine] = {}

def get_or_create_bot(user_id: str, broker_service, access_token, broker) -> AlgoTradingEngine:
    """Get or create Delta Neutral bot"""
    if user_id not in _active_bots:
        _active_bots[user_id] = AlgoTradingEngine(...)
    return _active_bots[user_id]

def get_bot(user_id: str) -> Optional[AlgoTradingEngine]:
    """Get existing bot"""
    return _active_bots.get(user_id)

# Status: ✅ ALREADY EXISTS
```

### Step 2: Test the Endpoints

**Run the test script:**
```bash
cd backend
python test_bot_endpoints.py
```

This will check if:
- ✅ Server is running
- ✅ Routes are accessible
- ✅ Bot services initialize correctly
- ✅ Start command works

### Step 3: Check Broker Connection

When starting a bot, the backend now validates broker credentials:

```python
# Example from routes - this validates the connection
try:
    funds = await broker_service.get_fund_limits()
    if not funds.get("success"):
        return {
            "success": False,
            "error": "Failed to connect to broker. Check your access token.",
        }
except Exception as e:
    return {
        "success": False,
        "error": f"Broker connection failed: {str(e)}",
    }
```

**Check that your Dhan/Upstox access token is valid:**
- Dhan: https://web.dhan.co → Profile → API Access
- Upstox: https://developer.upstox.com → Your App

### Step 4: Start Bot in Mock Mode (For Testing)

This doesn't require real broker credentials:

```bash
curl -X POST http://localhost:8001/api/trade-algo/vwap-bot/start \
  -H "Content-Type: application/json" \
  -d '{
    "broker": "dhan",
    "user_id": "test",
    "mock_mode": true,
    "scenario": "bullish"
  }'
```

Expected response:
```json
{
  "status": "success",
  "message": "VWAP Momentum Bot started [MOCK MODE]",
  "mock_mode": true,
  "scenario": "bullish",
  "bot_status": {
    "status": "running",
    "is_running": true,
    "mock_mode": true,
    ...
  }
}
```

### Step 5: Trigger Scan (For Serverless/Testing)

Mock trades won't execute automatically. Trigger manually:

```bash
curl -X POST http://localhost:8001/api/trade-algo/vwap-bot/scan
```

This runs ONE scan iteration and returns any trades found.

---

## Expected Flow for Live Trading

1. **Frontend calls** `/api/trade-algo/vwap-bot/start` with broker token
2. **Backend validates** broker connection using `get_fund_limits()`
3. **Bot starts scanning** for signals every 60 seconds (configurable)
4. **Signals found** → Bot places orders via Dhan API
5. **Orders execute** → Real trades are placed on NSE
6. **P&L tracked** → Real money made/lost

---

## Testing Checklist

- [ ] Server is running on `http://localhost:8001`
- [ ] Can access `/api/health` endpoint
- [ ] Can access `/api/trade-algo/vwap-bot/status`
- [ ] Can start bot in mock mode
- [ ] Can manually call `/scan` and see mock trades
- [ ] Dhan access token is valid (test with `/api/trade-algo/test-upstox` or similar)
- [ ] Frontend connects to correct backend URL

---

## Common Issues & Solutions

### Issue 1: "Bot is not available"
**Solution:** Make sure the bot service is imported correctly. Check:
```python
from services.vwap_trading_bot import get_vwap_bot
```

### Issue 2: "Broker connection failed"
**Solution:** Your Dhan/Upstox token is invalid or expired. Get a new one:
- Dhan: Refresh token at https://web.dhan.co/settings/api
- Upstox: Re-authenticate at /api/trade-algo/upstox/oauth-url

### Issue 3: "No signals found" / "Mock trades not executing"
**Solution:** 
- Make sure to call `/scan` endpoint (background loop doesn't run in serverless)
- Use mock mode with specific market scenario
- Check bot logs with `GET /api/bot/logs?bot_id=vwap`

### Issue 4: "Market hours validation"
**Solution:** Bots enforce IST market hours (09:15-15:30):
- Use mock_mode=true to test outside market hours
- Or run tests with IST timezone

---

## Code File Locations

Key files you edited/need to check:

1. **Routes (Entry Points)**
   - `backend/routes/trade_algo_routes.py` - Line 60-2685 (all bot routes)

2. **Bot Services (Execution)**
   - `backend/services/vwap_trading_bot.py` - VWAP bot logic
   - `backend/services/ai_strangle_bot.py` - AI Strangle bot
   - `backend/services/ai_delta_strangle_bot.py` - AI Delta Strangle bot
   - `backend/services/algo_trading_engine.py` - Delta Neutral engine

3. **Broker Integration**
   - `backend/services/dhan_service.py` - Dhan API wrapper
   - `backend/services/upstox_service.py` - Upstox API wrapper

4. **Frontend**
   - `frontend/src/pages/AlgoTrading.js` - UI calling the endpoints

---

## Next Steps

1. **Verify all bot routes are registered** in `server.py`:
   ```python
   try:
       from routes.trade_algo_routes import router as trade_algo_router
       api_router.include_router(trade_algo_router)
       logging.info("✅ Trade Algo routes loaded")
   except ImportError as e:
       logging.error(f"❌ Trade Algo routes failed: {e}")
   ```

2. **Test bot endpoints** using the test script

3. **Check bot logs** for any errors

4. **Enable debugging** if needed:
   ```python
   logging.basicConfig(level=logging.DEBUG)
   ```

5. **Monitor frontend network calls** - Open DevTools → Network tab → Filter "algo"

---

## Success Indicators

When bots are working correctly, you should see:

```
✅ Bot started: VWAP_momentum_scan_001_1726...
✅ VWAP Bot started for user test_user (mock_mode=False)
📊 VWAP Scan: Found 5 signals
✅ Trade executed: LONG INFY @ ₹1850.50
🎯 Closed INFY: TARGET_HIT | P&L: ₹245.00
```

---

## Emergency Contacts & Resources

- **Dhan Documentation**: https://docs.dhan.co
- **Upstox Documentation**: https://upstox.com/developer
- **Bot Test Endpoint**: `POST http://localhost:8001/api/debug/time` - Check server time

---

**Report Generated:** Feb 19, 2026  
**Issue Status:** IDENTIFIED & ROUTES VERIFIED  
**Next Action:** Test endpoints and validate broker connection
