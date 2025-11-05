# ✅ FINAL STEPS - 2 Minutes to Complete Setup

## 🎯 What You Need to Do

Your API is working! Just add environment variables in Netlify dashboard.

---

## ⚡ EASIEST WAY (Netlify Dashboard)

### Step 1: Open Netlify
👉 https://app.netlify.com → Click your site → **Site settings**

### Step 2: Add Environment Variables
1. Click **Build & deploy** (left sidebar)
2. Click **Environment variables**
3. Click **Add a variable** button
4. Add these **7 variables** (one at a time):

```
Variable 1:
Key: CHANGENOW_API_KEY
Value: 1cda159504a3b708495e678ee620d58664c840f5a5cd341e6fb51f04ee79572b

Variable 2:
Key: NODE_ENV
Value: production

Variable 3:
Key: BLOCKPAY_FEE_PERCENT
Value: 0.01

Variable 4:
Key: BLOCKPAY_MIN_FEE_USD
Value: 0.10

Variable 5:
Key: BLOCKPAY_MAX_FEE_USD
Value: 0

Variable 6:
Key: BLOCKPAY_FEE_RECIPIENT
Value: 0x0000000000000000000000000000000000000000

Variable 7:
Key: BLOCKPAY_FEE_CHAIN
Value: ethereum
```

### Step 3: Redeploy
1. Go to **Deploys** tab (top menu)
2. Click **Trigger deploy** dropdown
3. Click **Clear cache and deploy site**
4. Wait 1-2 minutes for deployment

### Step 4: Verify ✅
Visit: https://blockpay.cloud/api/setup

You should see:
```json
{
  "ready": true,
  "issues": [],
  ...
}
```

---

## 🚀 Alternative: Use Netlify CLI (If You Want)

If you prefer command line:

```bash
# Login to Netlify
netlify login

# Run automated setup
npm run setup:netlify
```

---

## ⏱️ Total Time: 2-3 Minutes

**That's it! After adding variables and redeploying, you're done!** 🎉

