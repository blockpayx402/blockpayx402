# Block Payment

A premium, non-custodial cryptocurrency payment platform built with React. Create and manage payment requests with a beautiful, modern UI inspired by Webflow's best designs.

## 🎯 What It Does

Block Payment allows you to:
- **Create Payment Requests** - Generate shareable links/QR codes for crypto payments
- **Receive Payments** - Payments go directly to your wallet (we never hold your funds)
- **Track Transactions** - Monitor all payments and requests in one place
- **Non-Custodial** - You maintain complete control over your funds
- **Multi-Chain Support** - Ethereum, BNB Chain, Polygon, Solana
- **Blockchain Verification** - Real-time payment verification on-chain
- **Server-Side Storage** - Transactions persist across refreshes

## 🔄 How It Works

### Complete User Journey:

1. **Connect Wallet** → Your wallet address is used as payment destination
2. **Create Payment Request** → Generate amount, currency, description, get shareable link
3. **Share Request** → Send link/QR code to payer
4. **Payer Opens Link** → Sees payment details and connects their wallet
5. **Payer Sends Payment** → Transaction goes directly to your wallet
6. **Track in Dashboard** → See all completed payments and statistics

### Why Wallet Connection is Required:

**For Request Creators:**
- System needs your wallet address as payment destination
- Proves ownership and prevents anonymous requests
- Auto-fills recipient address for security

**For Payment Senders:**
- Wallet signs transactions cryptographically
- Wallet contains the funds being sent
- Required for blockchain transaction creation

See [HOW_IT_WORKS.md](./HOW_IT_WORKS.md) for detailed explanation.

## Features

- 🎨 **Premium UI/UX** - Modern, glassmorphic design with smooth animations
- 🔐 **Non-Custodial** - Users retain full control over their funds
- 💳 **Payment Requests** - Create and share payment requests easily
- 📊 **Dashboard** - Comprehensive overview of all transactions
- 🔄 **Real-time Updates** - Monitor payment status in real-time
- 📱 **Responsive** - Works seamlessly on all devices
- 🔗 **Wallet Integration** - MetaMask support with demo fallback
- 📱 **QR Codes** - Generate shareable QR codes for easy payment
- ⛓️ **Multi-Chain** - Ethereum, BNB, Polygon, Solana support
- ✅ **Blockchain Verification** - Real-time payment verification
- 💾 **Server Storage** - Data persists across refreshes

## Tech Stack

- **React 18** - Modern React with hooks
- **Vite** - Lightning fast build tool
- **Express** - Backend server for data persistence
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Smooth animations and transitions
- **React Router** - Client-side routing
- **Lucide React** - Beautiful icons
- **React Hot Toast** - Elegant notifications
- **Ethers.js** - Ethereum blockchain interaction
- **Solana Web3.js** - Solana blockchain interaction
- **Axios** - HTTP client for API calls

## Getting Started

### Installation

```bash
npm install
```

### Development

Start both frontend and backend:

```bash
npm run dev
```

This will start:
- Frontend on `http://localhost:5173`
- Backend API on `http://localhost:3001`

Or run them separately:

```bash
# Frontend only
npm run dev:client

# Backend only
npm run dev:server
```

### Build

```bash
npm run build
```

### Production

```bash
npm start
```

## Project Structure

```
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/         # Page components
│   ├── context/       # React Context for state management
│   ├── services/      # API and blockchain services
│   ├── hooks/         # Custom React hooks
│   ├── App.jsx        # Main app component
│   └── main.jsx       # Entry point
├── server/
│   ├── data/          # JSON database files
│   └── index.js       # Express server
└── package.json
```

## API Endpoints

- `GET /api/requests` - Get all payment requests
- `GET /api/requests/:id` - Get a specific payment request
- `POST /api/requests` - Create a payment request
- `PUT /api/requests/:id` - Update a payment request
- `GET /api/transactions` - Get all transactions
- `POST /api/transactions` - Create a transaction
- `POST /api/sync` - Sync all data
- `GET /api/health` - Health check

## Data Storage

- **Server**: Data stored in `server/data/*.json` files
- **Client**: localStorage used as backup/cache
- **Auto-sync**: Data automatically syncs between client and server

## License

MIT
