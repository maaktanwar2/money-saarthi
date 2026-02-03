# Money Saarthi 5 - Your Smart Financial Companion

**Version:** 5.0 (Clean Build - Google Cloud)  
**Tagline:** Your Smart Financial Companion for F&O Trading

## 🏗️ Architecture

```
Frontend: Firebase Hosting (moneysaarthi.in)
Backend:  Google Cloud Run (asia-south1)
Database: Google Cloud Firestore
Data:     Dhan API → Yahoo Finance fallback
```

## 🎯 What is Money Saarthi?

Money Saarthi (meaning "Financial Guide" in Hindi) is a comprehensive F&O trading platform designed for Indian traders. It provides real-time market data, advanced scanners, and educational resources to help traders make informed decisions.

## ✨ Features

### 📊 Live Trading Scanners
- **Day Gainers** - Top F&O gainers with volume & OI tracking
- **Day Losers** - Top F&O losers to watch
- **High Volume** - Stocks with unusually high trading volume
- **Swing Scanner** - EMA-based signals for swing trading
- **Sector Rotation** - Track sector performance and trends

### 🛠️ Trading Tools
- **Margin Calculator** - Accurate F&O margin requirements
- **Sector Insights** - Deep sector analysis
- **Watchlist** - Track your favorite stocks
- **Market Stats** - Live NIFTY, BANKNIFTY, VIX, PCR data
- **Auto-refresh** - Data updates automatically

### 📚 Learning Platform
- Comprehensive trading courses
- Price Action, Swing Trading strategies
- Video content integration

### 💰 Additional Features
- Crypto prices tracker
- Market calendar with events
- Market news feed

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB

### Setup

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd money-saarthi
```

2. **Backend Setup**
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
```

3. **Frontend Setup**
```bash
cd frontend
npm install --legacy-peer-deps
```

4. **Configure Environment**

Create `backend/.env`:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=money_saarthi
GOOGLE_CLIENT_ID=your-google-client-id
SUPER_ADMIN_EMAIL=your-admin@email.com
```

Create `frontend/.env`:
```env
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id
```

5. **Run the Application**

Backend:
```bash
cd backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Frontend:
```bash
cd frontend
npm start
```

Visit `http://localhost:3000`

## 🔐 Authentication

- Google OAuth 2.0 (Sign in with Google)
- Secure session management (7-day expiry)
- httpOnly cookies for security

## 🔧 Technology Stack

### Backend
- **FastAPI** - Modern Python web framework
- **MongoDB** - NoSQL database with Motor async driver
- **Yahoo Finance** - Real market data (no API key needed)
- **Technical Analysis** - TA library for indicators

### Frontend
- **React 19** - UI framework
- **Tailwind CSS** - Utility-first CSS
- **shadcn/ui** - UI component library
- **Lucide React** - Icons
- **React Router** - Navigation

## 📡 API Endpoints

### Authentication
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/logout` - Logout

### Scanners
- `GET /api/scanners/day-gainers` - Top gainers
- `GET /api/scanners/day-losers` - Top losers
- `GET /api/scanners/high-volume` - High volume stocks
- `GET /api/scanners/swing` - Swing opportunities
- `GET /api/scanners/sector-rotation` - Sector performance
- `GET /api/scanners/fno-by-sector` - F&O stocks by sector

### Tools & Data
- `GET /api/watchlist` - User watchlist
- `POST /api/watchlist` - Add to watchlist
- `GET /api/courses` - Trading courses
- `GET /api/strategies` - Trading strategies
- `GET /api/crypto/prices` - Crypto prices
- `GET /api/calendar/all` - Market calendar
- `GET /api/news` - Market news

### Admin
- `GET /api/admin/users` - User management
- `PUT /api/admin/users/{id}` - Update user

## 📱 Pages

| Route | Description |
|-------|-------------|
| `/login` | Google OAuth login |
| `/dashboard` | Main dashboard |
| `/scanners/gainers` | Day gainers |
| `/scanners/losers` | Day losers |
| `/scanners/high-volume` | High volume stocks |
| `/scanners/swing` | Swing scanner |
| `/scanners/sector-rotation` | Sector rotation |
| `/tools/margin-calculator` | Margin calculator |
| `/tools/sector-insights` | Sector insights |
| `/fno-stocks` | All F&O stocks |
| `/watchlist` | Personal watchlist |
| `/crypto` | Crypto tracker |
| `/news` | Market news |
| `/calendar` | Market calendar |
| `/courses` | Learning courses |
| `/strategies` | Trading strategies |
| `/pricing` | Subscription plans |
| `/admin` | Admin panel |

## 🎨 Design

- Dark mode optimized
- Purple & Pink gradient theme
- Glassmorphism effects
- Responsive design (mobile-first)
- Smooth animations

## 💡 Why "Money Saarthi"?

**Saarthi** (सारथी) in Hindi means "charioteer" or "guide" - someone who steers you in the right direction. Money Saarthi aims to be your trusted guide in navigating the complex world of F&O trading.

## 📖 Documentation

- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Complete deployment instructions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is proprietary software.

---

**Built with ❤️ for Indian Traders**  
**Money Saarthi - धन सारथी - Your Wealth Guide**
