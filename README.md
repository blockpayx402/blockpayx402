# 🚀 BlockPay X402 - Cryptocurrency Payment Platform

**BlockPay X402** is an advanced cryptocurrency payment system that enables seamless cross-chain payments, automatic token swapping, and real-time blockchain transaction verification.

🌐 **Live Site:** [https://blockpay.cloud](https://blockpay.cloud)

---

## 🎯 What is BlockPay X402?

BlockPay X402 is a **non-custodial cryptocurrency payment platform** that allows users to:

- 💳 Create and share payment requests with QR codes
- ⛓️ Accept payments across multiple blockchains (Ethereum, BNB Chain, Polygon, Solana)
- 🔄 Automatically swap tokens across different chains
- 📊 Track transactions in real-time with blockchain verification
- 🔐 Implement the X402 Payment Protocol for paywalled content
- 💰 Earn platform fees from transactions

### Key Innovation: X402 Payment Protocol

BlockPay implements the **X402 Payment Protocol**, an innovative HTTP status code extension that enables paywalled content access through cryptocurrency payments. When a user requests protected content, the server responds with a `402 Payment Required` status and payment instructions, allowing seamless integration of crypto payments into web applications.

---

## 🌐 Live Features

Visit [https://blockpay.cloud](https://blockpay.cloud) to access:

### Core Features
- ✅ **Multi-Chain Support** - Ethereum, BNB Chain, Polygon, Solana
- ✅ **Cross-Chain Swaps** - Automatic token conversion
- ✅ **Real-Time Verification** - Blockchain transaction monitoring
- ✅ **QR Code Generation** - Easy mobile payments
- ✅ **Payment Requests** - Create and share payment links
- ✅ **Dashboard** - Track all transactions
- ✅ **X402 Protocol** - Paywalled content access

### Advanced Features
- ✅ **Platform Fees** - Configurable fee system
- ✅ **Non-Custodial** - Users retain full control
- ✅ **Webhook Support** - Real-time notifications
- ✅ **API Endpoints** - RESTful API for integrations
- ✅ **Transaction History** - Complete audit trail
- ✅ **Multi-Wallet Support** - MetaMask, Phantom, WalletConnect

---

## 🏗️ How It Works

### Payment Flow

1. **Request Creation**
   - User connects wallet and creates a payment request
   - System generates unique request ID and payment link
   - QR code is generated for easy sharing

2. **Payment Processing**
   - Recipient opens payment link
   - System calculates required amount including fees
   - If cross-chain payment needed, swap order is created
   - User approves transaction in wallet
   - Transaction is broadcast to blockchain

3. **Verification**
   - Backend monitors blockchain for transaction confirmation
   - Real-time status updates via polling
   - Payment marked as completed upon confirmation

4. **Fee Distribution**
   - Platform fee is calculated (configurable percentage)
   - Fee is automatically routed to platform wallet
   - Remaining amount goes to recipient

### Cross-Chain Swap Mechanism

Our swap engine handles token conversions across different blockchains:

1. **Swap Detection**: System detects when payment currency differs from recipient's preferred chain
2. **Rate Calculation**: Real-time exchange rates are fetched and calculated
3. **Order Creation**: Swap order is created with optimal routing
4. **Execution**: Swap is executed automatically
5. **Delivery**: Converted tokens are sent to recipient's address

### X402 Protocol Implementation

The X402 Payment Protocol allows content creators to monetize their work:

```javascript
// Server responds with 402 Payment Required
{
  "x402Version": 1,
  "accepts": [{
    "asset": "SOL",
    "amount": "0.1",
    "recipient": "wallet_address",
    "resource": "/api/protected-content"
  }]
}

// Client pays and includes X-PAYMENT header
fetch('/api/protected-content', {
  headers: {
    'X-PAYMENT': 'transaction_signature'
  }
})
```

---

## 📖 API Documentation

### Payment Requests

```bash
# Create a payment request
POST /api/requests
{
  "amount": "0.1",
  "currency": "ETH",
  "recipient": "0x...",
  "description": "Payment for services",
  "chain": "ethereum"
}

# Get all requests
GET /api/requests

# Get specific request
GET /api/requests/:id

# Pay a request (X402 protocol)
GET /api/requests/:id
Headers: { "X-PAYMENT": "transaction_signature" }
```

### Swap Orders

```bash
# Create swap order
POST /api/create-order
{
  "fromCurrency": "ETH",
  "toCurrency": "SOL",
  "amount": "0.1",
  "recipient": "wallet_address"
}

# Get order status
GET /api/orders/:id
```

### Health & Setup

```bash
# Health check
GET /api/health

# Setup status
GET /api/setup
```

Full API documentation available at: [https://blockpay.cloud/api](https://blockpay.cloud/api)

---

## 💡 Use Cases

- **E-commerce**: Accept crypto payments for products
- **Content Monetization**: X402 protocol for paywalled content
- **Freelance Payments**: Request payments for services
- **Donations**: Accept crypto donations
- **Subscription Services**: Recurring payment requests
- **Cross-Border Payments**: Fast, low-cost international transfers

---

## 🔒 Security

### Security Features

- **Non-Custodial Architecture** - Users control their private keys
- **Direct Blockchain Transactions** - No intermediary holding funds
- **Transaction Verification** - All payments verified on-chain
- **Input Validation** - Comprehensive validation on all inputs
- **CORS Protection** - Configured CORS for production domains

---

## 🎓 Technical Highlights

- **Modern React Architecture**: Hooks, Context API, and functional components
- **Type-Safe Development**: Comprehensive validation and error handling
- **Optimized Performance**: Code splitting, lazy loading, and efficient rendering
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Production Ready**: Error boundaries, logging, and monitoring

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🌐 Links

- **Live Site**: [https://blockpay.cloud](https://blockpay.cloud)
- **API Documentation**: [https://blockpay.cloud/api](https://blockpay.cloud/api)
- **GitHub Repository**: [https://github.com/blockpayx402/blockpayx402](https://github.com/blockpayx402/blockpayx402)
