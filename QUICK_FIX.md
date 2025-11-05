# ⚡ Quick Fix - Make Your APIs Work

## The Issue
Netlify can't run Node.js, so `/api/*` routes return 404.

## The Fix (5 Steps)

### 1️⃣ Deploy Backend to Railway
- Go to: https://railway.app
- Sign up with GitHub (free)
- New Project → Deploy from GitHub
- Select your repo
- Railway auto-deploys!

### 2️⃣ Add Environment Variables
In Railway → Your service → Variables:
```
CHANGENOW_API_KEY=1cda159504a3b708495e678ee620d58664c840f5a5cd341e6fb51f04ee79572b
NODE_ENV=production
PORT=3001
```

### 3️⃣ Copy Railway URL
Railway gives you: `https://blockpay-production-xxxx.up.railway.app`

### 4️⃣ Update netlify.toml
Replace `YOUR-BACKEND-URL-HERE` with your Railway URL

### 5️⃣ Push to GitHub
```bash
git add netlify.toml
git commit -m "Fix API routing"
git push
```

**Done!** Your APIs will work! 🎉

---

**See `DEPLOY_BACKEND.md` for detailed steps!**

