# 🔧 Netlify Deployment Fix for BlockPay

## ⚠️ Issue: API Routes Returning 404

Your API endpoints (`/api/health`, `/api/setup`) are returning 404 because Netlify is a static hosting platform and needs special configuration to serve your Express backend.

---

## 🎯 Solution Options

### Option 1: Separate Backend Server (Recommended)

Deploy your backend to a Node.js hosting service (Railway, Render, Heroku, etc.) and proxy API requests:

1. **Deploy Backend Separately:**
   - Use Railway, Render, or similar
   - Deploy your Express server
   - Get your backend URL (e.g., `https://blockpay-api.railway.app`)

2. **Update Netlify Configuration:**
   Edit `netlify.toml` and replace:
   ```toml
   to = "https://your-backend-server.com/api/:splat"
   ```
   With your actual backend URL:
   ```toml
   to = "https://blockpay-api.railway.app/api/:splat"
   ```

3. **Set Environment Variable:**
   In Netlify dashboard:
   - Go to Site settings → Environment variables
   - Add: `BACKEND_URL=https://blockpay-api.railway.app`

---

### Option 2: Netlify Functions (Serverless)

If you want everything on Netlify:

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy Functions:**
   The `netlify/functions/api.js` file is already created.

3. **Update netlify.toml:**
   Change the redirect to:
   ```toml
   [[redirects]]
     from = "/api/*"
     to = "/.netlify/functions/api/:splat"
     status = 200
   ```

---

### Option 3: Quick Fix - Railway/Render (Easiest)

**Railway (Recommended):**

1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select your repo
4. Add environment variables:
   - `CHANGENOW_API_KEY=1cda159504a3b708495e678ee620d58664c840f5a5cd341e6fb51f04ee79572b`
   - `NODE_ENV=production`
   - `PORT=3001`
5. Railway gives you a URL like: `https://blockpay-production.up.railway.app`
6. Update `netlify.toml` with that URL

**Render (Alternative):**

1. Go to https://render.com
2. New → Web Service
3. Connect GitHub repo
4. Set:
   - Build: `npm install`
   - Start: `npm start`
   - Environment: `Node`
5. Add environment variables (same as Railway)
6. Get your URL and update `netlify.toml`

---

## 📝 Quick Fix Steps

### Step 1: Deploy Backend

Choose one:
- **Railway**: https://railway.app (Free tier available)
- **Render**: https://render.com (Free tier available)
- **Fly.io**: https://fly.io (Free tier available)

### Step 2: Update netlify.toml

Replace the backend URL in `netlify.toml`:
```toml
from = "/api/*"
to = "https://YOUR-BACKEND-URL.com/api/:splat"
```

### Step 3: Redeploy

```bash
git add netlify.toml
git commit -m "Fix Netlify API routing"
git push origin main
```

Netlify will auto-deploy!

---

## ✅ What I've Created

1. **`netlify.toml`** - Netlify configuration
2. **`netlify/functions/api.js`** - Serverless function (optional)
3. **`NETLIFY_SETUP.md`** - This guide

---

## 🚀 Recommended: Railway Deployment

**Why Railway:**
- ✅ Free tier
- ✅ Easy setup
- ✅ Auto-deploys from GitHub
- ✅ Custom domain support
- ✅ SSL included

**Steps:**
1. Sign up at https://railway.app
2. New Project → Deploy from GitHub
3. Select your repo
4. Add environment variables
5. Copy the URL they give you
6. Update `netlify.toml` with that URL
7. Done!

---

## 🔍 Verify It Works

After setup:
- ✅ `https://blockpay.cloud/` - Frontend works
- ✅ `https://blockpay.cloud/api/health` - API works
- ✅ `https://blockpay.cloud/api/setup` - Setup status works

---

**The backend needs to run on a Node.js server. Netlify only hosts static files, so we need to proxy API requests to your backend server!**

