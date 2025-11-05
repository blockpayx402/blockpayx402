// Netlify Function: Orders by Request ID
import { dbHelpers } from '../../server/database.js'

export const handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }

  try {
    const { requestId } = event.pathParameters || {}
    
    if (!requestId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request ID required' })
      }
    }

    const orders = dbHelpers.getOrdersByRequestId(requestId)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(orders)
    }
  } catch (error) {
    console.error('Error fetching orders:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

