# 🔧 Fix Netlify 404 Error - Complete Guide

## ⚠️ The Problem

Netlify is a **static hosting** platform. It can't run Node.js/Express servers directly. That's why `/api/health` and `/api/setup` return 404.

## ✅ The Solution

Deploy your backend separately and proxy API requests through Netlify.

---

## 🚀 Quick Fix (5 Minutes)

### Step 1: Deploy Backend to Railway

1. **Go to Railway:** https://railway.app
2. **Sign up** with GitHub (free)
3. **New Project** → **Deploy from GitHub repo**
4. **Select your repo:** `payment-cloud-system`
5. **Railway auto-detects** Node.js and starts deploying

### Step 2: Add Environment Variables

In Railway dashboard → Your service → Variables:

```
CHANGENOW_API_KEY=1cda159504a3b708495e678ee620d58664c840f5a5cd341e6fb51f04ee79572b
NODE_ENV=production
PORT=3001
BLOCKPAY_FEE_PERCENT=0.01
BLOCKPAY_MIN_FEE_USD=0.10
BLOCKPAY_MAX_FEE_USD=0
```

### Step 3: Get Your Railway URL

Railway gives you a URL like:
```
https://blockpay-production-xxxx.up.railway.app
```

### Step 4: Update netlify.toml

Edit `netlify.toml` and replace the backend URL with your Railway URL:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://YOUR-RAILWAY-URL.up.railway.app/api/:splat"
  status = 200
  force = true
```

### Step 5: Commit & Push

```bash
git add netlify.toml
git commit -m "Update backend URL for Railway"
git push origin main
```

Netlify will auto-redeploy!

### Step 6: Done! ✅

- ✅ `https://blockpay.cloud/` - Frontend works
- ✅ `https://blockpay.cloud/api/health` - API works
- ✅ `https://blockpay.cloud/api/setup` - Setup works

---

## 🎯 Alternative: Render.com

Same process:

1. Go to https://render.com
2. New → Web Service
3. Connect GitHub
4. Use the `render.yaml` I created
5. Add environment variables
6. Deploy and get URL
7. Update `netlify.toml`

---

## 📋 What I've Created

✅ **`netlify.toml`** - Netlify configuration  
✅ **`railway.json`** - Railway deployment config  
✅ **`render.yaml`** - Render deployment config  
✅ **`DEPLOY_BACKEND.md`** - Step-by-step guide  
✅ **`NETLIFY_SETUP.md`** - Detailed setup  

---

## 🔍 Verify It Works

After deployment:
1. Visit: `https://blockpay.cloud/api/health`
2. Should see: `{"status":"ok"}`
3. Visit: `https://blockpay.cloud/api/setup`
4. Should see setup status

---

## 💡 Why This Happens

- **Netlify**: Only serves static files (HTML, CSS, JS)
- **Your Backend**: Needs Node.js runtime (Express server)
- **Solution**: Run backend separately, proxy through Netlify

---

## 🎉 That's It!

Deploy backend to Railway → Update netlify.toml → Done!

Your APIs will work at `https://blockpay.cloud/api/*` 🚀

