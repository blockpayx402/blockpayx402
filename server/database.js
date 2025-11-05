import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DATA_DIR = join(__dirname, 'data')
const DB_PATH = join(DATA_DIR, 'blockpayment.db')

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

// Initialize database
const db = new Database(DB_PATH)

// Enable foreign keys
db.pragma('foreign_keys = ON')

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS payment_requests (
    id TEXT PRIMARY KEY,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL,
    chain TEXT NOT NULL,
    description TEXT,
    recipient TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    updated_at TEXT,
    last_checked TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    request_id TEXT,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL,
    chain TEXT,
    from_address TEXT,
    to_address TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    description TEXT,
    tx_hash TEXT,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (request_id) REFERENCES payment_requests(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
  CREATE INDEX IF NOT EXISTS idx_payment_requests_expires_at ON payment_requests(expires_at);
  CREATE INDEX IF NOT EXISTS idx_transactions_request_id ON transactions(request_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    from_chain TEXT NOT NULL,
    from_asset TEXT NOT NULL,
    to_chain TEXT NOT NULL,
    to_asset TEXT NOT NULL,
    amount TEXT,
    deposit_address TEXT NOT NULL,
    refund_address TEXT,
    status TEXT DEFAULT 'awaiting_deposit',
    expected_amount TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deposit_tx_hash TEXT,
    swap_tx_hash TEXT,
    FOREIGN KEY (request_id) REFERENCES payment_requests(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_orders_request_id ON orders(request_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_deposit_address ON orders(deposit_address);
`)

// Prepare statements for better performance
const statements = {
  // Payment Requests
  insertRequest: db.prepare(`
    INSERT INTO payment_requests (
      id, amount, currency, chain, description, recipient, status, 
      created_at, expires_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  updateRequest: db.prepare(`
    UPDATE payment_requests 
    SET status = ?, updated_at = ?, last_checked = ?
    WHERE id = ?
  `),
  
  getRequestById: db.prepare(`
    SELECT * FROM payment_requests WHERE id = ?
  `),
  
  getAllRequests: db.prepare(`
    SELECT * FROM payment_requests 
    ORDER BY created_at DESC
  `),
  
  getActiveRequests: db.prepare(`
    SELECT * FROM payment_requests 
    WHERE status = 'pending' AND expires_at > datetime('now')
    ORDER BY created_at DESC
  `),
  
  deleteExpiredRequests: db.prepare(`
    DELETE FROM payment_requests 
    WHERE expires_at < datetime('now')
  `),
  
  // Transactions
  insertTransaction: db.prepare(`
    INSERT INTO transactions (
      id, request_id, amount, currency, chain, from_address, 
      to_address, status, description, tx_hash, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  getAllTransactions: db.prepare(`
    SELECT * FROM transactions 
    ORDER BY timestamp DESC
  `),
  
  getTransactionsByRequestId: db.prepare(`
    SELECT * FROM transactions 
    WHERE request_id = ?
    ORDER BY timestamp DESC
  `),
  
  // Orders
  insertOrder: db.prepare(`
    INSERT INTO orders (
      id, request_id, from_chain, from_asset, to_chain, to_asset, 
      amount, deposit_address, refund_address, status, expected_amount,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  getOrderById: db.prepare(`
    SELECT * FROM orders WHERE id = ?
  `),
  
  getOrderByDepositAddress: db.prepare(`
    SELECT * FROM orders WHERE deposit_address = ? AND status = 'awaiting_deposit'
  `),
  
  updateOrderStatus: db.prepare(`
    UPDATE orders 
    SET status = ?, updated_at = ?, deposit_tx_hash = ?, swap_tx_hash = ?
    WHERE id = ?
  `),
  
  getOrdersByRequestId: db.prepare(`
    SELECT * FROM orders 
    WHERE request_id = ?
    ORDER BY created_at DESC
  `)
}

// Helper functions
export const dbHelpers = {
  // Payment Requests
  createRequest: (requestData) => {
    const now = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
    
    const request = {
      id: requestData.id || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      amount: requestData.amount,
      currency: requestData.currency,
      chain: requestData.chain || 'ethereum',
      description: requestData.description || '',
      recipient: requestData.recipient,
      status: requestData.status || 'pending',
      createdAt: requestData.createdAt || now,
      expiresAt: requestData.expiresAt || expiresAt,
      updatedAt: requestData.updatedAt || now,
      lastChecked: requestData.lastChecked || null
    }
    
    try {
      statements.insertRequest.run(
        request.id,
        request.amount,
        request.currency,
        request.chain,
        request.description,
        request.recipient,
        request.status,
        request.createdAt,
        request.expiresAt,
        request.updatedAt
      )
      
      return request
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        // Request already exists, update it
        statements.updateRequest.run(
          request.status,
          request.updatedAt,
          request.lastChecked,
          request.id
        )
        return request
      }
      throw error
    }
  },
  
  updateRequestStatus: (requestId, status, lastChecked = null) => {
    const updatedAt = new Date().toISOString()
    statements.updateRequest.run(status, updatedAt, lastChecked, requestId)
    return dbHelpers.getRequestById(requestId)
  },
  
  getRequestById: (id) => {
    const row = statements.getRequestById.get(id)
    if (!row) return null
    
    return {
      id: row.id,
      amount: row.amount,
      currency: row.currency,
      chain: row.chain,
      description: row.description,
      recipient: row.recipient,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      updatedAt: row.updated_at,
      lastChecked: row.last_checked
    }
  },
  
  getAllRequests: () => {
    const rows = statements.getAllRequests.all()
    return rows.map(row => ({
      id: row.id,
      amount: row.amount,
      currency: row.currency,
      chain: row.chain,
      description: row.description,
      recipient: row.recipient,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      updatedAt: row.updated_at,
      lastChecked: row.last_checked
    }))
  },
  
  getActiveRequests: () => {
    const rows = statements.getActiveRequests.all()
    return rows.map(row => ({
      id: row.id,
      amount: row.amount,
      currency: row.currency,
      chain: row.chain,
      description: row.description,
      recipient: row.recipient,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      updatedAt: row.updated_at,
      lastChecked: row.last_checked
    }))
  },
  
  deleteExpiredRequests: () => {
    const result = statements.deleteExpiredRequests.run()
    return result.changes
  },
  
  isRequestExpired: (request) => {
    if (!request || !request.expiresAt) return false
    return new Date(request.expiresAt) < new Date()
  },
  
  // Transactions
  createTransaction: (transactionData) => {
    const transaction = {
      id: transactionData.id || `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      requestId: transactionData.requestId || null,
      amount: transactionData.amount,
      currency: transactionData.currency,
      chain: transactionData.chain || null,
      from: transactionData.from || null,
      to: transactionData.to,
      status: transactionData.status || 'completed',
      description: transactionData.description || '',
      txHash: transactionData.txHash || null,
      timestamp: transactionData.timestamp || new Date().toISOString()
    }
    
    try {
      statements.insertTransaction.run(
        transaction.id,
        transaction.requestId,
        transaction.amount,
        transaction.currency,
        transaction.chain,
        transaction.from,
        transaction.to,
        transaction.status,
        transaction.description,
        transaction.txHash,
        transaction.timestamp
      )
      
      return transaction
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        // Transaction already exists, return existing
        return transaction
      }
      throw error
    }
  },
  
  getAllTransactions: () => {
    const rows = statements.getAllTransactions.all()
    return rows.map(row => ({
      id: row.id,
      requestId: row.request_id,
      amount: row.amount,
      currency: row.currency,
      chain: row.chain,
      from: row.from_address || null,
      to: row.to_address || null,
      status: row.status,
      description: row.description || '',
      txHash: row.tx_hash || null,
      timestamp: row.timestamp,
      // Also include snake_case versions for compatibility
      from_address: row.from_address,
      to_address: row.to_address,
      tx_hash: row.tx_hash,
      request_id: row.request_id
    }))
  },
  
  getTransactionsByRequestId: (requestId) => {
    const rows = statements.getTransactionsByRequestId.all(requestId)
    return rows.map(row => ({
      id: row.id,
      requestId: row.request_id,
      amount: row.amount,
      currency: row.currency,
      chain: row.chain,
      from: row.from_address,
      to: row.to_address,
      status: row.status,
      description: row.description,
      txHash: row.tx_hash,
      timestamp: row.timestamp
    }))
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
    }
    
    try {
      statements.insertOrder.run(
        order.id,
        order.requestId,
        order.fromChain,
        order.fromAsset,
        order.toChain,
        order.toAsset,
        order.amount,
        order.depositAddress,
        order.refundAddress,
        order.status,
        order.expectedAmount,
        order.createdAt,
        order.updatedAt
      )
      
      return order
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        return order
      }
      throw error
    }
  },
  
  getOrderById: (id) => {
    const row = statements.getOrderById.get(id)
    if (!row) return null
    
    return {
      id: row.id,
      requestId: row.request_id,
      fromChain: row.from_chain,
      fromAsset: row.from_asset,
      toChain: row.to_chain,
      toAsset: row.to_asset,
      amount: row.amount,
      depositAddress: row.deposit_address,
      refundAddress: row.refund_address,
      status: row.status,
      expectedAmount: row.expected_amount,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      depositTxHash: row.deposit_tx_hash,
      swapTxHash: row.swap_tx_hash,
    }
  },
  
  getOrderByDepositAddress: (address) => {
    const row = statements.getOrderByDepositAddress.get(address)
    if (!row) return null
    
    return {
      id: row.id,
      requestId: row.request_id,
      fromChain: row.from_chain,
      fromAsset: row.from_asset,
      toChain: row.to_chain,
      toAsset: row.to_asset,
      amount: row.amount,
      depositAddress: row.deposit_address,
      refundAddress: row.refund_address,
      status: row.status,
      expectedAmount: row.expected_amount,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      depositTxHash: row.deposit_tx_hash,
      swapTxHash: row.swap_tx_hash,
    }
  },
  
  updateOrderStatus: (orderId, status, depositTxHash = null, swapTxHash = null) => {
    const updatedAt = new Date().toISOString()
    statements.updateOrderStatus.run(status, updatedAt, depositTxHash, swapTxHash, orderId)
    return dbHelpers.getOrderById(orderId)
  },
  
  getOrdersByRequestId: (requestId) => {
    const rows = statements.getOrdersByRequestId.all(requestId)
    return rows.map(row => ({
      id: row.id,
      requestId: row.request_id,
      fromChain: row.from_chain,
      fromAsset: row.from_asset,
      toChain: row.to_chain,
      toAsset: row.to_asset,
      amount: row.amount,
      depositAddress: row.deposit_address,
      refundAddress: row.refund_address,
      status: row.status,
      expectedAmount: row.expected_amount,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      depositTxHash: row.deposit_tx_hash,
      swapTxHash: row.swap_tx_hash,
    }))
  }
}

// Cleanup expired requests every 5 minutes
setInterval(() => {
  try {
    const deleted = dbHelpers.deleteExpiredRequests()
    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} expired payment request(s)`)
    }
  } catch (error) {
    console.error('Error cleaning up expired requests:', error)
  }
}, 5 * 60 * 1000) // Every 5 minutes

export default db

