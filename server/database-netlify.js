/**
 * Netlify-Compatible Database
 * Uses in-memory storage with localStorage-like persistence for serverless
 */

// In-memory database (persists during function execution)
let memoryDB = {
  payment_requests: [],
  transactions: [],
  orders: []
}

// Try to load from environment (Netlify Functions can use /tmp for persistence)
const loadFromEnv = () => {
  try {
    // In Netlify Functions, we can use /tmp for file storage
    const fs = await import('fs')
    const path = await import('path')
    const tmpPath = path.join('/tmp', 'blockpay-db.json')
    
    if (fs.existsSync(tmpPath)) {
      const data = fs.readFileSync(tmpPath, 'utf-8')
      memoryDB = JSON.parse(data)
    }
  } catch (error) {
    // If /tmp doesn't work, use in-memory only
    console.log('Using in-memory database')
  }
}

// Save to /tmp
const saveToEnv = () => {
  try {
    const fs = await import('fs')
    const path = await import('path')
    const tmpPath = path.join('/tmp', 'blockpay-db.json')
    fs.writeFileSync(tmpPath, JSON.stringify(memoryDB))
  } catch (error) {
    // Ignore if /tmp not available
  }
}

// Initialize on import
loadFromEnv()

// Helper functions matching dbHelpers interface
export const dbHelpers = {
  // Payment Requests
  createRequest: (requestData) => {
    const request = {
      id: requestData.id || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      amount: requestData.amount || '0',
      currency: requestData.currency || 'ETH',
      chain: requestData.chain || 'ethereum',
      description: requestData.description || '',
      recipient: requestData.recipient || '',
      status: requestData.status || 'pending',
      createdAt: requestData.createdAt || requestData.created_at || new Date().toISOString(),
      expiresAt: requestData.expiresAt || requestData.expires_at || new Date(Date.now() + 3600000).toISOString(),
      updatedAt: requestData.updatedAt || requestData.updated_at || new Date().toISOString(),
      lastChecked: requestData.lastChecked || requestData.last_checked || null,
    }
    
    memoryDB.payment_requests.push(request)
    saveToEnv()
    return request
  },

  getRequestById: (id) => {
    return memoryDB.payment_requests.find(r => r.id === id) || null
  },

  getAllRequests: () => {
    return [...memoryDB.payment_requests]
  },

  updateRequestStatus: (id, status, lastChecked = null) => {
    const request = memoryDB.payment_requests.find(r => r.id === id)
    if (request) {
      request.status = status
      request.updatedAt = new Date().toISOString()
      if (lastChecked) request.lastChecked = lastChecked
      saveToEnv()
    }
    return request
  },

  isRequestExpired: (request) => {
    if (!request.expiresAt) return false
    return new Date(request.expiresAt) < new Date()
  },

  deleteExpiredRequests: () => {
    const now = new Date()
    const before = memoryDB.payment_requests.length
    memoryDB.payment_requests = memoryDB.payment_requests.filter(
      req => !req.expiresAt || new Date(req.expiresAt) > now
    )
    saveToEnv()
    return before - memoryDB.payment_requests.length
  },

  // Transactions
  createTransaction: (transactionData) => {
    const transaction = {
      id: transactionData.id || `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      requestId: transactionData.requestId || transactionData.request_id || null,
      amount: transactionData.amount || '0',
      currency: transactionData.currency || 'ETH',
      chain: transactionData.chain || 'ethereum',
      from: transactionData.from || transactionData.from_address || 'Unknown',
      to: transactionData.to || transactionData.to_address || 'Unknown',
      status: transactionData.status || 'completed',
      description: transactionData.description || '',
      txHash: transactionData.txHash || transactionData.tx_hash || null,
      timestamp: transactionData.timestamp || new Date().toISOString(),
    }
    
    memoryDB.transactions.push(transaction)
    saveToEnv()
    return transaction
  },

  getAllTransactions: () => {
    return [...memoryDB.transactions]
  },

  getTransactionsByRequestId: (requestId) => {
    return memoryDB.transactions.filter(tx => tx.requestId === requestId)
  },

  // Orders
  createOrder: (orderData) => {
    const order = {
      id: orderData.id || `order_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      requestId: orderData.requestId,
      fromChain: orderData.fromChain,
      fromAsset: orderData.fromAsset,
      toChain: orderData.toChain,
      toAsset: orderData.toAsset,
      amount: orderData.amount || null,
      depositAddress: orderData.depositAddress,
      refundAddress: orderData.refundAddress || null,
      status: orderData.status || 'awaiting_deposit',
      expectedAmount: orderData.expectedAmount || null,
      createdAt: orderData.createdAt || new Date().toISOString(),
      updatedAt: orderData.updatedAt || new Date().toISOString(),
      exchangeId: orderData.exchangeId || null,
      platformFeeAmount: orderData.platformFeeAmount || null,
      platformFeePercent: orderData.platformFeePercent || null,
      amountAfterFee: orderData.amountAfterFee || null,
    }
    
    memoryDB.orders.push(order)
    saveToEnv()
    return order
  },

  getOrderById: (id) => {
    return memoryDB.orders.find(o => o.id === id) || null
  },

  getOrderByDepositAddress: (address) => {
    return memoryDB.orders.find(o => o.depositAddress === address && o.status === 'awaiting_deposit') || null
  },

  updateOrderStatus: (orderId, status, depositTxHash = null, swapTxHash = null, exchangeId = null) => {
    const order = memoryDB.orders.find(o => o.id === orderId)
    if (order) {
      order.status = status
      order.updatedAt = new Date().toISOString()
      if (depositTxHash) order.depositTxHash = depositTxHash
      if (swapTxHash) order.swapTxHash = swapTxHash
      if (exchangeId) order.exchangeId = exchangeId
      saveToEnv()
    }
    return order
  },

  getOrdersByRequestId: (requestId) => {
    return memoryDB.orders.filter(o => o.requestId === requestId)
  }
}

