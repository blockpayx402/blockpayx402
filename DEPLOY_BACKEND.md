# 🚀 Deploy Backend to Railway (5 Minutes)

## Quick Deploy Your Backend

### Step 1: Go to Railway
Visit: https://railway.app

### Step 2: Sign Up / Login
- Click "Start a New Project"
- Sign up with GitHub

### Step 3: Deploy from GitHub
1. Click "Deploy from GitHub repo"
2. Select your `payment-cloud-system` repository
3. Railway will detect it's a Node.js project

### Step 4: Add Environment Variables
Click on your service → Variables tab → Add:

```
CHANGENOW_API_KEY=1cda159504a3b708495e678ee620d58664c840f5a5cd341e6fb51f04ee79572b
NODE_ENV=production
PORT=3001
BLOCKPAY_FEE_PERCENT=0.01
BLOCKPAY_MIN_FEE_USD=0.10
BLOCKPAY_MAX_FEE_USD=0
```

### Step 5: Get Your URL
1. Railway will generate a URL like: `https://blockpay-production-xxxx.up.railway.app`
2. Copy this URL

### Step 6: Update netlify.toml
Edit `netlify.toml` and replace:
```toml
to = "https://blockpay-api-production.up.railway.app/api/:splat"
```
With your actual Railway URL.

### Step 7: Commit & Push
```bash
git add netlify.toml
git commit -m "Update backend URL for Railway"
git push origin main
```

### Step 8: Done! ✅
- Railway hosts your backend
- Netlify proxies API requests
- Everything works at blockpay.cloud!

---

## Alternative: Render.com

Same process, but:
1. Go to https://render.com
2. New → Web Service
3. Connect GitHub
4. Use `render.yaml` I created
5. Add environment variables
6. Deploy!

---

**That's it! Your backend will be live and APIs will work!** 🎉

