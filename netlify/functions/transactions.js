// Netlify Function: Transactions API
import { dbHelpers } from '../../server/database.js'

export const handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  try {
    // GET /api/transactions - Get all transactions
    if (event.httpMethod === 'GET') {
      const transactions = dbHelpers.getAllTransactions()
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(transactions)
      }
    }

    // POST /api/transactions - Create transaction
    if (event.httpMethod === 'POST') {
      const transactionData = JSON.parse(event.body)
      const newTransaction = {
        ...transactionData,
        id: transactionData.id || `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        timestamp: transactionData.timestamp || new Date().toISOString(),
      }
      const created = dbHelpers.createTransaction(newTransaction)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(created)
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Error in transactions function:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

