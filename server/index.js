import express from 'express'
import cors from 'cors'
import { dbHelpers } from './database.js'
import { generateDepositAddress, checkDepositStatus, getExchangeStatusById } from './services/depositAddress.js'
import { calculatePlatformFee, BLOCKPAY_CONFIG } from './config.js'
import { checkSetup, generateSetupInstructions } from './utils/setup.js'
import { checkGitSecurity, validateApiKeySecurity } from './utils/security.js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:5174', 
    'http://localhost:3000',
    'http://blockpay.cloud',
    'https://blockpay.cloud'
  ],
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// API Routes

// Get all payment requests
app.get('/api/requests', (req, res) => {
  try {
    const requests = dbHelpers.getAllRequests()
    // Mark expired requests
    const requestsWithExpiration = requests.map(req => {
      const isExpired = dbHelpers.isRequestExpired(req)
      return {
        ...req,
        isExpired,
        status: isExpired && req.status === 'pending' ? 'expired' : req.status
      }
    })
    res.json(requestsWithExpiration)
  } catch (error) {
    console.error('Error fetching requests:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get a single payment request
app.get('/api/requests/:id', (req, res) => {
  try {
    const request = dbHelpers.getRequestById(req.params.id)
    
    if (!request) {
      return res.status(404).json({ error: 'Payment request not found' })
    }
    
    const isExpired = dbHelpers.isRequestExpired(request)
    const requestWithExpiration = {
      ...request,
      isExpired,
      status: isExpired && request.status === 'pending' ? 'expired' : request.status
    }
    
    res.json(requestWithExpiration)
  } catch (error) {
    console.error('Error fetching request:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create a new payment request
app.post('/api/requests', (req, res) => {
  try {
    const requestData = {
      ...req.body,
      id: req.body.id || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      createdAt: req.body.createdAt || new Date().toISOString(),
    }
    
    const newRequest = dbHelpers.createRequest(requestData)
    res.json(newRequest)
  } catch (error) {
    console.error('Error creating payment request:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update a payment request
app.put('/api/requests/:id', (req, res) => {
  try {
    const request = dbHelpers.getRequestById(req.params.id)
    
    if (!request) {
      return res.status(404).json({ error: 'Payment request not found' })
    }
    
    const updatedRequest = dbHelpers.updateRequestStatus(
      req.params.id,
      req.body.status || request.status,
      req.body.lastChecked || null
    )
    
    res.json(updatedRequest)
  } catch (error) {
    console.error('Error updating payment request:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get all transactions
app.get('/api/transactions', (req, res) => {
  try {
    const transactions = dbHelpers.getAllTransactions()
    res.json(transactions)
  } catch (error) {
    console.error('Error fetching transactions:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create a new transaction
app.post('/api/transactions', (req, res) => {
  try {
    const transactionData = {
      ...req.body,
      id: req.body.id || `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: req.body.timestamp || new Date().toISOString(),
    }
    
    const newTransaction = dbHelpers.createTransaction(transactionData)
    res.json(newTransaction)
  } catch (error) {
    console.error('Error creating transaction:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Sync all data (requests + transactions)
app.post('/api/sync', (req, res) => {
  try {
    const { requests, transactions } = req.body
    
    // Save requests
    if (requests && Array.isArray(requests)) {
      requests.forEach(req => {
        try {
          dbHelpers.createRequest(req)
        } catch (error) {
          console.error('Error syncing request:', error)
        }
      })
    }
    
    // Save transactions
    if (transactions && Array.isArray(transactions)) {
      transactions.forEach(tx => {
        try {
          dbHelpers.createTransaction(tx)
        } catch (error) {
          console.error('Error syncing transaction:', error)
        }
      })
    }
    
    res.json({ 
      success: true,
      requests: dbHelpers.getAllRequests(),
      transactions: dbHelpers.getAllTransactions()
    })
  } catch (error) {
    console.error('Error syncing data:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Setup status endpoint
app.get('/api/setup', (req, res) => {
  try {
    const setupStatus = checkSetup()
    res.json({
      ...setupStatus,
      instructions: generateSetupInstructions(setupStatus)
    })
  } catch (error) {
    console.error('Error checking setup:', error)
    res.status(500).json({ error: 'Failed to check setup status' })
  }
})

// Create order (generate deposit address for cross-chain swap)
app.post('/api/create-order', async (req, res) => {
  try {
    const {
      requestId,
      fromChain,
      fromAsset,
      amount,
      refundAddress
    } = req.body

    // Get the payment request
    const request = dbHelpers.getRequestById(requestId)
    if (!request) {
      return res.status(404).json({ error: 'Payment request not found' })
    }

    // Calculate platform fee
    const fee = calculatePlatformFee(parseFloat(amount), fromAsset)

    // Generate order ID first
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Generate deposit address via ChangeNOW
    const depositInfo = await generateDepositAddress({
      fromChain,
      fromAsset,
      toChain: request.chain,
      toAsset: request.currency,
      amount: parseFloat(amount),
      recipientAddress: request.recipient,
      refundAddress,
      orderId
    })

    // Create order in database
    const order = dbHelpers.createOrder({
      id: orderId,
      requestId: request.id,
      fromChain,
      fromAsset,
      toChain: request.chain,
      toAsset: request.currency,
      amount: amount.toString(),
      depositAddress: depositInfo.depositAddress,
      refundAddress,
      expectedAmount: depositInfo.estimatedAmount?.toString() || request.amount,
      status: 'awaiting_deposit',
      exchangeId: depositInfo.exchangeId,
      platformFeeAmount: fee.amount.toString(),
      platformFeePercent: fee.percent.toString(),
      amountAfterFee: depositInfo.amountAfterFee?.toString() || amount.toString()
    })

    res.json({
      ...order,
      depositAddress: depositInfo.depositAddress,
      orderId: order.id,
      platformFee: fee,
      estimatedAmount: depositInfo.estimatedAmount,
      exchangeRate: depositInfo.exchangeRate,
      validUntil: depositInfo.validUntil
    })
  } catch (error) {
    console.error('Error creating order:', error)
    res.status(500).json({ error: error.message || 'Failed to create order. Please check your ChangeNOW API key.' })
  }
})

// Get order status (with real-time sync from ChangeNOW)
app.get('/api/status/:orderId', async (req, res) => {
  try {
    const order = dbHelpers.getOrderById(req.params.orderId)
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }
    
    // If order has exchange ID, sync status from ChangeNOW
    if (order.exchangeId) {
      try {
        const exchangeStatus = await getExchangeStatusById(order.exchangeId)
        
        // Update order status if changed
        if (exchangeStatus.status !== order.status) {
          dbHelpers.updateOrderStatus(
            order.id,
            exchangeStatus.status,
            exchangeStatus.depositTxHash,
            exchangeStatus.swapTxHash,
            order.exchangeId
          )
          
          // Refresh order data
          const updatedOrder = dbHelpers.getOrderById(order.id)
          order.status = updatedOrder.status
          order.depositTxHash = updatedOrder.depositTxHash
          order.swapTxHash = updatedOrder.swapTxHash
        }
      } catch (error) {
        console.error('Error syncing status from ChangeNOW:', error)
        // Continue with cached status if sync fails
      }
    }
    
    // Get payment request details
    const request = dbHelpers.getRequestById(order.requestId)
    
    res.json({
      ...order,
      request: request ? {
        id: request.id,
        recipient: request.recipient,
        toChain: request.chain,
        toAsset: request.currency,
        description: request.description
      } : null
    })
  } catch (error) {
    console.error('Error fetching order status:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get orders by request ID
app.get('/api/orders/:requestId', (req, res) => {
  try {
    const orders = dbHelpers.getOrdersByRequestId(req.params.requestId)
    res.json(orders)
  } catch (error) {
    console.error('Error fetching orders:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Cleanup expired requests endpoint (for manual cleanup if needed)
app.post('/api/cleanup', (req, res) => {
  try {
    const deleted = dbHelpers.deleteExpiredRequests()
    res.json({ success: true, deleted })
  } catch (error) {
    console.error('Error cleaning up:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ChangeNOW Webhook Handler (for real-time status updates)
app.post('/api/webhooks/changenow', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Verify webhook signature if configured
    const signature = req.headers['x-changenow-signature']
    // TODO: Verify signature with BLOCKPAY_CONFIG.webhook.secret
    
    const webhookData = JSON.parse(req.body.toString())
    
    // Extract exchange ID and status
    const { id: exchangeId, status } = webhookData
    
    // Find order by exchange ID
    const orders = dbHelpers.getOrdersByRequestId('*') // Get all orders
    const order = orders.find(o => o.exchangeId === exchangeId)
    
    if (order) {
      // Map ChangeNOW status to BlockPay status
      const statusMap = {
        'waiting': 'awaiting_deposit',
        'confirming': 'awaiting_deposit',
        'exchanging': 'processing',
        'sending': 'processing',
        'finished': 'completed',
        'failed': 'failed',
        'refunded': 'failed',
        'expired': 'failed',
      }
      
      const blockpayStatus = statusMap[status] || 'awaiting_deposit'
      
      // Update order status
      dbHelpers.updateOrderStatus(
        order.id,
        blockpayStatus,
        webhookData.payinHash,
        webhookData.payoutHash,
        exchangeId
      )
      
      console.log(`Order ${order.id} status updated to ${blockpayStatus} via webhook`)
    }
    
    res.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🚀 BlockPay Server running on http://localhost:${PORT}`)
  console.log(`${'='.repeat(60)}\n`)
  
  // Security checks
  const gitSecurity = checkGitSecurity()
  if (!gitSecurity.secure) {
    console.log(`\n🔒 SECURITY CHECK:`)
    console.log(`   ${gitSecurity.warning}\n`)
  }
  
  const apiKeyWarnings = validateApiKeySecurity()
  if (apiKeyWarnings.length > 0) {
    console.log(`\n🔒 SECURITY WARNINGS:`)
    apiKeyWarnings.forEach(warning => console.log(`   ${warning}`))
    console.log()
  }
  
  // Check setup status
  const setupStatus = checkSetup()
  
  console.log(`💾 Database: SQLite`)
  console.log(`⏰ Payment requests expire after ${BLOCKPAY_CONFIG.paymentRequest.expirationHours} hour(s)`)
  console.log(`🔄 Cross-chain swap orders supported`)
  console.log(`💰 Platform fee: ${calculatePlatformFee(100, 'USD').percent}%`)
  console.log(`   └─ Minimum: $${BLOCKPAY_CONFIG.fees.minFeeUSD}`)
  console.log(`   └─ Maximum: ${BLOCKPAY_CONFIG.fees.maxFeeUSD > 0 ? '$' + BLOCKPAY_CONFIG.fees.maxFeeUSD : 'No limit'}`)
  
  console.log(`\n📋 Setup Status:`)
  if (setupStatus.ready) {
    console.log(`   ✅ BlockPay is ready for production!`)
  } else {
    console.log(`   ⚠️  Setup incomplete - Some configuration is missing`)
    setupStatus.issues.forEach(issue => {
      console.log(`   ❌ ${issue.message}`)
      console.log(`      Fix: ${issue.fix}`)
    })
  }
  
  if (setupStatus.warnings.length > 0) {
    console.log(`\n⚠️  Warnings:`)
    setupStatus.warnings.forEach(warning => {
      console.log(`   • ${warning.message}`)
    })
  }
  
  console.log(`\n🔗 Configuration:`)
  console.log(`   ChangeNOW API: ${BLOCKPAY_CONFIG.changenow.apiKey ? '✅ Configured' : '❌ NOT CONFIGURED'}`)
  console.log(`   Fee Recipient: ${BLOCKPAY_CONFIG.fees.feeRecipientAddress && BLOCKPAY_CONFIG.fees.feeRecipientAddress !== '0x0000000000000000000000000000000000000000' ? '✅ Configured' : '❌ NOT CONFIGURED'}`)
  
  if (!setupStatus.ready) {
    console.log(`\n📖 Setup Guide: Check SETUP_GUIDE.md for detailed instructions`)
    console.log(`   Or visit: http://localhost:${PORT}/api/setup for setup status\n`)
  } else {
    console.log(`\n✅ Ready to accept payments!`)
    if (gitSecurity.secure) {
      console.log(`🔒 Security: API key is properly secured\n`)
    }
  }
  
  console.log(`${'='.repeat(60)}\n`)
})
