/**
 * x402 Client Service
 * Handles x402 protocol client-side operations
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'blockpay.cloud' || window.location.hostname.includes('blockpay.cloud')
    ? 'https://blockpay.cloud/api' 
    : 'http://localhost:3001/api')

/**
 * Fetch a resource with x402 payment protocol support
 * @param {string} url - Resource URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Response with resource or 402 payment required
 */
export async function fetchWithX402(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-Payment-Protocol': 'x402/1.0',
    },
  })

  // If 402, return the payment requirements
  if (response.status === 402) {
    const paymentData = await response.json()
    return {
      status: 402,
      paymentRequired: true,
      paymentData,
      response,
    }
  }

  return {
    status: response.status,
    paymentRequired: false,
    response,
  }
}

/**
 * Get payment requirements for a resource
 * @param {string} resourceUrl - Resource URL
 * @returns {Promise<Object>} Payment requirements
 */
export async function getPaymentRequirements(resourceUrl) {
  const result = await fetchWithX402(resourceUrl)
  
  if (result.paymentRequired) {
    return result.paymentData
  }

  throw new Error('Resource does not require payment')
}

/**
 * Verify payment with facilitator
 * @param {string} paymentHeader - Base64 encoded payment payload
 * @param {Object} paymentRequirements - Payment requirements
 * @returns {Promise<Object>} Verification result
 */
export async function verifyPayment(paymentHeader, paymentRequirements) {
  const response = await fetch(`${API_BASE_URL}/x402/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      x402Version: 1,
      paymentHeader,
      paymentRequirements,
    }),
  })

  return await response.json()
}

/**
 * Settle payment with facilitator
 * @param {string} paymentHeader - Base64 encoded payment payload
 * @param {Object} paymentRequirements - Payment requirements
 * @returns {Promise<Object>} Settlement result
 */
export async function settlePayment(paymentHeader, paymentRequirements) {
  const response = await fetch(`${API_BASE_URL}/x402/settle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      x402Version: 1,
      paymentHeader,
      paymentRequirements,
    }),
  })

  return await response.json()
}

/**
 * Get supported payment schemes
 * @returns {Promise<Object>} Supported schemes
 */
export async function getSupportedSchemes() {
  const response = await fetch(`${API_BASE_URL}/x402/supported`)
  return await response.json()
}

/**
 * Create payment payload for Solana transaction
 * @param {string} signature - Transaction signature
 * @param {string} scheme - Payment scheme (default: 'exact')
 * @param {string} network - Network (default: 'solana-mainnet')
 * @returns {string} Base64 encoded payment header
 */
export function createPaymentHeader(signature, scheme = 'exact', network = 'solana-mainnet') {
  const payload = {
    x402Version: 1,
    scheme,
    network,
    payload: {
      signature,
    },
  }

  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

