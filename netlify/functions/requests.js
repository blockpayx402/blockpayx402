// Netlify Function: Payment Requests API
import { dbHelpers } from '../../server/database.js'

export const handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  // Handle OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  try {
    const { id } = event.pathParameters || {}

    // GET /api/requests - Get all requests
    if (event.httpMethod === 'GET' && !id) {
      const requests = dbHelpers.getAllRequests()
      const requestsWithExpiration = requests.map(req => {
        const isExpired = dbHelpers.isRequestExpired(req)
        return {
          ...req,
          isExpired,
          status: isExpired && req.status === 'pending' ? 'expired' : req.status
        }
      })
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(requestsWithExpiration)
      }
    }

    // GET /api/requests/:id - Get single request
    if (event.httpMethod === 'GET' && id) {
      const request = dbHelpers.getRequestById(id)
      if (!request) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Payment request not found' })
        }
      }
      const isExpired = dbHelpers.isRequestExpired(request)
      const requestWithExpiration = {
        ...request,
        isExpired,
        status: isExpired && request.status === 'pending' ? 'expired' : request.status
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(requestWithExpiration)
      }
    }

    // POST /api/requests - Create request
    if (event.httpMethod === 'POST') {
      const requestData = JSON.parse(event.body)
      const newRequest = {
        ...requestData,
        id: requestData.id || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        createdAt: requestData.createdAt || new Date().toISOString(),
      }
      const created = dbHelpers.createRequest(newRequest)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(created)
      }
    }

    // PUT /api/requests/:id - Update request
    if (event.httpMethod === 'PUT' && id) {
      const request = dbHelpers.getRequestById(id)
      if (!request) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Payment request not found' })
        }
      }
      const updates = JSON.parse(event.body)
      const updatedRequest = dbHelpers.updateRequestStatus(
        id,
        updates.status || request.status,
        updates.lastChecked || null
      )
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(updatedRequest)
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Error in requests function:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    }
  }
}

