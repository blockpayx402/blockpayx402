# ⚡ Quick Netlify Environment Variables Setup

## Your API is Working! ✅

You just need to add environment variables in Netlify dashboard.

---

## 🚀 3-Minute Setup

### 1. Go to Netlify Dashboard
👉 https://app.netlify.com → Your site → **Site settings**

### 2. Add Environment Variables
**Site settings** → **Build & deploy** → **Environment variables** → **Add a variable**

### 3. Add These Variables:

#### ⚠️ REQUIRED (Fixes the error):

```
Variable: CHANGENOW_API_KEY
Value: 1cda159504a3b708495e678ee620d58664c840f5a5cd341e6fb51f04ee79572b
```

```
Variable: NODE_ENV
Value: production
```

#### ✅ RECOMMENDED (Fixes warnings):

```
Variable: BLOCKPAY_FEE_RECIPIENT
Value: 0x0000000000000000000000000000000000000000
```
*(Replace with your Ethereum address where you want fees sent)*

```
Variable: BLOCKPAY_FEE_PERCENT
Value: 0.01
```

```
Variable: BLOCKPAY_MIN_FEE_USD
Value: 0.10
```

```
Variable: BLOCKPAY_MAX_FEE_USD
Value: 0
```

```
Variable: BLOCKPAY_FEE_CHAIN
Value: ethereum
```

### 4. Redeploy
**Deploys** tab → **Trigger deploy** → **Clear cache and deploy site**

### 5. Test
Visit: `https://blockpay.cloud/api/setup`

Should show: `"ready": true` ✅

---

## 📋 Copy-Paste Ready

Add these one by one in Netlify:

1. `CHANGENOW_API_KEY` = `1cda159504a3b708495e678ee620d58664c840f5a5cd341e6fb51f04ee79572b`
2. `NODE_ENV` = `production`
3. `BLOCKPAY_FEE_RECIPIENT` = `YOUR_ETH_ADDRESS` (optional but recommended)
4. `BLOCKPAY_FEE_PERCENT` = `0.01`
5. `BLOCKPAY_MIN_FEE_USD` = `0.10`
6. `BLOCKPAY_MAX_FEE_USD` = `0`
7. `BLOCKPAY_FEE_CHAIN` = `ethereum`

---

**That's it! After adding variables and redeploying, your setup will be complete!** 🎉

