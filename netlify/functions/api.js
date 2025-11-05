/**
 * Netlify Serverless Function for BlockPay API
 * This handles API requests when backend is deployed separately
 */

// This is a proxy function - redirects to your actual backend
export const handler = async (event, context) => {
  // Get the backend URL from environment variable
  const backendUrl = process.env.BACKEND_URL || 'https://your-backend-server.com'
  
  const path = event.path.replace('/.netlify/functions/api', '/api')
  const url = `${backendUrl}${path}${event.rawQuery ? '?' + event.rawQuery : ''}`
  
  try {
    const response = await fetch(url, {
      method: event.httpMethod,
      headers: {
        'Content-Type': 'application/json',
        ...event.headers,
      },
      body: event.body,
    })
    
    const data = await response.text()
    
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: data,
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Backend server unavailable' }),
    }
  }
}

