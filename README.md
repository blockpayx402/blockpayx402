# 🚀 BlockPay - Production-Ready Crypto Payment System

**BlockPay** is a complete, production-ready cryptocurrency payment system with automatic cross-chain token swapping. Built with real ChangeNOW API integration and customizable platform fees.

🌐 **Live Site:** [http://blockpay.cloud/](http://blockpay.cloud/)

---

## ⚡ Quick Start (3 Steps)

### 1. Install
```bash
npm install
```
*(Auto-creates .env file on install)*

### 2. Add API Key
Get your ChangeNOW API key from: https://changenow.io/api

Add to `.env` file:
```bash
CHANGENOW_API_KEY=your_api_key_here
```

### 3. Start
```bash
npm start
```

**That's it!** 🎉

---

## 📋 What's Included

✅ **Everything is Pre-Configured:**
- ✅ Database setup
- ✅ Server configuration  
- ✅ Fee system (1% default)
- ✅ All API endpoints
- ✅ Error handling
- ✅ Setup validation

✅ **Production Features:**
- ✅ Real ChangeNOW API integration
- ✅ Customizable platform fees
- ✅ Cross-chain swaps
- ✅ Real-time order tracking
- ✅ Webhook support
- ✅ Fee collection

---

## 💰 Platform Fees

Configure your fees in `.env`:

```bash
# 1% platform fee (default)
BLOCKPAY_FEE_PERCENT=0.01

# 0.5% platform fee
BLOCKPAY_FEE_PERCENT=0.005

# 2% platform fee
BLOCKPAY_FEE_PERCENT=0.02

# Your fee recipient address
BLOCKPAY_FEE_RECIPIENT=0xYourAddressHere
```

---

## 🎯 Features

- 🎨 **Premium UI/UX** - Modern, Apple-inspired design
- 🔐 **Non-Custodial** - Users retain full control
- 💳 **Payment Requests** - Create and share easily
- 📊 **Dashboard** - Track all transactions
- 🔄 **Cross-Chain Swaps** - Automatic token conversion
- 💰 **Platform Fees** - Earn from every transaction
- 📱 **QR Codes** - Easy mobile payments
- ⛓️ **Multi-Chain** - Ethereum, BNB, Polygon, Solana
- ✅ **Real-Time Verification** - Blockchain monitoring
- 🌐 **Production Ready** - Error handling, logging, monitoring

---

## 📖 Documentation

- **`START_HERE.md`** - Quick start guide
- **`QUICK_START.md`** - Detailed setup steps
- **`SETUP_GUIDE.md`** - Production configuration guide
- **`SETUP_GUIDE.md`** - Advanced setup and troubleshooting

---

## 🛠️ Available Scripts

```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:client       # Frontend only
npm run dev:server       # Backend only

# Production
npm start                # Start production server
npm run build            # Build frontend

# Setup
npm run setup            # Interactive setup wizard
npm run auto-setup       # Auto-configure with defaults
```

---

## ⚙️ Configuration

### Required:
- `CHANGENOW_API_KEY` - Get from https://changenow.io/api

### Recommended:
- `BLOCKPAY_FEE_RECIPIENT` - Your fee collection address
- `BLOCKPAY_FEE_PERCENT` - Your platform fee (default: 1%)

### Check Setup Status:
```bash
curl http://localhost:3001/api/setup
```

---

## 🔧 Tech Stack

- **React 18** - Modern UI
- **Express** - Backend server
- **SQLite** - Database
- **ChangeNOW API** - Cross-chain swaps
- **Ethers.js** - Ethereum interaction
- **Solana Web3.js** - Solana interaction
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations

---

## 📁 Project Structure

```
├── src/                    # Frontend React app
│   ├── components/         # UI components
│   ├── pages/             # Page components
│   ├── services/           # API & blockchain services
│   └── context/           # State management
├── server/                # Backend Express server
│   ├── services/         # ChangeNOW integration
│   ├── utils/             # Utilities
│   └── index.js           # Server entry
├── scripts/               # Setup scripts
└── .env                   # Configuration (create from .env.example)
```

---

## 🚀 Deployment

### Production Checklist:
1. ✅ Set `CHANGENOW_API_KEY` in `.env`
2. ✅ Set `BLOCKPAY_FEE_RECIPIENT` in `.env`
3. ✅ Configure `NODE_ENV=production`
4. ✅ Set up webhook URL in ChangeNOW dashboard
5. ✅ Build frontend: `npm run build`
6. ✅ Deploy backend with Node.js support

---

## 📞 Support

- **ChangeNOW API**: https://changenow.io/api
- **Setup Guide**: See `SETUP_GUIDE.md`
- **Quick Start**: See `QUICK_START.md`

---

## ✅ What's Ready

Everything is pre-configured! You just need to:
1. Install dependencies (`npm install`)
2. Add your ChangeNOW API key
3. Start the server (`npm start`)

All fees, configuration, and features are ready to go! 🎉

---

## 📄 License

MIT

---

**Made with ❤️ for crypto payments**
