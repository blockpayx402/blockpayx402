# 🚀 BlockPay Production Deployment Guide

## ✅ Your Site: https://blockpay.cloud/

Everything is configured for your production domain!

---

## 🌐 Production Configuration

### Frontend Configuration
- ✅ API URL: `https://blockpay.cloud/api`
- ✅ Auto-detects production domain
- ✅ Works with `blockpay.cloud`

### Backend Configuration
- ✅ CORS enabled for `blockpay.cloud`
- ✅ HTTPS support
- ✅ Production-ready

---

## 📋 Deployment Checklist

### 1. Server Configuration
- ✅ API endpoints: `/api/*`
- ✅ CORS: Configured for blockpay.cloud
- ✅ Environment: Production

### 2. Environment Variables
Make sure your production server has `.env` with:
```bash
CHANGENOW_API_KEY=1cda159504a3b708495e678ee620d58664c840f5a5cd341e6fb51f04ee79572b
NODE_ENV=production
PORT=3001  # Or your server's port
```

### 3. API Base URL
The frontend automatically uses:
- Production: `https://blockpay.cloud/api`
- Development: `http://localhost:3001/api`

---

## 🔧 Server Setup

### Option 1: Same Server (Recommended)
If your frontend and backend are on the same server:

1. **Build frontend:**
   ```bash
   npm run build
   ```

2. **Serve frontend:**
   - Serve `dist/` folder at `https://blockpay.cloud/`
   - Serve API at `https://blockpay.cloud/api/`

3. **Start backend:**
   ```bash
   npm start
   ```

### Option 2: Separate Servers
If frontend and backend are separate:

1. **Frontend Server:**
   - Deploy `dist/` to `https://blockpay.cloud/`
   - Set `VITE_API_URL=https://your-api-server.com/api`

2. **Backend Server:**
   - Deploy backend to your API server
   - Update CORS to allow `blockpay.cloud`

---

## 🌍 Domain Configuration

### Current Setup
- ✅ Domain: `blockpay.cloud`
- ✅ API: `https://blockpay.cloud/api`
- ✅ CORS: Configured for domain

### Nginx Configuration (Example)
```nginx
server {
    listen 443 ssl;
    server_name blockpay.cloud www.blockpay.cloud;

    # Frontend
    location / {
        root /path/to/dist;
        try_files $uri $uri/ /index.html;
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## ✅ What's Already Configured

- ✅ API URL auto-detection
- ✅ CORS for blockpay.cloud
- ✅ Production domain support
- ✅ HTTPS ready
- ✅ Environment detection

---

## 🚀 Quick Deploy

1. **Build:**
   ```bash
   npm run build
   ```

2. **Deploy `dist/` folder** to your hosting

3. **Start backend** on your server:
   ```bash
   npm start
   ```

4. **That's it!** Your site is live at https://blockpay.cloud/

---

## 🔍 Verify Deployment

1. **Check frontend:**
   - Visit: https://blockpay.cloud/
   - Should load the app

2. **Check API:**
   - Visit: https://blockpay.cloud/api/health
   - Should return: `{"status":"ok"}`

3. **Check setup:**
   - Visit: https://blockpay.cloud/api/setup
   - Should show setup status

---

## 📝 Notes

- No localhost needed in production
- API automatically uses `blockpay.cloud/api`
- All CORS configured
- HTTPS ready
- Production-ready!

---

**Your site is ready at https://blockpay.cloud/!** 🎉

