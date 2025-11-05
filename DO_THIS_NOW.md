# 🚀 DO THIS NOW - Final Setup

## Your API is Working! ✅

Just add environment variables and you're done!

---

## ⚡ FASTEST WAY (2 Minutes)

### Option 1: Netlify CLI (If you have it)

```bash
# Install Netlify CLI (if not installed)
npm install -g netlify-cli

# Login
netlify login

# Run setup script
npm run setup:netlify
```

### Option 2: Netlify Dashboard (Easiest)

**1. Go to:** https://app.netlify.com → Your site → **Site settings**

**2. Click:** Build & deploy → **Environment variables** → **Add a variable**

**3. Add these 7 variables (one by one):**

```
CHANGENOW_API_KEY = 1cda159504a3b708495e678ee620d58664c840f5a5cd341e6fb51f04ee79572b

NODE_ENV = production

BLOCKPAY_FEE_PERCENT = 0.01

BLOCKPAY_MIN_FEE_USD = 0.10

BLOCKPAY_MAX_FEE_USD = 0

BLOCKPAY_FEE_RECIPIENT = 0x0000000000000000000000000000000000000000

BLOCKPAY_FEE_CHAIN = ethereum
```

**4. Redeploy:**
- Go to **Deploys** tab
- Click **Trigger deploy** → **Clear cache and deploy site**

**5. Verify:**
- Visit: https://blockpay.cloud/api/setup
- Should show: `"ready": true` ✅

---

## 🎉 That's It!

After adding variables and redeploying, your BlockPay system is fully configured!

---

**Total time: 2-3 minutes** ⏱️

