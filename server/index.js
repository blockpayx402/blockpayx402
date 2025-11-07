import express from 'express'
import cors from 'cors'
import { dbHelpers } from './database.js'
import { calculatePlatformFee, BLOCKPAY_CONFIG } from './config.js'
import { checkSetup, generateSetupInstructions } from './utils/setup.js'
import { checkGitSecurity, validateApiKeySecurity } from './utils/security.js'
import * as x402Service from './services/x402.js'

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

// Get a single payment request (with x402 support)
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
    
    // Check if this is an x402 request (check for X-PAYMENT header)
    const paymentHeader = req.headers['x-payment']
    const wantsX402 = req.headers['x-payment-protocol'] || req.query.x402 === 'true'
    
    // If payment is required and no X-PAYMENT header, return 402
    if (request.status === 'pending' && !paymentHeader && (wantsX402 || request.chain === 'solana')) {
      // Return x402 Payment Required response
      const paymentRequirements = x402Service.createPaymentRequirements({
        amount: request.amount,
        recipient: request.recipient,
        resource: `/api/requests/${request.id}`,
        description: request.description || 'Payment required',
        mimeType: 'application/json',
        asset: request.currency === 'SOL' ? 'native' : request.currency,
      })
      
      return res.status(402).json({
        x402Version: 1,
        accepts: [paymentRequirements],
        error: null,
      })
    }
    
    // If X-PAYMENT header is present, verify payment
    if (paymentHeader && request.status === 'pending') {
      try {
        const paymentPayload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString())
        const paymentRequirements = x402Service.createPaymentRequirements({
          amount: request.amount,
          recipient: request.recipient,
          resource: `/api/requests/${request.id}`,
          description: request.description || 'Payment required',
          asset: request.currency === 'SOL' ? 'native' : request.currency,
        })
        
        // Verify payment (async, but we'll wait for it)
        x402Service.verifyPayment(paymentPayload, paymentRequirements).then((verification) => {
          if (verification.isValid) {
            // Update request status to completed
            dbHelpers.updateRequestStatus(request.id, 'completed', new Date().toISOString())
          }
        }).catch(console.error)
        
        // For now, return the request (verification happens async)
        // In production, you'd want to wait for verification
        return res.json(requestWithExpiration)
      } catch (error) {
        console.error('Error parsing X-PAYMENT header:', error)
        // Return 402 if payment header is invalid
        const paymentRequirements = x402Service.createPaymentRequirements({
          amount: request.amount,
          recipient: request.recipient,
          resource: `/api/requests/${request.id}`,
          description: request.description || 'Payment required',
          asset: request.currency === 'SOL' ? 'native' : request.currency,
        })
        
        return res.status(402).json({
          x402Version: 1,
          accepts: [paymentRequirements],
          error: 'Invalid payment header',
        })
      }
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
  res.status(410).json({ error: 'Cross-chain swaps are disabled for this deployment.' })
})

// Get exchange rate estimate (for calculating required send amount)
app.post('/api/exchange-rate', async (req, res) => {
  return res.status(410).json({ error: 'Cross-chain swaps are disabled for this deployment.' })
  /*
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
    console.error('[Exchange Rate Request Body]', req.body)
    
    // Provide more specific error messages
    let errorMessage = 'Failed to get exchange rate. Please try again.'
    let statusCode = 500
    
    if (error.message) {
      if (error.message.includes('Chain not found')) {
        errorMessage = `Chain not found: ${error.message}. Please check the chain ID or name.`
        statusCode = 400
      } else if (error.message.includes('Token') && error.message.includes('not found')) {
        errorMessage = error.message
        statusCode = 400
      } else if (error.message.includes('API key') || error.message.includes('Unauthorized') || error.message.includes('401')) {
        errorMessage = 'Relay Link API error. Please check your configuration.'
        statusCode = 401
      } else if (error.message.includes('max_amount_exceeded') || error.message.includes('exceeds maximum')) {
        errorMessage = error.message
        statusCode = 400
      } else if (error.message.includes('min_amount') || error.message.includes('below minimum')) {
        errorMessage = error.message
        statusCode = 400
      } else if (error.message.includes('pair_is_inactive') || error.message.includes('inactive') || error.message.includes('currently inactive')) {
        errorMessage = error.message
        statusCode = 400
      } else if (error.message.includes('Relay API error')) {
        // Relay API returned an error - pass it through
        errorMessage = error.message
        statusCode = 400
      } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('fetch')) {
        errorMessage = 'Cannot connect to Relay Link API. Please check your internet connection and try again.'
        statusCode = 503
      } else {
        errorMessage = error.message
      }
    }
    
    // Log the full error for debugging
    console.error('[Exchange Rate] Final error message:', errorMessage)
    console.error('[Exchange Rate] Status code:', statusCode)
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
  */
})

// Get order status (with real-time sync from ChangeNOW)
app.get('/api/status/:orderId', async (req, res) => {
  return res.status(410).json({ error: 'Cross-chain swaps are disabled for this deployment.' })
  /*
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
  */
})


app.get('/api/orders/:requestId', (req, res) => {
  return res.status(410).json({ error: 'Cross-chain swaps are disabled for this deployment.' })
  /*
  try {
    const orders = dbHelpers.getOrdersByRequestId(req.params.requestId)
    res.json(orders)
  } catch (error) {
    console.error('Error fetching orders:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
  */
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
  return res.status(410).json({ error: 'Cross-chain swaps are disabled for this deployment.' })
  /*
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
  */
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

// Get all Relay chains (for frontend)
app.get('/api/relay/chains', async (req, res) => {
  return res.status(410).json({ error: 'Cross-chain swaps are disabled for this deployment.' })
  /*
  try {
    const chains = await getAllRelayChains()
    // Format chains for frontend
    const formattedChains = chains.map(chain => {
      // Handle different chain data formats
      const chainId = chain.chainId || chain.id || chain.chain_id
      const name = chain.name || chain.displayName || chain.label || `Chain ${chainId}`
      const symbol = chain.symbol || chain.nativeCurrency?.symbol || chain.native_currency?.symbol
      
      // Create value that matches what frontend will send
      // Use chainId as primary identifier, but also support name-based lookup
      const chainValue = chainId?.toString() || name.toLowerCase().replace(/\s+/g, '-')
      
      return {
        value: chainValue, // Use chainId as value for reliable matching
        label: name,
        chainId: chainId,
        symbol: symbol,
        decimals: chain.decimals || chain.nativeCurrency?.decimals || chain.native_currency?.decimals || 18,
        tokens: chain.tokens || [], // Include tokens if available in chain data
      }
    })
    
    console.log('[API] Formatted', formattedChains.length, 'chains for frontend')
    res.json({ chains: formattedChains })
  } catch (error) {
    console.error('[API] Error fetching chains:', error)
    res.status(500).json({ error: 'Failed to fetch chains', chains: [] })
  }
  */
})

// Get all tokens for a chain (for frontend)
app.get('/api/relay/tokens/:chainId', async (req, res) => {
  return res.status(410).json({ error: 'Cross-chain swaps are disabled for this deployment.' })
  /*
  try {
    const { chainId } = req.params
    console.log('[API] Fetching tokens for chainId:', chainId)
    const tokens = await getAllRelayTokens(chainId)
    console.log('[API] Got', tokens.length, 'tokens for chainId', chainId)
    
    // Format tokens for frontend
    const formattedTokens = tokens.map(token => ({
      symbol: token.symbol || token.name || 'UNKNOWN',
      address: token.address || token.contractAddress || '',
      decimals: token.decimals || 18,
      name: token.name || token.symbol || 'Unknown Token',
      isNative: token.isNative || token.address === '0x0000000000000000000000000000000000000000' || !token.address,
    }))
    
    console.log('[API] Formatted', formattedTokens.length, 'tokens')
    res.json({ tokens: formattedTokens })
  } catch (error) {
    console.error('[API] Error fetching tokens:', error)
    res.status(500).json({ error: 'Failed to fetch tokens', tokens: [] })
  }
  */
})

// ==================== x402 Protocol Endpoints ====================

// x402 Facilitator: Verify payment
app.post('/api/x402/verify', async (req, res) => {
  try {
    const { x402Version, paymentHeader, paymentRequirements } = req.body

    if (!paymentHeader || !paymentRequirements) {
      return res.status(400).json({
        isValid: false,
        invalidReason: 'Missing paymentHeader or paymentRequirements',
      })
    }

    // Decode payment header (base64)
    let paymentPayload
    try {
      paymentPayload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString())
    } catch (error) {
      return res.status(400).json({
        isValid: false,
        invalidReason: 'Invalid payment header format',
      })
    }

    const verification = await x402Service.verifyPayment(paymentPayload, paymentRequirements)

    res.json(verification)
  } catch (error) {
    console.error('Error in x402 verify:', error)
    res.status(500).json({
      isValid: false,
      invalidReason: error.message || 'Verification failed',
    })
  }
})

// x402 Facilitator: Settle payment
app.post('/api/x402/settle', async (req, res) => {
  try {
    const { x402Version, paymentHeader, paymentRequirements } = req.body

    if (!paymentHeader || !paymentRequirements) {
      return res.status(400).json({
        success: false,
        error: 'Missing paymentHeader or paymentRequirements',
        txHash: null,
        networkId: null,
      })
    }

    // Decode payment header (base64)
    let paymentPayload
    try {
      paymentPayload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString())
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment header format',
        txHash: null,
        networkId: null,
      })
    }

    const settlement = await x402Service.settlePayment(paymentPayload, paymentRequirements)

    res.json(settlement)
  } catch (error) {
    console.error('Error in x402 settle:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Settlement failed',
      txHash: null,
      networkId: null,
    })
  }
})

// x402 Facilitator: Get supported schemes
app.get('/api/x402/supported', (req, res) => {
  try {
    const supported = x402Service.getSupportedSchemes()
    res.json(supported)
  } catch (error) {
    console.error('Error getting supported schemes:', error)
    res.status(500).json({ error: 'Failed to get supported schemes' })
  }
})

// x402 Demo endpoint - returns 402 directly for testing
app.get('/api/x402/demo', (req, res) => {
  try {
    // Check if payment header is present
    const paymentHeader = req.headers['x-payment']
    
    if (paymentHeader) {
      // If payment header exists, verify it
      try {
        const paymentPayload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString())
        const paymentRequirements = x402Service.createPaymentRequirements({
          amount: '0.1', // 0.1 SOL for demo
          recipient: process.env.X402_DEMO_RECIPIENT || '7FSRx9hk9GHcqJNRsG8B9oTLSZSohNB7TZc9pPio45Gn',
          resource: '/api/x402/demo',
          description: 'x402 Demo Payment',
          asset: 'native',
        })
        
        // Verify payment asynchronously
        x402Service.verifyPayment(paymentPayload, paymentRequirements).then((verification) => {
          if (verification.isValid) {
            // Payment verified - return success
            res.json({
              success: true,
              message: 'Payment verified successfully!',
              transaction: verification.transaction,
            })
          } else {
            // Payment invalid - return 402 again
            res.status(402).json({
              x402Version: 1,
              accepts: [paymentRequirements],
              error: verification.invalidReason || 'Payment verification failed',
            })
          }
        }).catch((error) => {
          console.error('Error verifying payment:', error)
          const paymentRequirements = x402Service.createPaymentRequirements({
            amount: '0.1',
            recipient: process.env.X402_DEMO_RECIPIENT || '7FSRx9hk9GHcqJNRsG8B9oTLSZSohNB7TZc9pPio45Gn',
            resource: '/api/x402/demo',
            description: 'x402 Demo Payment',
            asset: 'native',
          })
          res.status(402).json({
            x402Version: 1,
            accepts: [paymentRequirements],
            error: 'Payment verification error',
          })
        })
      } catch (error) {
        // Invalid payment header format
        const paymentRequirements = x402Service.createPaymentRequirements({
          amount: '0.1',
          recipient: process.env.X402_DEMO_RECIPIENT || '7FSRx9hk9GHcqJNRsG8B9oTLSZSohNB7TZc9pPio45Gn',
          resource: '/api/x402/demo',
          description: 'x402 Demo Payment',
          asset: 'native',
        })
        res.status(402).json({
          x402Version: 1,
          accepts: [paymentRequirements],
          error: 'Invalid payment header format',
        })
      }
    } else {
      // No payment header - return 402 with payment requirements
      const paymentRequirements = x402Service.createPaymentRequirements({
        amount: '0.1', // 0.1 SOL for demo
        recipient: process.env.X402_DEMO_RECIPIENT || '7FSRx9hk9GHcqJNRsG8B9oTLSZSohNB7TZc9pPio45Gn',
        resource: '/api/x402/demo',
        description: 'x402 Demo Payment - Send 0.1 SOL to test the protocol',
        asset: 'native',
      })
      
      res.status(402).json({
        x402Version: 1,
        accepts: [paymentRequirements],
        error: null,
      })
    }
  } catch (error) {
    console.error('Error in x402 demo:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
