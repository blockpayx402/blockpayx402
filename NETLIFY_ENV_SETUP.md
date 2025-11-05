# 🔧 Netlify Environment Variables Setup

## ✅ Your API is Working!

The Netlify function is now working correctly! You just need to add environment variables.

---

## 📋 Step-by-Step: Add Environment Variables in Netlify

### Step 1: Go to Netlify Dashboard
1. Visit: https://app.netlify.com
2. Sign in to your account
3. Select your site: **blockpay.cloud**

### Step 2: Navigate to Environment Variables
1. Click on **Site settings** (gear icon) in the top menu
2. Scroll down to **Build & deploy**
3. Click **Environment variables**
4. Click **Add a variable**

### Step 3: Add Each Variable

Add these variables one by one:

#### Required Variables:

**1. ChangeNOW API Key:**
```
Key: CHANGENOW_API_KEY
Value: 1cda159504a3b708495e678ee620d58664c840f5a5cd341e6fb51f04ee79572b
```

**2. Node Environment:**
```
Key: NODE_ENV
Value: production
```

#### Optional but Recommended:

**3. Fee Recipient Address:**
```
Key: BLOCKPAY_FEE_RECIPIENT
Value: YOUR_ETHEREUM_ADDRESS_HERE
```
*(Replace with your actual Ethereum address where you want to collect fees)*

**4. Fee Percentage:**
```
Key: BLOCKPAY_FEE_PERCENT
Value: 0.01
```
*(1% = 0.01, 2% = 0.02, etc.)*

**5. Minimum Fee:**
```
Key: BLOCKPAY_MIN_FEE_USD
Value: 0.10
```
*(Minimum fee in USD)*

**6. Maximum Fee:**
```
Key: BLOCKPAY_MAX_FEE_USD
Value: 0
```
*(0 = no maximum limit)*

**7. Fee Chain:**
```
Key: BLOCKPAY_FEE_CHAIN
Value: ethereum
```
*(Chain where fees are collected)*

**8. ChangeNOW Partner ID (Optional):**
```
Key: CHANGENOW_PARTNER_ID
Value: (leave empty or set if you have one)
```

### Step 4: Save and Redeploy

1. After adding all variables, click **Save**
2. Go to **Deploys** tab
3. Click **Trigger deploy** → **Clear cache and deploy site**

### Step 5: Verify

After deployment, visit:
```
https://blockpay.cloud/api/setup
```

You should see:
- ✅ `"ready": true`
- ✅ No errors
- ✅ Only optional warnings (if any)

---

## 🎉 That's It!

Once you add the environment variables and redeploy, your BlockPay system will be fully configured and ready to use!

---

## 📝 Quick Copy-Paste

Here's a quick reference for the required variables:

```
CHANGENOW_API_KEY=1cda159504a3b708495e678ee620d58664c840f5a5cd341e6fb51f04ee79572b
NODE_ENV=production
BLOCKPAY_FEE_PERCENT=0.01
BLOCKPAY_MIN_FEE_USD=0.10
BLOCKPAY_MAX_FEE_USD=0
BLOCKPAY_FEE_RECIPIENT=YOUR_ETHEREUM_ADDRESS
BLOCKPAY_FEE_CHAIN=ethereum
```

---

**Your API is working! Just add the environment variables and you're done!** ✅

