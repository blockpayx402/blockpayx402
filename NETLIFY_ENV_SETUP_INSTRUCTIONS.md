# Netlify Environment Variables - Quick Setup

## ✅ Automated Setup (If Netlify CLI is installed)

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Login to Netlify:
   ```bash
   netlify login
   ```

3. Run setup script:
   ```bash
   node scripts/setup-netlify-env.js
   ```

---

## 📋 Manual Setup (Netlify Dashboard)

### Step 1: Go to Netlify Dashboard
👉 https://app.netlify.com → Your site → **Site settings**

### Step 2: Add Environment Variables
**Site settings** → **Build & deploy** → **Environment variables** → **Add a variable**

### Step 3: Add These Variables (Copy-Paste Ready):

```
CHANGENOW_API_KEY = 1cda159504a3b708495e678ee620d58664c840f5a5cd341e6fb51f04ee79572b
NODE_ENV = production
BLOCKPAY_FEE_PERCENT = 0.01
BLOCKPAY_MIN_FEE_USD = 0.10
BLOCKPAY_MAX_FEE_USD = 0
BLOCKPAY_FEE_RECIPIENT = 0x0000000000000000000000000000000000000000
BLOCKPAY_FEE_CHAIN = ethereum
```

### Step 4: Redeploy
**Deploys** tab → **Trigger deploy** → **Clear cache and deploy site**

### Step 5: Verify
Visit: https://blockpay.cloud/api/setup

Should show: `"ready": true` ✅

---

## 🎯 Quick Copy-Paste Commands

If you have Netlify CLI installed and logged in:

```bash
netlify env:set CHANGENOW_API_KEY "1cda159504a3b708495e678ee620d58664c840f5a5cd341e6fb51f04ee79572b"
netlify env:set NODE_ENV "production"
netlify env:set BLOCKPAY_FEE_PERCENT "0.01"
netlify env:set BLOCKPAY_MIN_FEE_USD "0.10"
netlify env:set BLOCKPAY_MAX_FEE_USD "0"
netlify env:set BLOCKPAY_FEE_RECIPIENT "0x0000000000000000000000000000000000000000"
netlify env:set BLOCKPAY_FEE_CHAIN "ethereum"
netlify deploy --prod
```

---

**That's it! After setting variables and redeploying, your setup will be complete!** ✅
