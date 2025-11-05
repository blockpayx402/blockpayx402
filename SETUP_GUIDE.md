# BlockPay Production Setup Guide

## 🚀 Production-Ready Configuration

BlockPay is now fully integrated with ChangeNOW API for real cross-chain swaps and includes a customizable fee system.

## 📋 Prerequisites

1. **ChangeNOW API Key**
   - Sign up at: https://changenow.io/api
   - Get your API key from the dashboard
   - (Optional) Get Partner ID for affiliate tracking

2. **Node.js 18+** installed
3. **Environment Variables** configured

## ⚙️ Environment Configuration

Create a `.env` file in the root directory:

```bash
# ChangeNOW API Configuration
CHANGENOW_API_KEY=your_api_key_here
CHANGENOW_PARTNER_ID=your_partner_id_here  # Optional

# BlockPay Platform Fees
BLOCKPAY_FEE_PERCENT=0.01              # 1% platform fee
BLOCKPAY_MIN_FEE_USD=0.10              # Minimum $0.10 fee
BLOCKPAY_MAX_FEE_USD=0                  # No maximum (0 = unlimited)
BLOCKPAY_FEE_RECIPIENT=0x...            # Your fee collection address
BLOCKPAY_FEE_CHAIN=ethereum             # Chain to collect fees on

# Server Configuration
PORT=3001
NODE_ENV=production

# Webhook (for real-time updates from ChangeNOW)
WEBHOOK_SECRET=your_webhook_secret_here
```

## 🎯 Fee Configuration

### Setting Your Platform Fees

BlockPay supports flexible fee structures:

1. **Percentage Fee** (`BLOCKPAY_FEE_PERCENT`)
   - Default: 1% (0.01)
   - Example: 0.5% = 0.005, 2% = 0.02

2. **Minimum Fee** (`BLOCKPAY_MIN_FEE_USD`)
   - Ensures minimum revenue per transaction
   - Default: $0.10

3. **Maximum Fee** (`BLOCKPAY_MAX_FEE_USD`)
   - Caps fees for large transactions
   - Default: 0 (no limit)

4. **Fee Collection**
   - Fees are deducted from the final amount received by the seller
   - Configure `BLOCKPAY_FEE_RECIPIENT` to collect fees

### How Fees Work

1. **Buyer pays**: Full amount (e.g., 1 BNB)
2. **BlockPay fee**: Calculated (e.g., 1% = 0.01 BNB)
3. **Amount after fee**: 0.99 BNB sent to ChangeNOW
4. **ChangeNOW swaps**: 0.99 BNB → SOL (minus ChangeNOW fee)
5. **Seller receives**: Final amount after all fees

## 🔧 ChangeNOW Integration

### API Endpoints Used

1. **Create Exchange** (`POST /v2/exchange`)
   - Generates deposit addresses
   - Returns exchange ID for tracking

2. **Get Exchange Status** (`GET /v2/exchange/:id`)
   - Real-time status updates
   - Transaction hashes

3. **Get Exchange Rate** (`GET /v2/exchange/estimated-amount`)
   - Estimate swap amounts
   - Rate information

### Webhook Setup

For real-time status updates, configure ChangeNOW webhook:

1. In ChangeNOW dashboard, set webhook URL:
   ```
   https://your-domain.com/api/webhooks/changenow
   ```

2. Set webhook secret in `.env`:
   ```
   WEBHOOK_SECRET=your_secret_here
   ```

3. Webhook will automatically update order status

## 📊 Database Schema

The system now tracks:

- **Orders Table**: Cross-chain swap orders
  - Platform fees
  - Exchange IDs
  - Transaction hashes
  - Status tracking

## 🚦 Running in Production

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Build Frontend

```bash
npm run build
```

### 4. Start Server

```bash
npm start
```

### 5. Deploy

- Frontend: Deploy `dist/` folder to your hosting
- Backend: Deploy to server with Node.js support
- Database: SQLite file will be created automatically

## 🔍 Monitoring

### Server Logs

The server logs important information:

```
🚀 BlockPay Server running on http://localhost:3001
💾 Database: SQLite
⏰ Payment requests expire after 1 hour
🔄 Cross-chain swap orders supported
💰 Platform fee: 1%
🔗 ChangeNOW API: Configured
```

### Order Status Tracking

- Orders auto-sync with ChangeNOW every status check
- Webhooks provide real-time updates
- Status page auto-refreshes every 5 seconds

## 🛡️ Security

1. **API Keys**: Never commit `.env` to git
2. **Webhook Secret**: Use strong, random secrets
3. **CORS**: Configure allowed origins in `server/index.js`
4. **Rate Limiting**: Consider adding rate limiting for production

## 📈 Fee Analytics

Track your fees:

```javascript
// Get all orders with fees
const orders = dbHelpers.getAllOrders()
const totalFees = orders.reduce((sum, order) => {
  return sum + parseFloat(order.platformFeeAmount || 0)
}, 0)
```

## 🔄 Updating Fees

To change fees:

1. Update `.env` file
2. Restart server
3. New fees apply to new orders only

## ❓ Troubleshooting

### "ChangeNOW API error"

- Check `CHANGENOW_API_KEY` is set
- Verify API key is valid
- Check API rate limits

### "Failed to generate deposit address"

- Verify currency pairs are supported
- Check network connectivity
- Review ChangeNOW API status

### Fees not calculating correctly

- Check `BLOCKPAY_FEE_PERCENT` format (decimal, not percentage)
- Verify minimum/maximum fee settings
- Check fee recipient address is valid

## 📞 Support

For ChangeNOW API support:
- Documentation: https://changenow.io/api
- Support: support@changenow.io

For BlockPay issues:
- Check server logs
- Review error messages
- Verify environment configuration

## 🎉 Ready to Go!

Your BlockPay system is now production-ready with:

✅ Real ChangeNOW API integration  
✅ Customizable platform fees  
✅ Automatic fee calculation  
✅ Real-time order tracking  
✅ Webhook support  
✅ Production-grade error handling  

Start accepting cross-chain payments with your own fees!

