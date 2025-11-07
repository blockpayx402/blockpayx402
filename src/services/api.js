import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'blockpay.cloud' || window.location.hostname.includes('blockpay.cloud')
    ? 'https://blockpay.cloud/api' 
    : 'http://localhost:3001/api')

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Payment Requests API
export const paymentRequestsAPI = {
  getAll: async () => {
    try {
      const response = await api.get('/requests')
      return response.data
    } catch (error) {
      console.error('Error fetching payment requests:', error)
      // Fallback to localStorage
      const local = localStorage.getItem('blockPayment_requests')
      return local ? JSON.parse(local) : []
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/requests/${id}`)
      return response.data
    } catch (error) {
      // Don't log 404 errors as errors - they're expected if request doesn't exist
      if (error.response?.status !== 404) {
        console.error('Error fetching payment request:', error)
      }
      // Fallback to localStorage
      const local = localStorage.getItem('blockPayment_requests')
      const requests = local ? JSON.parse(local) : []
      return requests.find(r => r.id === id) || null
    }
  },

  create: async (requestData) => {
    try {
      const response = await api.post('/requests', requestData)
      return response.data
    } catch (error) {
      console.error('Error creating payment request:', error)
      // Still return the data for local storage fallback
      return requestData
    }
  },

  update: async (id, updates) => {
    try {
      const response = await api.put(`/requests/${id}`, updates)
      return response.data
    } catch (error) {
      console.error('Error updating payment request:', error)
      return null
    }
  },

  syncAll: async (requests, transactions) => {
    try {
      const response = await api.post('/sync', { requests, transactions })
      return response.data
    } catch (error) {
      console.error('Error syncing requests:', error)
      return null
    }
  },
}

// Transactions API
export const transactionsAPI = {
  getAll: async () => {
    try {
      const response = await api.get('/transactions')
      return response.data
    } catch (error) {
      console.error('Error fetching transactions:', error)
      // Fallback to localStorage
      const local = localStorage.getItem('blockPayment_transactions')
      return local ? JSON.parse(local) : []
    }
  },

  create: async (transactionData) => {
    try {
      const response = await api.post('/transactions', transactionData)
      return response.data
    } catch (error) {
      console.error('Error creating transaction:', error)
      // Still return the data for local storage fallback
      return transactionData.id ? transactionData : { ...transactionData, id: `tx_${Date.now()}_${Math.random().toString(36).substring(7)}` }
    }
  },
}

// Sync API - Sync all data with server
export const syncAPI = {
  syncAll: async (requests, transactions) => {
    try {
      const response = await api.post('/sync', { requests, transactions })
      return response.data
    } catch (error) {
      console.error('Error syncing data:', error)
      return { requests: requests || [], transactions: transactions || [] }
    }
  },
}

// Health check
export const healthCheck = async () => {
  try {
    const response = await api.get('/health')
    return response.data
  } catch (error) {
    return null
  }
}

