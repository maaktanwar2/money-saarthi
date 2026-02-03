# 🚀 Money Saarthi - Deployment Guide

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB (local or MongoDB Atlas)
- Google Cloud Console account (for OAuth)

## 🔑 Google OAuth Setup

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services** → **Credentials**

### Step 2: Configure OAuth Consent Screen
1. Click **Configure Consent Screen**
2. Choose **External** (for public users)
3. Fill in:
   - App name: `Money Saarthi`
   - User support email: Your email
   - Developer contact email: Your email
4. Add scopes: `email`, `profile`, `openid`
5. Add test users if in testing mode

### Step 3: Create OAuth Client ID
1. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
2. Application type: **Web application**
3. Name: `Money Saarthi Web`
4. Add Authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - `https://yourdomain.com` (production)
5. Copy the **Client ID**

## ⚙️ Environment Setup

### Backend (.env file in `/backend`)
```env
# MongoDB
MONGO_URL=mongodb://localhost:27017
DB_NAME=money_saarthi

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Admin
SUPER_ADMIN_EMAIL=your-email@gmail.com

# CORS (comma-separated)
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

# Optional: Payment Integration
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# Optional: Stock API Providers (default: Yahoo Finance - no key needed)
API_PROVIDER=yahoo_finance
# UPSTOX_API_KEY=
# DHAN_ACCESS_TOKEN=
```

### Frontend (.env file in `/frontend`)
```env
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

## 🖥️ Local Development

### Backend
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend
```bash
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm start
```

## 🌐 Production Deployment

### Option 1: Vercel (Frontend) + Railway (Backend)

#### Frontend on Vercel
```bash
cd frontend
npm install -g vercel
vercel

# Set environment variables in Vercel dashboard:
# REACT_APP_BACKEND_URL=https://your-backend.railway.app
# REACT_APP_GOOGLE_CLIENT_ID=your-client-id
```

#### Backend on Railway
1. Create account at [Railway](https://railway.app)
2. Connect your GitHub repo
3. Add environment variables
4. Railway auto-deploys on push

### Option 2: VPS Deployment (DigitalOcean, AWS EC2, etc.)

```bash
# Install dependencies
sudo apt update
sudo apt install python3-pip nodejs npm nginx

# Clone repo
git clone your-repo-url
cd money-saarthi

# Setup backend
cd backend
pip3 install -r requirements.txt

# Setup frontend
cd ../frontend
npm install --legacy-peer-deps
npm run build

# Configure nginx
sudo nano /etc/nginx/sites-available/moneysaarthi
```

Example nginx config:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /path/to/frontend/build;
        try_files $uri /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option 3: Docker Deployment

```dockerfile
# Backend Dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]

# Frontend Dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
```

## 🔒 SSL/HTTPS Setup

### Using Certbot (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## 📱 Mobile App (Future)

For mobile deployment, consider:
- **Capacitor**: Wrap React app as native
- **React Native**: Full native port
- **PWA**: Progressive Web App (works now!)

## ✅ Post-Deployment Checklist

- [ ] Google OAuth working
- [ ] MongoDB connected
- [ ] CORS configured for production domain
- [ ] SSL certificate active
- [ ] Admin email set for super admin access
- [ ] Test all routes and features
- [ ] Set up monitoring (optional: PM2 for Node, Supervisor for Python)

## 🆘 Troubleshooting

### Google OAuth not working
1. Check `GOOGLE_CLIENT_ID` is set in both frontend and backend
2. Verify authorized JavaScript origins include your domain
3. Check browser console for errors

### CORS errors
1. Add your frontend domain to `CORS_ORIGINS` in backend .env
2. Restart backend server

### MongoDB connection failed
1. Check `MONGO_URL` is correct
2. Ensure MongoDB is running
3. For Atlas: whitelist your server IP

---

**Need help?** Open an issue on GitHub or contact support.
