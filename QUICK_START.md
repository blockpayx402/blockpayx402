# 🚀 BlockPay Quick Start Guide

## ⚡ 3-Step Setup

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Run Setup Wizard
```bash
npm run setup
```

The setup wizard will guide you through:
- ✅ ChangeNOW API key configuration
- ✅ Platform fee setup
- ✅ Fee recipient address
- ✅ Server configuration

### Step 3: Start Server
```bash
npm start
```

That's it! 🎉

---

## 📋 Manual Setup (Alternative)

If you prefer manual setup:

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file:**
   - Get ChangeNOW API key from: https://changenow.io/api
   - Set your fee configuration
   - Configure fee recipient address

3. **Start server:**
   ```bash
   npm start
   ```

---

## 🔍 Verify Setup

Check your setup status:
```bash
curl http://localhost:3001/api/setup
```

Or visit in browser: `http://localhost:3001/api/setup`

---

## ⚙️ Configuration

### Required:
- ✅ `CHANGENOW_API_KEY` - Get from https://changenow.io/api

### Recommended:
- ✅ `BLOCKPAY_FEE_RECIPIENT` - Your address to collect fees
- ✅ `BLOCKPAY_FEE_PERCENT` - Your platform fee (default: 1%)

### Optional:
- `CHANGENOW_PARTNER_ID` - For affiliate tracking
- `WEBHOOK_SECRET` - For webhook security

---

## 🎯 What You Get

✅ **Real ChangeNOW Integration** - Actual cross-chain swaps  
✅ **Customizable Fees** - Set your own platform fees  
✅ **Production Ready** - Error handling, logging, monitoring  
✅ **Auto-Setup** - Interactive setup wizard  
✅ **Status Tracking** - Real-time order monitoring  

---

## 📖 Need Help?

- **Setup Guide**: See `SETUP_GUIDE.md` for detailed instructions
- **API Docs**: Check `server/index.js` for API endpoints
- **Configuration**: See `server/config.js` for all settings

---

## 🎉 Ready!

Your BlockPay system is ready to accept cross-chain payments with your own fees!

