import express from 'express'
import cors from 'cors'
import { dbHelpers } from './database.js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`💾 Database: SQLite`)
  console.log(`⏰ Payment requests expire after 1 hour`)
})
