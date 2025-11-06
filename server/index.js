import express from 'express'
import cors from 'cors'
import { dbHelpers } from './database.js'
import { generateDepositAddress, checkDepositStatus, getExchangeStatusById } from './services/depositAddress.js'
import { getRelayExchangeRate, getAllRelayChains, getAllRelayTokens } from './services/relay.js'
import { calculatePlatformFee, BLOCKPAY_CONFIG } from './config.js'
import { checkSetup, generateSetupInstructions } from './utils/setup.js'
import { checkGitSecurity, validateApiKeySecurity } from './utils/security.js'

const app = express()
const PORT = process.env.PORT || 3001

if (process.env.NODE_ENV === 'production') {
  import('path').then(({ default: path }) => {
    const distPath = path.join(process.cwd(), 'dist')
    try {
      app.use(express.static(distPath))
    } catch (error) {
   
    }
  }).catch(() => {})
}

app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:5174', 
    'http://localhost:3000',
    'http://blockpay.cloud',
    'https://blockpay.cloud',
    'https://www.blockpay.cloud'
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

    // Validate required fields
    if (!amount || amount === '' || amount === null || amount === undefined) {
      return res.status(400).json({ error: 'Amount is required' })
    }
    
    // Convert amount to number
    const amountNum = typeof amount === 'string' ? parseFloat(amount.trim()) : Number(amount)
    
    if (!isFinite(amountNum) || isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: `Invalid amount: ${amount}. Amount must be a positive number greater than zero.` })
    }

    // Support both payment requests and direct swaps
    let toChain, toAsset, recipientAddress
    
    if (requestId) {
      // Payment request flow
      const request = dbHelpers.getRequestById(requestId)
      if (!request) {
        return res.status(404).json({ error: 'Payment request not found' })
      }
      toChain = request.chain
      toAsset = request.currency
      recipientAddress = request.recipient
    } else {
      // Direct swap flow - get from request body
      toChain = req.body.toChain
      toAsset = req.body.toAsset
      recipientAddress = req.body.recipientAddress
      
      if (!toChain || !toAsset || !recipientAddress) {
        return res.status(400).json({ error: 'For direct swaps, toChain, toAsset, and recipientAddress are required' })
      }
    }

    // Calculate platform fee (with chain-specific recipient)
    const fee = calculatePlatformFee(amountNum, fromAsset, fromChain)

    // Generate order ID first
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Generate deposit address via Relay Link
    const depositInfo = await generateDepositAddress({
      fromChain,
      fromAsset,
      toChain,
      toAsset,
      amount: amountNum,
      recipientAddress,
      refundAddress,
      orderId
    })

    // Create order in database
    const order = dbHelpers.createOrder({
      id: orderId,
      requestId: requestId || null, // null for direct swaps
      fromChain,
      fromAsset,
      toChain,
      toAsset,
      amount: amountNum.toString(),
      depositAddress: depositInfo.depositAddress,
      refundAddress,
      expectedAmount: depositInfo.estimatedAmount?.toString() || amountNum.toString(),
      status: 'awaiting_deposit',
      exchangeId: depositInfo.exchangeId,
      platformFeeAmount: fee.amount.toString(),
      platformFeePercent: fee.percent.toString(),
      amountAfterFee: depositInfo.amountAfterFee?.toString() || amountNum.toString()
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
    console.error('[Create Order Error]', error)
    console.error('[Create Order Error Stack]', error.stack)
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create order. Please try again.'
    let statusCode = 500
    
    if (error.message) {
      if (error.message.includes('API key') || error.message.includes('Unauthorized') || error.message.includes('401')) {
        errorMessage = 'Relay Link API error. Please check your configuration.'
        statusCode = 401
      } else if (error.message.includes('not available') || error.message.includes('not found') || error.message.includes('404')) {
        errorMessage = `This exchange pair is not available: ${fromAsset}(${fromChain}) -> ${req.body?.requestId ? 'target currency' : 'unknown'}. Please try a different currency or chain.`
        statusCode = 404
      } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('fetch')) {
        errorMessage = 'Cannot connect to Relay Link API. Please check your internet connection and try again.'
        statusCode = 503
      } else {
        errorMessage = error.message
      }
    }
    
    // Log the full error for debugging
    console.error('[Create Order] Final error message:', errorMessage)
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Get exchange rate estimate (for calculating required send amount)
app.post('/api/exchange-rate', async (req, res) => {
  try {
    const {
      fromChain,
      fromAsset,
      toChain,
      toAsset,
      amount, // Can be either fromAmount or toAmount
      direction = 'forward' // 'forward' = fromAmount to estimate toAmount, 'reverse' = toAmount to estimate fromAmount
    } = req.body

    if (!fromChain || !fromAsset || !toChain || !toAsset || !amount) {
      return res.status(400).json({ error: 'Missing required parameters' })
    }

    // Only block if it's the EXACT same currency on the same chain
    // Allow same-chain swaps for different currencies (e.g., USDT -> BNB on BSC)
    if (fromChain === toChain && fromAsset.toUpperCase() === toAsset.toUpperCase()) {
      return res.status(400).json({ 
        error: `Cannot calculate exchange rate for the same currency on the same chain: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please use direct payment instead.` 
      })
    }

    let fromAmount = parseFloat(amount)
    let estimatedToAmount = null
    let requiredFromAmount = null

    let result
    
    if (direction === 'forward') {
      // Calculate how much will be received for a given send amount
      result = await getRelayExchangeRate(fromAsset, toAsset, fromChain, toChain, fromAmount)
      if (!result || !result.estimatedAmount) {
        throw new Error('Failed to get exchange rate estimate')
      }
      estimatedToAmount = result.estimatedAmount
    } else {
      // Calculate how much needs to be sent to receive a specific amount
      // SimpleSwap doesn't have a direct reverse endpoint, so we estimate iteratively
      const targetToAmount = parseFloat(amount)
      
      // Start with an initial estimate (assume similar value currencies)
      let currentFromAmount = targetToAmount * 1.05 // 5% initial buffer
      let iterations = 0
      const maxIterations = 5
      
      // Iteratively refine the estimate
      while (iterations < maxIterations) {
        try {
          result = await getRelayExchangeRate(fromAsset, toAsset, fromChain, toChain, currentFromAmount)
          if (!result || !result.estimatedAmount) {
            throw new Error('Failed to get exchange rate estimate')
          }
          
          const estimatedOutput = parseFloat(result.estimatedAmount)
          
          if (!result.rate || parseFloat(result.rate) <= 0 || isNaN(estimatedOutput)) {
            throw new Error('Invalid exchange rate data received')
          }
        
        const rate = parseFloat(result.rate)
        
        // If we're close enough (within 1%), use this amount
        if (Math.abs(estimatedOutput - targetToAmount) / targetToAmount < 0.01) {
          requiredFromAmount = currentFromAmount
          estimatedToAmount = result.estimatedAmount
          break
        }
        
        // Adjust the fromAmount based on how far off we are
        if (estimatedOutput < targetToAmount) {
          // Need more input
          currentFromAmount = currentFromAmount * (targetToAmount / estimatedOutput) * 1.02
        } else {
          // Too much input, reduce
          currentFromAmount = currentFromAmount * (targetToAmount / estimatedOutput) * 0.98
        }
        
        } catch (iterError) {
          // If iteration fails, throw the error
          throw iterError
        }
        
        iterations++
      }
      
      if (!requiredFromAmount) {
        // Use final calculated amount
        requiredFromAmount = currentFromAmount
        estimatedToAmount = result?.estimatedAmount || null
      }
    }

    // Ensure result is defined before accessing its properties
    if (!result) {
      throw new Error('Failed to get exchange rate data')
    }

    res.json({
      fromAmount: direction === 'reverse' ? (requiredFromAmount || fromAmount) : fromAmount,
      estimatedToAmount: direction === 'reverse' ? (estimatedToAmount || parseFloat(amount)) : (result.estimatedAmount || estimatedToAmount),
      rate: result.rate || null,
      minAmount: result.minAmount || null,
      maxAmount: result.maxAmount || null,
      direction
    })
  } catch (error) {
    console.error('[Exchange Rate Error]', error)
    console.error('[Exchange Rate Error Stack]', error.stack)
    
    // Provide more specific error messages
    let errorMessage = 'Failed to get exchange rate. Please try again.'
    let statusCode = 500
    
    if (error.message) {
      if (error.message.includes('API key') || error.message.includes('Unauthorized') || error.message.includes('401')) {
        errorMessage = 'Relay Link API error. Please check your configuration.'
        statusCode = 401
      } else if (error.message.includes('not available') || error.message.includes('not found') || error.message.includes('404')) {
        errorMessage = `This exchange pair is not available: ${req.body.fromAsset}(${req.body.fromChain}) -> ${req.body.toAsset}(${req.body.toChain}). Please try a different currency or chain.`
        statusCode = 404
      } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('fetch')) {
        errorMessage = 'Cannot connect to Relay Link API. Please check your internet connection and try again.'
        statusCode = 503
      } else {
        errorMessage = error.message
      }
    }
    
    // Log the full error for debugging
    console.error('[Exchange Rate] Final error message:', errorMessage)
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Get order status (with real-time sync from ChangeNOW)
app.get('/api/status/:orderId', async (req, res) => {
  try {
    const order = dbHelpers.getOrderById(req.params.orderId)
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }
    
    // If order has exchange ID, sync status from Relay Link
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
        console.error('Error syncing status from Relay Link:', error)
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


app.get('/api/orders/:requestId', (req, res) => {
  try {
    const orders = dbHelpers.getOrdersByRequestId(req.params.requestId)
    res.json(orders)
  } catch (error) {
    console.error('Error fetching orders:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/cleanup', (req, res) => {
  try {
    const deleted = dbHelpers.deleteExpiredRequests()
    res.json({ success: true, deleted })
  } catch (error) {
    console.error('Error cleaning up:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Relay Link Webhook Handler (for real-time status updates) - Currently not used
app.post('/api/webhooks/relay', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Verify webhook signature if configured
    const signature = req.headers['x-relay-signature']
    // TODO: Verify signature with BLOCKPAY_CONFIG.webhook.secret
    
    const webhookData = JSON.parse(req.body.toString())
    
    // Extract exchange ID and status
    const { id: exchangeId, status } = webhookData
    
    // Find order by exchange ID
    const orders = dbHelpers.getOrdersByRequestId('*') // Get all orders
    const order = orders.find(o => o.exchangeId === exchangeId)
    
    if (order) {
      // Map Relay Link status to BlockPay status
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
  console.log(`   Relay Link API: ✅ Configured (no API key required)`)
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
