# MoneySaarthi API Reference Guide

## Primary Data Source: Dhan API v2

Base URL: `https://api.dhan.co/v2`

### Authentication

```
Headers:
- access-token: JWT
- client-id: User ID from Dhan
```

---

## 1. MARKET DATA APIs (Real-time)

### 1.1 LTP (Last Traded Price)

```
POST /marketfeed/ltp
Rate Limit: 1 request/second, max 1000 instruments

Request:
{
    "NSE_EQ": [1333, 11536],
    "NSE_FNO": [49081],
    "IDX_I": [13]
}

Response:
{
    "data": {
        "NSE_EQ": {
            "1333": {"last_price": 1650.50}
        }
    },
    "status": "success"
}
```

### 1.2 OHLC Data

```
POST /marketfeed/ohlc
Rate Limit: 1 request/second

Request: Same as LTP

Response:
{
    "data": {
        "NSE_EQ": {
            "1333": {
                "last_price": 1652.30,
                "ohlc": {"open": 1640, "close": 1650, "high": 1660, "low": 1635}
            }
        }
    }
}
```

### 1.3 Full Quote (with Market Depth)

```
POST /marketfeed/quote
Rate Limit: 1 request/second

Response includes:
- LTP, OHLC, Volume, OI
- 5-level market depth (bid/ask)
- Circuit limits
- Net change
```

---

## 2. HISTORICAL DATA APIs

### 2.1 Daily Candles

```
POST /charts/historical
No rate limit

Request:
{
    "securityId": "1333",
    "exchangeSegment": "NSE_EQ",
    "instrument": "EQUITY",
    "expiryCode": 0,
    "oi": false,
    "fromDate": "2024-01-01",
    "toDate": "2024-12-31"
}

Response:
{
    "open": [100.5, 101.2, ...],
    "high": [102, 103, ...],
    "low": [99, 100, ...],
    "close": [101, 102, ...],
    "volume": [1000000, 1200000, ...],
    "timestamp": [1641220200, 1641306600, ...],
    "open_interest": [0, 0, ...]
}
```

### 2.2 Intraday Candles

```
POST /charts/intraday
No rate limit (max 90 days per request)

Request:
{
    "securityId": "1333",
    "exchangeSegment": "NSE_EQ",
    "instrument": "EQUITY",
    "interval": "5",           // 1, 5, 15, 25, 60 minutes
    "oi": false,
    "fromDate": "2024-09-11 09:30:00",
    "toDate": "2024-09-15 15:30:00"
}
```

---

## 3. OPTION CHAIN APIs

### 3.1 Option Chain

```
POST /optionchain
Rate Limit: 1 request/3 seconds

Request:
{
    "UnderlyingScrip": 13,        // Security ID (NIFTY = 13)
    "UnderlyingSeg": "IDX_I",
    "Expiry": "2024-10-31"
}

Response:
{
    "data": {
        "last_price": 25642.8,
        "oc": {
            "25650.000000": {
                "ce": {
                    "last_price": 134,
                    "oi": 3786445,
                    "volume": 117567970,
                    "implied_volatility": 9.79,
                    "greeks": {
                        "delta": 0.538,
                        "theta": -15.15,
                        "gamma": 0.00132,
                        "vega": 12.18
                    },
                    "security_id": 42528,
                    "top_bid_price": 133.55,
                    "top_ask_price": 134
                },
                "pe": {
                    "last_price": 132.8,
                    "oi": 3096145,
                    ...
                }
            }
        }
    }
}
```

### 3.2 Expiry List

```
POST /optionchain/expirylist
Rate Limit: 1 request/3 seconds

Request:
{
    "UnderlyingScrip": 13,
    "UnderlyingSeg": "IDX_I"
}

Response:
{
    "data": ["2024-10-17", "2024-10-24", "2024-10-31", ...],
    "status": "success"
}
```

---

## 4. ORDER MANAGEMENT APIs

### 4.1 Place Order

```
POST /orders
Requires Static IP Whitelisting

Request:
{
    "dhanClientId": "1000000003",
    "correlationId": "order123",
    "transactionType": "BUY",        // BUY, SELL
    "exchangeSegment": "NSE_EQ",
    "productType": "INTRADAY",       // CNC, INTRADAY, MARGIN, MTF, CO, BO
    "orderType": "MARKET",           // LIMIT, MARKET, STOP_LOSS, STOP_LOSS_MARKET
    "validity": "DAY",               // DAY, IOC
    "securityId": "1333",
    "quantity": "5",
    "price": "",                     // For LIMIT orders
    "triggerPrice": ""               // For SL orders
}
```

### 4.2 Modify Order

```
PUT /orders/{order-id}
```

### 4.3 Cancel Order

```
DELETE /orders/{order-id}
```

### 4.4 Order Book

```
GET /orders
```

### 4.5 Trade Book

```
GET /trades
```

---

## 5. PORTFOLIO APIs

### 5.1 Holdings

```
GET /holdings

Response:
[{
    "tradingSymbol": "HDFCBANK",
    "securityId": "1330",
    "totalQty": 100,
    "avgCostPrice": 1600.0,
    "dpQty": 100,
    "t1Qty": 0
}]
```

### 5.2 Positions

```
GET /positions

Response:
[{
    "tradingSymbol": "RELIANCE",
    "securityId": "2885",
    "positionType": "LONG",
    "productType": "INTRADAY",
    "buyQty": 10,
    "sellQty": 0,
    "netQty": 10,
    "realizedProfit": 0,
    "unrealizedProfit": 500
}]
```

### 5.3 Convert Position

```
POST /positions/convert
```

### 5.4 Exit All Positions

```
DELETE /positions
```

---

## 6. FUNDS & MARGIN

### 6.1 Fund Limit

```
GET /fundlimit

Response:
{
    "sodLimit": 100000,
    "availableBalance": 85000,
    "utilizedAmount": 15000,
    "collateral": 25000
}
```

### 6.2 Margin Calculator

```
POST /margincalculator
```

---

## EXCHANGE SEGMENTS

| Segment | Description |
|---------|-------------|
| IDX_I | Indices (NIFTY, BANKNIFTY) |
| NSE_EQ | NSE Cash Equity |
| NSE_FNO | NSE F&O |
| BSE_EQ | BSE Cash Equity |
| BSE_FNO | BSE F&O |
| MCX_COMM | MCX Commodities |
| NSE_CURRENCY | NSE Currency |
| BSE_CURRENCY | BSE Currency |

---

## INSTRUMENT TYPES

| Type | Description |
|------|-------------|
| INDEX | Index |
| EQUITY | Cash Equity |
| FUTIDX | Index Futures |
| OPTIDX | Index Options |
| FUTSTK | Stock Futures |
| OPTSTK | Stock Options |

---

## SECURITY ID MAP (Key Stocks)

| Symbol | Security ID | Segment |
|--------|-------------|---------|
| NIFTY | 13 | IDX_I |
| BANKNIFTY | 25 | IDX_I |
| RELIANCE | 2885 | NSE_EQ |
| TCS | 11536 | NSE_EQ |
| HDFCBANK | 1333 | NSE_EQ |
| INFY | 1594 | NSE_EQ |
| ICICIBANK | 4963 | NSE_EQ |
| SBIN | 3045 | NSE_EQ |
| BHARTIARTL | 10604 | NSE_EQ |
| HINDUNILVR | 1394 | NSE_EQ |
| ITC | 1660 | NSE_EQ |
| LT | 11483 | NSE_EQ |
| KOTAKBANK | 1922 | NSE_EQ |
| AXISBANK | 5900 | NSE_EQ |
| BAJFINANCE | 317 | NSE_EQ |
| MARUTI | 10999 | NSE_EQ |
| TITAN | 3506 | NSE_EQ |
| WIPRO | 3787 | NSE_EQ |
| TATASTEEL | 3499 | NSE_EQ |
| TATAMOTORS | 3456 | NSE_EQ |
| SUNPHARMA | 3351 | NSE_EQ |
| HCLTECH | 7229 | NSE_EQ |
| TECHM | 13538 | NSE_EQ |
| M&M | 2031 | NSE_EQ |
| NTPC | 11630 | NSE_EQ |
| POWERGRID | 14977 | NSE_EQ |
| ASIANPAINT | 236 | NSE_EQ |
| NESTLEIND | 17963 | NSE_EQ |
| ULTRACEMCO | 11532 | NSE_EQ |
| ONGC | 2475 | NSE_EQ |
| JSWSTEEL | 11723 | NSE_EQ |
| COALINDIA | 20374 | NSE_EQ |
| DRREDDY | 881 | NSE_EQ |
| CIPLA | 694 | NSE_EQ |

---

## RATE LIMITS SUMMARY

| API Group | Limit |
|-----------|-------|
| Orders | 10/sec, 250/min, 1000/hr, 7000/day |
| Portfolio | 5/sec |
| Market Quote | 1/sec (max 1000 instruments) |
| Chart Data | 20/sec |
| Option Chain | 1 request/3 seconds |

---

## NSE FALLBACK (When Dhan unavailable)

Base URL: `https://www.nseindia.com/api`

Key Endpoints:

- `/equity-stockIndices?index=NIFTY%2050` - Index data
- `/option-chain-indices?symbol=NIFTY` - Option chain
- `/marketStatus` - Market status

Requires cookie handling for authentication.

---

## FILE STRUCTURE

```
backend/services/
├── dhan_unified_service.py    # PRIMARY - All Dhan API v2
├── dhan_service.py            # Legacy Dhan service
├── dhan_market_data.py        # Real-time market data
├── dhan_websocket.py          # WebSocket feeds
├── unified_data_service.py    # NSE fallback (legacy)
└── firestore_db.py            # Database
```

## SERVICES IN USE

| Service | Purpose | Status |
|---------|---------|--------|
| dhan_unified_service | All market data | PRIMARY |
| firestore_db | Database | ACTIVE |
| dhan_websocket | Live feeds | ACTIVE |
| nifty_strategies | Strategy logic | ACTIVE |
| trade_algo_service | Algo trading | ACTIVE |
| unified_data_service | NSE fallback | FALLBACK |

## DEPRECATED/UNUSED

| File | Reason |
|------|--------|
| mock_data_service.py | Testing only |
| upstox_service.py | Alternative broker (not used) |
| broker_integration.py | Generic (replaced by Dhan) |
