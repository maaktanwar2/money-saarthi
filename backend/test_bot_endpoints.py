#!/usr/bin/env python3
"""
Test script to verify bot endpoints are working
"""
import asyncio
import httpx
import json

API_BASE = "http://localhost:8001/api"

async def test_endpoints():
    async with httpx.AsyncClient() as client:
        print("=" * 60)
        print("TESTING BOT ENDPOINTS")
        print("=" * 60)
        
        # Test 1: Check if server is running
        try:
            resp = await client.get(f"{API_BASE}/health")
            print(f"✅ Server Status: {resp.status_code}")
            print(f"   {resp.json()}")
        except Exception as e:
            print(f"❌ Server not responding: {e}")
            return
        
        # Test 2: Check VWAP bot status endpoint
        print("\n" + "=" * 60)
        print("Testing VWAP Bot Status")
        print("=" * 60)
        try:
            resp = await client.get(f"{API_BASE}/trade-algo/vwap-bot/status")
            print(f"Status Code: {resp.status_code}")
            print(f"Response: {json.dumps(resp.json(), indent=2)}")
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # Test 3: Check AI Delta Strangle status
        print("\n" + "=" * 60)
        print("Testing AI Delta Strangle Status")
        print("=" * 60)
        try:
            resp = await client.get(f"{API_BASE}/trade-algo/ai-delta-strangle/status")
            print(f"Status Code: {resp.status_code}")
            print(f"Response: {json.dumps(resp.json(), indent=2)}")
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # Test 4: Check Delta Neutral status
        print("\n" + "=" * 60)
        print("Testing Delta Neutral Bot Status")
        print("=" * 60)
        try:
            resp = await client.get(f"{API_BASE}/trade-algo/delta-neutral/status")
            print(f"Status Code: {resp.status_code}")
            print(f"Response: {json.dumps(resp.json(), indent=2)}")
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # Test 5: Try starting VWAP bot in mock mode
        print("\n" + "=" * 60)
        print("Testing VWAP Bot Start (Mock Mode)")
        print("=" * 60)
        try:
            payload = {
                "broker": "dhan",
                "user_id": "test_user",
                "mock_mode": True,
                "scenario": "bullish"
            }
            resp = await client.post(
                f"{API_BASE}/trade-algo/vwap-bot/start",
                json=payload,
                headers={"Authorization": "Bearer test_token"}  # Mock token
            )
            print(f"Status Code: {resp.status_code}")
            print(f"Response: {json.dumps(resp.json(), indent=2)}")
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("Starting bot endpoint tests...")
    asyncio.run(test_endpoints())
    print("\n✅ Tests completed!")
