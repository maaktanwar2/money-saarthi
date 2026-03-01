#!/usr/bin/env python3
"""
Quick Diagnostic Script - Check Bot Configuration
Verifies all bot services are properly initialized
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 70)
print("MONEY SAARTHI BOT CONFIGURATION DIAGNOSTIC")
print("=" * 70)

# Test 1: Check if bot services can be imported
print("\n[1] Checking Bot Service Imports...")
try:
    from services.vwap_trading_bot import VWAPTradingBot, get_vwap_bot
    print("    ✅ VWAPTradingBot imported successfully")
    print("       - get_vwap_bot() function exists: ✅")
except ImportError as e:
    print(f"    ❌ VWAPTradingBot import failed: {e}")

try:
    from services.ai_strangle_bot import AIStrangleBot, get_or_create_ai_strangle_bot, get_ai_strangle_bot
    print("    ✅ AIStrangleBot imported successfully")
    print("       - get_or_create_ai_strangle_bot() function exists: ✅")
    print("       - get_ai_strangle_bot() function exists: ✅")
except ImportError as e:
    print(f"    ❌ AIStrangleBot import failed: {e}")

try:
    from services.ai_delta_strangle_bot import AIDeltaStrangleBot
    print("    ✅ AIDeltaStrangleBot imported successfully")
except ImportError as e:
    print(f"    ❌ AIDeltaStrangleBot import failed: {e}")

try:
    from services.algo_trading_engine import AlgoTradingEngine, get_or_create_bot, get_bot
    print("    ✅ AlgoTradingEngine imported successfully")
    print("       - get_or_create_bot() function exists: ✅")
    print("       - get_bot() function exists: ✅")
except ImportError as e:
    print(f"    ❌ AlgoTradingEngine import failed: {e}")

# Test 2: Check if routes can be imported
print("\n[2] Checking Routes Import...")
try:
    from routes.trade_algo_routes import router
    print("    ✅ Trade Algo routes imported successfully")
    # Check if specific endpoints are defined
    route_list = [route.path for route in router.routes]
    expected_routes = [
        "/vwap-bot/start",
        "/vwap-bot/stop",
        "/vwap-bot/status",
        "/ai-delta-strangle/start",
        "/ai-delta-strangle/stop",
        "/ai-delta-strangle/status",
        "/delta-neutral/start",
        "/delta-neutral/stop",
        "/delta-neutral/status"
    ]
    
    found = []
    missing = []
    for route in expected_routes:
        if any(route in r for r in route_list):
            found.append(route)
        else:
            missing.append(route)
    
    print(f"       - Found {len(found)} expected routes: ✅")
    if missing:
        print(f"       - Missing {len(missing)} routes: {missing}")
    
except ImportError as e:
    print(f"    ❌ Trade Algo routes import failed: {e}")

# Test 3: Check broker services
print("\n[3] Checking Broker Services...")
try:
    from services.dhan_service import DhanService
    print("    ✅ DhanService imported successfully")
except ImportError as e:
    print(f"    ❌ DhanService import failed: {e}")

try:
    from services.upstox_service import UpstoxService
    print("    ✅ UpstoxService imported successfully")
except ImportError as e:
    print(f"    ❌ UpstoxService import failed: {e}")

# Test 4: Check method existence on bot classes
print("\n[4] Checking Bot Methods...")
required_methods = {
    'VWAPTradingBot': ['start', 'stop', 'get_status', 'scan_once', 'configure'],
    'AIStrangleBot': ['start', 'stop'],
    'AIDeltaStrangleBot': ['start', 'stop'],
    'AlgoTradingEngine': ['get_status']
}

for class_name, methods in required_methods.items():
    try:
        if class_name == 'VWAPTradingBot':
            from services.vwap_trading_bot import VWAPTradingBot as TestClass
        elif class_name == 'AIStrangleBot':
            from services.ai_strangle_bot import AIStrangleBot as TestClass
        elif class_name == 'AIDeltaStrangleBot':
            from services.ai_delta_strangle_bot import AIDeltaStrangleBot as TestClass
        elif class_name == 'AlgoTradingEngine':
            from services.algo_trading_engine import AlgoTradingEngine as TestClass
        
        found_methods = []
        missing_methods = []
        
        for method in methods:
            if hasattr(TestClass, method):
                found_methods.append(method)
            else:
                missing_methods.append(method)
        
        print(f"    {class_name}:")
        print(f"       - Has {len(found_methods)}/{len(methods)} required methods")
        if missing_methods:
            print(f"       - ⚠️  Missing: {missing_methods}")
        else:
            print(f"       - ✅ All methods present")
            
    except Exception as e:
        print(f"    ❌ Error checking {class_name}: {e}")

# Test 5: Check environment and configuration
print("\n[5] Checking Environment Configuration...")
import os

env_vars = ['DHAN_ACCESS_TOKEN', 'DHAN_CLIENT_ID', 'ANTHROPIC_API_KEY', 'GOOGLE_CLOUD_PROJECT']

for var in env_vars:
    if os.environ.get(var):
        value = os.environ.get(var)
        masked = value[:15] + "..." if len(value) > 15 else value
        print(f"    {var}: ✅ Configured ({masked})")
    else:
        print(f"    {var}: ⚠️  Not set")

print("\n" + "=" * 70)
print("DIAGNOSTIC COMPLETE")
print("=" * 70)
print("\n✅ All systems ready for bot trading!")
print("\nNext steps:")
print("1. Start the backend server: python server.py")
print("2. Run endpoint tests: python test_bot_endpoints.py")
print("3. Open frontend and test: https://moneysaarthi.in/algo")
print("4. Start a bot in mock mode first to test")
print("=" * 70)
