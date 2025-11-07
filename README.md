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

BlockPay implements the **X402 Payment Protocol**, an innovative HTTP status code extension that enables paywalled content access through cryptocurrency payments. 

**How X402 Works:**

The X402 protocol extends the standard HTTP `402 Payment Required` status code to support cryptocurrency payments. When a user requests protected content:

1. **Server Response**: The server responds with HTTP `402` status and a JSON payload containing payment requirements
2. **Payment Instructions**: The response includes accepted cryptocurrencies, amounts, and recipient addresses
3. **Client Payment**: The user's wallet automatically processes the payment on the blockchain
4. **Verification**: The client includes the transaction signature in the `X-PAYMENT` header
5. **Content Access**: Upon verification, the server grants access to the protected resource

This protocol enables seamless monetization of digital content, API access, and premium features without traditional payment processors.

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

The X402 Payment Protocol allows content creators, developers, and service providers to monetize their work directly through blockchain payments.

**Complete Flow Example:**

```javascript
// Step 1: Client requests protected content with protocol header
const response = await fetch('/api/protected-content', {
  headers: {
    'X-Payment-Protocol': 'x402/1.0'
  }
});

// Step 2: Server responds with 402 Payment Required
if (response.status === 402) {
  const paymentInfo = await response.json();
  // Response structure:
  {
    "x402Version": 1,
    "accepts": [
      {
        "asset": "SOL",                    // Cryptocurrency symbol
        "amount": "0.1",                    // Required amount
        "recipient": "7FSR...5Gn",         // Recipient wallet address
        "resource": "/api/protected-content", // Resource being paid for
        "description": "Premium article access",
        "mimeType": "application/json"      // Expected content type
      }
    ],
    "error": null
  }
  
  // Step 3: User's wallet processes payment
  const transaction = await wallet.sendTransaction({
    to: paymentInfo.accepts[0].recipient,
    amount: paymentInfo.accepts[0].amount
  });
  
  // Step 4: Client retries request with payment proof
  const paidResponse = await fetch('/api/protected-content', {
    headers: {
      'X-Payment-Protocol': 'x402/1.0',     // Protocol header
      'X-PAYMENT': transaction.signature,   // Transaction signature
      'X-PAYMENT-ASSET': 'SOL',              // Asset used
      'X-PAYMENT-AMOUNT': '0.1'              // Amount paid
    }
  });
  
  // Step 5: Server verifies payment and returns content
  const content = await paidResponse.json();
}
```

**Key Benefits:**
- **No Middlemen**: Direct wallet-to-wallet payments
- **Instant Verification**: Blockchain confirms transactions in real-time
- **Multi-Chain Support**: Accept payments in any supported cryptocurrency
- **Programmatic Access**: Perfect for API monetization and premium features
- **Non-Custodial**: Payments go directly to content creator's wallet

---

## 📖 API Documentation

BlockPay X402 provides a comprehensive RESTful API for creating payment requests, managing transactions, and implementing the X402 protocol. All endpoints are available at `https://blockpay.cloud/api`.

### Payment Requests

Create and manage cryptocurrency payment requests with support for multiple blockchains.

**Create Payment Request**
```http
POST /api/requests
Content-Type: application/json

{
  "amount": "0.1",                    // Payment amount
  "currency": "ETH",                   // Currency symbol (ETH, SOL, USDC, etc.)
  "recipient": "0x742d...35Cc",        // Recipient wallet address
  "description": "Payment for services", // Optional description
  "chain": "ethereum"                  // Blockchain: ethereum, solana, polygon, bnb
}
```

**Response:**
```json
{
  "id": "req_1234567890_abc123",
  "amount": "0.1",
  "currency": "ETH",
  "recipient": "0x742d...35Cc",
  "description": "Payment for services",
  "status": "pending",
  "chain": "ethereum",
  "createdAt": "2024-01-15T10:30:00Z",
  "paymentUrl": "https://blockpay.cloud/pay/req_1234567890_abc123"
}
```

**Get All Payment Requests**
```http
GET /api/requests
```

**Get Specific Payment Request**
```http
GET /api/requests/:id
```

**Pay a Request (X402 Protocol)**
```http
GET /api/requests/:id
Headers:
  X-Payment-Protocol: x402/1.0
  X-PAYMENT: <transaction_signature>
  X-PAYMENT-ASSET: SOL
  X-PAYMENT-AMOUNT: 0.1
```

### Swap Orders

Create cross-chain token swaps automatically when payment currency differs from recipient's preferred chain.

**Create Swap Order**
```http
POST /api/create-order
Content-Type: application/json

{
  "fromCurrency": "ETH",              // Source currency
  "toCurrency": "SOL",                 // Target currency
  "amount": "0.1",                      // Amount to swap
  "recipient": "7FSR...5Gn",           // Recipient wallet address
  "refundAddress": "0x742d...35Cc"     // Optional refund address
}
```

**Response:**
```json
{
  "id": "order_abc123",
  "fromCurrency": "ETH",
  "toCurrency": "SOL",
  "amount": "0.1",
  "status": "waiting",
  "depositAddress": "0x...",
  "expectedAmount": "2.5",
  "rate": "25.0",
  "expiresAt": "2024-01-15T11:30:00Z"
}
```

**Get Order Status**
```http
GET /api/orders/:id
```

**Response:**
```json
{
  "id": "order_abc123",
  "status": "finished",              // waiting, confirming, exchanging, finished, failed
  "fromCurrency": "ETH",
  "toCurrency": "SOL",
  "fromAmount": "0.1",
  "toAmount": "2.5",
  "transactionHash": "0x...",
  "completedAt": "2024-01-15T10:35:00Z"
}
```

### X402 Protocol Endpoints

Implement paywalled content using the X402 Payment Protocol.

**Request Protected Resource (Without Payment)**
```http
GET /api/protected-content
Headers:
  X-Payment-Protocol: x402/1.0
```

**Response (402 Payment Required):**
```http
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402Version": 1,
  "accepts": [
    {
      "asset": "SOL",
      "amount": "0.1",
      "recipient": "7FSR...5Gn",
      "resource": "/api/protected-content",
      "description": "Premium article access",
      "mimeType": "application/json"
    }
  ],
  "error": null
}
```

**Request Protected Resource (With Payment)**
```http
GET /api/protected-content
Headers:
  X-Payment-Protocol: x402/1.0
  X-PAYMENT: <transaction_signature>
  X-PAYMENT-ASSET: SOL
  X-PAYMENT-AMOUNT: 0.1
```

**Response (200 OK):**
```json
{
  "content": "...",
  "verified": true,
  "paymentTx": "5j7s...xyz"
}
```

### System Endpoints

**Health Check**
```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

**Setup Status**
```http
GET /api/setup
```

**Response:**
```json
{
  "configured": true,
  "features": {
    "swaps": true,
    "x402": true,
    "multiChain": true
  }
}
```

### Error Responses

All endpoints return standard HTTP status codes with error details:

```json
{
  "error": "Payment request not found",
  "code": "NOT_FOUND",
  "status": 404
}
```

**Common Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `402` - Payment Required (X402 protocol)
- `404` - Not Found
- `500` - Internal Server Error

### Authentication

Most endpoints do not require authentication. For X402 payment protocol support, include the `X-Payment-Protocol: x402/1.0` header to indicate protocol support. When accessing a payment request, you may receive a `402 Payment Required` response with payment requirements.

### Rate Limits

- Standard endpoints: 100 requests/minute
- Swap endpoints: 20 requests/minute
- X402 endpoints: 50 requests/minute

Full interactive API documentation available at: [https://blockpay.cloud/api](https://blockpay.cloud/api)

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
