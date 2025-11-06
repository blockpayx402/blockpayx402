/**
 * Netlify-Compatible Database
 * Uses in-memory storage with localStorage-like persistence for serverless
 */

import { BLOCKPAY_CONFIG } from './config.js'

// In-memory database (persists during function execution)
let memoryDB = {
  payment_requests: [],
  transactions: [],
  orders: []
}

// Try to load from environment (Netlify Functions can use /tmp for persistence)
const loadFromEnv = async () => {
  try {
    // In Netlify Functions, we can use /tmp for file storage
    const fs = await import('fs')
    const path = await import('path')
    const tmpPath = path.join('/tmp', 'blockpay-db.json')
    const backupPath = path.join('/tmp', 'blockpay-db-backup.json')
    
    // Try primary file first
    if (fs.existsSync(tmpPath)) {
      try {
        const data = fs.readFileSync(tmpPath, 'utf-8')
        memoryDB = JSON.parse(data)
        console.log('✅ Loaded database from /tmp:', {
          requests: memoryDB.payment_requests?.length || 0,
          transactions: memoryDB.transactions?.length || 0,
          orders: memoryDB.orders?.length || 0
        })
        return
      } catch (error) {
        console.error('Error loading primary database, trying backup:', error)
      }
    }
    
    // Try backup file
    if (fs.existsSync(backupPath)) {
      try {
        const data = fs.readFileSync(backupPath, 'utf-8')
        memoryDB = JSON.parse(data)
        console.log('✅ Loaded database from backup')
        // Restore primary file
        fs.writeFileSync(tmpPath, data, 'utf8')
        return
      } catch (error) {
        console.error('Error loading backup database:', error)
      }
    }
    
    console.log('ℹ️  No existing database found, starting fresh')
  } catch (error) {
    console.log('Using in-memory database (no file system access):', error.message)
  }
}

// Save to /tmp - Use async for ES modules
let savePromise = null
const saveToEnv = async () => {
  // Prevent multiple simultaneous saves
  if (savePromise) {
    return savePromise
  }
  
  savePromise = (async () => {
    try {
      const fs = await import('fs')
      const path = await import('path')
      const tmpPath = path.join('/tmp', 'blockpay-db.json')
      const backupPath = path.join('/tmp', 'blockpay-db-backup.json')
      
      // Write with atomic operation - write to temp file first, then rename
      const tmpFile = tmpPath + '.tmp'
      const data = JSON.stringify(memoryDB, null, 2)
      
      fs.writeFileSync(tmpFile, data, 'utf8')
      fs.renameSync(tmpFile, tmpPath)
      
      // Also create backup
      fs.writeFileSync(backupPath, data, 'utf8')
    } catch (error) {
      console.error('Failed to save database:', error.message)
    } finally {
      savePromise = null
    }
  })()
  
  return savePromise
}

// Initialize on import (async)
loadFromEnv().catch(() => {})

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
      expiresAt: requestData.expiresAt || requestData.expires_at || new Date(Date.now() + (BLOCKPAY_CONFIG.paymentRequest.expirationHours || 1) * 60 * 60 * 1000).toISOString(),
      updatedAt: requestData.updatedAt || requestData.updated_at || new Date().toISOString(),
      lastChecked: requestData.lastChecked || requestData.last_checked || null,
    }
    
    // Check if request already exists
    const existing = memoryDB.payment_requests.find(r => r.id === request.id)
    if (existing) {
      return existing
    }
    
    memoryDB.payment_requests.push(request)
    saveToEnv().catch(() => {})
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
      saveToEnv().catch(() => {})
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
    // Only delete expired pending requests; keep completed/failed for history
    memoryDB.payment_requests = memoryDB.payment_requests.filter(req => {
      if (!req.expiresAt) return true
      const isExpired = new Date(req.expiresAt) <= now
      if (isExpired && req.status === 'pending') return false
      return true
    })
    saveToEnv().catch(() => {})
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
    
    // Check if transaction already exists (prevent duplicates)
    const existing = memoryDB.transactions.find(tx => 
      (tx.txHash && transaction.txHash && tx.txHash === transaction.txHash) ||
      (tx.id === transaction.id)
    )
    
    if (existing) {
      console.log('Transaction already exists, updating:', transaction.id)
      // Update existing transaction
      Object.assign(existing, transaction)
      saveToEnv().catch(() => {})
      return existing
    }
    
    memoryDB.transactions.push(transaction)
    // Save immediately - fire and forget
    saveToEnv().catch(err => console.error('Save error:', err))
    console.log('✅ Transaction saved to server:', {
      id: transaction.id,
      requestId: transaction.requestId,
      txHash: transaction.txHash,
      amount: transaction.amount,
      currency: transaction.currency,
      totalTransactions: memoryDB.transactions.length
    })
    return transaction
  },

  getAllTransactions: () => {
    return [...memoryDB.transactions]
  },

  getTransactionsByRequestId: (requestId) => {
    return memoryDB.transactions.filter(tx => tx.requestId === requestId)
  },

  getTransactionById: (id) => {
    return memoryDB.transactions.find(tx => tx.id === id) || null
  },

  // Ensure data is persisted - call this after critical operations
  ensurePersisted: async () => {
    await saveToEnv().catch(() => {})
    return true
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
    
    // Check if order already exists
    const existing = memoryDB.orders.find(o => o.id === order.id)
    if (existing) {
      return existing
    }
    
    memoryDB.orders.push(order)
    saveToEnv().catch(() => {})
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
      saveToEnv().catch(() => {})
    }
    return order
  },

  getOrdersByRequestId: (requestId) => {
    return memoryDB.orders.filter(o => o.requestId === requestId)
  }
}

