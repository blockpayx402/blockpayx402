/**
 * SimpleSwap API Integration
 * Production-ready integration with SimpleSwap for cross-chain swaps
 * API Documentation: https://api.simpleswap.io/
 */

import { BLOCKPAY_CONFIG } from '../config.js'
import { validateExchangeOrder, validateAmount, validateAddress } from '../utils/validation.js'

// Validate API key on import
if (!BLOCKPAY_CONFIG.simpleswap.apiKey && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  WARNING: SimpleSwap API key not configured. Set SIMPLESWAP_API_KEY in .env file.')
}

// Configuration constants
const API_TIMEOUT = 15000 // 15 seconds
const MAX_RETRIES = 3
const RETRY_DELAY_BASE = 500 // Base delay in ms
const RETRY_DELAY_MAX = 5000 // Max delay in ms

/**
 * Create a fetch request with timeout
 * @param {string} url - Request URL
 * @param {object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>} - Fetch response
 */
const fetchWithTimeout = async (url, options = {}, timeout = API_TIMEOUT) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`)
    }
    throw error
  }
}

/**
 * Exponential backoff delay
 * @param {number} attempt - Current attempt number (0-indexed)
 * @returns {Promise<void>} - Promise that resolves after delay
 */
const exponentialBackoff = async (attempt) => {
  const delay = Math.min(RETRY_DELAY_BASE * Math.pow(2, attempt), RETRY_DELAY_MAX)
  await new Promise(resolve => setTimeout(resolve, delay))
}

/**
 * Structured logging utility
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - Log message
 * @param {object} metadata - Additional metadata
 */
const log = (level, message, metadata = {}) => {
  const timestamp = new Date().toISOString()
  
  if (level === 'error') {
    console.error(`[${timestamp}] [SimpleSwap] ${message}`, metadata)
  } else if (level === 'warn') {
    console.warn(`[${timestamp}] [SimpleSwap] ${message}`, metadata)
  } else {
    console.log(`[${timestamp}] [SimpleSwap] ${message}`, metadata)
  }
}

/**
 * Currency mapping for SimpleSwap
 * SimpleSwap uses currency codes like: bnb, usdt, eth, etc.
 */
const CURRENCY_MAP = {
  // Native currencies
  'ETH': 'eth',
  'BNB': 'bnb',
  'MATIC': 'matic',
  'SOL': 'sol',
  'BTC': 'btc',
  'LTC': 'ltc',
  'XRP': 'xrp',
  'DOGE': 'doge',
}

/**
 * Network mapping for SimpleSwap
 * SimpleSwap uses network codes in currency format
 */
const NETWORK_MAP = {
  'ethereum': 'eth',
  'bnb': 'bsc',
  'polygon': 'matic',
  'solana': 'sol',
  'bitcoin': 'btc',
}

/**
 * Get SimpleSwap currency code
 * SimpleSwap uses format like: bnb, usdt, usdt_bsc, usdt_eth
 * @param {string} currency - Currency symbol
 * @param {string} chain - Chain name
 * @returns {string} - SimpleSwap currency code
 */
const getSimpleSwapCurrency = (currency, chain = null) => {
  if (!currency) return 'eth'
  const upperCurrency = currency.toUpperCase()
  const chainLower = chain ? chain.toLowerCase() : null
  
  // Native currencies don't need network suffix
  if (CURRENCY_MAP[upperCurrency]) {
    return CURRENCY_MAP[upperCurrency]
  }
  
  // For tokens, include network if specified
  if (chainLower && NETWORK_MAP[chainLower]) {
    const network = NETWORK_MAP[chainLower]
    
    // For BSC tokens, SimpleSwap might use just the currency code
    if (network === 'bsc' && (upperCurrency === 'USDT' || upperCurrency === 'BUSD')) {
      // Try without network suffix first for BSC tokens
      return upperCurrency.toLowerCase()
    }
    
    // For other networks, use currency_network format
    return `${upperCurrency.toLowerCase()}_${network}`
  }
  
  // Fallback: just currency code
  return upperCurrency.toLowerCase()
}

/**
 * Normalize amount to string with up to 8 decimals
 */
const normalizeAmount = (amount) => {
  const num = typeof amount === 'string' ? Number(amount) : amount
  if (!isFinite(num) || num <= 0) return '0'
  return Number(num.toFixed(8)).toString()
}

/**
 * Create a new exchange transaction
 * SimpleSwap API: POST /api/v2/create-exchange
 * @param {object} orderData - Order data
 * @returns {Promise<object>} - Exchange transaction data
 */
export const createExchangeTransaction = async (orderData) => {
  const {
    fromChain,
    fromAsset,
    toChain,
    toAsset,
    amount,
    recipientAddress,
    refundAddress,
    orderId,
  } = orderData

  try {
    // Ensure amount is a number before validation
    const normalizedAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount)
    
    // Create normalized order data for validation
    const normalizedOrderData = {
      ...orderData,
      amount: normalizedAmount
    }
    
    // Input validation
    const validation = validateExchangeOrder(normalizedOrderData)
    if (!validation.valid) {
      log('error', 'Invalid order data', { 
        error: validation.error,
        orderData: { ...orderData, recipientAddress: recipientAddress?.substring(0, 10) + '...' } 
      })
      throw new Error(validation.error)
    }
    
    // Read API key dynamically from environment
    const apiKey = process.env.SIMPLESWAP_API_KEY || BLOCKPAY_CONFIG.simpleswap.apiKey || ''
    
    if (!apiKey || apiKey === '') {
      log('error', 'API key not configured')
      throw new Error('SimpleSwap API key is not configured. Please set SIMPLESWAP_API_KEY in your .env file.')
    }

    // Get currency codes
    const fromCurrency = getSimpleSwapCurrency(fromAsset, fromChain)
    const toCurrency = getSimpleSwapCurrency(toAsset, toChain)
    // SimpleSwap API v1 endpoint format: /v1/create-exchange (base URL already includes /v1)
    const apiUrl = `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/create-exchange`
    
    // Normalize amount
    const payloadAmount = normalizeAmount(normalizedAmount)
    
    // Validate recipient address for destination chain
    const recipientValidation = validateAddress(recipientAddress.trim(), toChain)
    if (!recipientValidation.valid) {
      log('error', 'Recipient address invalid for destination chain', {
        recipientAddress: recipientAddress.substring(0, 10) + '...',
        toChain,
        toAsset,
        error: recipientValidation.error
      })
      throw new Error(`Invalid recipient address for ${toAsset} on ${toChain}: ${recipientValidation.error}`)
    }
    
    // Validate refund address if provided
    let validRefundAddress = null
    if (refundAddress) {
      const refundValidation = validateAddress(refundAddress.trim(), fromChain)
      if (refundValidation.valid) {
        validRefundAddress = refundAddress.trim()
      } else {
        log('warn', 'Refund address invalid for source chain, skipping', {
          refundAddress: refundAddress.substring(0, 10) + '...',
          fromChain,
          error: refundValidation.error
        })
      }
    }
    
    // Prepare payload for SimpleSwap API v1
    // Based on SimpleSwap API documentation format
    const payload = {
      fixed: false, // Use floating rate
      currency_from: fromCurrency,
      currency_to: toCurrency,
      amount: payloadAmount,
      address_to: recipientAddress.trim(),
      ...(validRefundAddress && { address_from: validRefundAddress }), // Refund address
      ...(orderId && { extra_id: orderId }),
    }

    log('info', 'Creating exchange transaction', {
      from: `${fromAsset}(${fromChain})`,
      to: `${toAsset}(${toChain})`,
      amount: payloadAmount,
      recipientPrefix: recipientAddress.substring(0, 10) + '...'
    })

    // Retry on transient server errors with exponential backoff
    let response
    let lastError = null
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // SimpleSwap might use Authorization header or X-API-KEY
        // Try both formats if needed
        const headers = {
          'Content-Type': 'application/json',
        }
        
        // Add authentication - SimpleSwap might use different auth methods
        // Try multiple formats to find what works
        if (apiKey && apiKey.length > 100) {
          // Looks like a JWT/certificate - try Authorization header
          headers['Authorization'] = `Bearer ${apiKey}`
          // Also try as X-API-KEY in case it's expected there
          headers['X-API-KEY'] = apiKey
        } else {
          // Regular API key - use X-API-KEY header
          headers['X-API-KEY'] = apiKey
        }
        
        response = await fetchWithTimeout(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        }, API_TIMEOUT)

        if (response.ok) break

        const status = response.status
        const text = await response.text()
        let parsed
        try { parsed = JSON.parse(text) } catch { parsed = { message: text } }
        
        const isTransient = status >= 500
        const isRetryable = isTransient && attempt < MAX_RETRIES - 1
        
        if (isRetryable) {
          log('warn', `Request failed, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`, {
            status,
            error: parsed.error || parsed.message,
            attempt: attempt + 1
          })
          await exponentialBackoff(attempt)
          continue
        }
        
        lastError = { status, text, parsed }
        break
      } catch (fetchError) {
        if (fetchError.message?.includes('timeout') && attempt < MAX_RETRIES - 1) {
          log('warn', `Request timeout, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`, { attempt: attempt + 1 })
          await exponentialBackoff(attempt)
          continue
        }
        throw fetchError
      }
    }

    if (!response.ok) {
      const errorData = lastError || { status: response.status, text: await response.text() }
      let error
      try {
        error = JSON.parse(errorData.text)
      } catch (e) {
        error = { message: errorData.text || 'Unknown error' }
      }
      
      log('error', 'API request failed', {
        status: errorData.status,
        error: error.error || error.message,
        from: `${fromAsset}(${fromChain})`,
        to: `${toAsset}(${toChain})`,
        apiUrl: apiUrl.replace(apiKey.substring(0, 20), '***'),
        payload: { ...payload, address_to: payload.address_to?.substring(0, 10) + '...' }
      })
      
      // Handle specific error cases
      if (errorData.status === 401 || errorData.status === 403) {
        throw new Error(`Invalid SimpleSwap API key (${errorData.status}): ${error.message || errorData.text}. Please check your SIMPLESWAP_API_KEY in .env file.`)
      } else if (errorData.status === 404) {
        throw new Error(`Exchange pair not available: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain})`)
      } else if (errorData.status === 502) {
        throw new Error(`SimpleSwap API gateway error (502): The service may be temporarily unavailable. Please try again in a few moments. If the issue persists, check SimpleSwap's status page.`)
      } else if (errorData.status >= 500) {
        throw new Error(`SimpleSwap is temporarily unavailable for ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try again shortly.`)
      } else {
        throw new Error(`SimpleSwap API error: ${errorData.status} - ${error.message || error.error || errorData.text}`)
      }
    }

    const data = await response.json()
    log('info', 'Transaction created successfully', {
      exchangeId: data.id || data.exchange_id,
      depositAddressPrefix: (data.address_from || data.deposit_address || '').substring(0, 10) + '...'
    })

    // SimpleSwap API response format
    return {
      depositAddress: data.address_from || data.deposit_address,
      exchangeId: data.id || data.exchange_id,
      estimatedAmount: data.amount_to || data.amount,
      exchangeRate: data.rate || null,
      validUntil: data.valid_until || null,
      flow: data.type || 'standard',
    }
  } catch (error) {
    log('error', 'Failed to create exchange transaction', {
      error: error.message,
      from: `${fromAsset}(${fromChain})`,
      to: `${toAsset}(${toChain})`
    })
    throw error
  }
}

/**
 * Get exchange transaction status
 * SimpleSwap API: GET /api/v2/exchange/{id}
 * @param {string} exchangeId - SimpleSwap exchange transaction ID
 * @returns {Promise<object>} - Transaction status data
 */
export const getExchangeStatus = async (exchangeId) => {
  try {
    if (!exchangeId || typeof exchangeId !== 'string' || exchangeId.trim() === '') {
      throw new Error('Exchange ID is required')
    }
    
    const apiKey = process.env.SIMPLESWAP_API_KEY || BLOCKPAY_CONFIG.simpleswap.apiKey || ''
    
    if (!apiKey || apiKey === '') {
      log('error', 'API key not configured')
      throw new Error('SimpleSwap API key is not configured. Please set SIMPLESWAP_API_KEY in your .env file.')
    }

    // SimpleSwap API v1 endpoint format: /v1/exchange/{id}
    const apiUrl = `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/exchange/${exchangeId.trim()}`
    
    log('info', 'Getting transaction status', { exchangeId })
    
    // SimpleSwap authentication
    const headers = {
      'Content-Type': 'application/json',
    }
    
    if (apiKey && apiKey.length > 100) {
      headers['Authorization'] = `Bearer ${apiKey}`
    } else {
      headers['X-API-KEY'] = apiKey
    }
    
    const response = await fetchWithTimeout(apiUrl, {
      method: 'GET',
      headers,
    }, API_TIMEOUT)

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { message: errorText }
      }
      
      log('error', 'Failed to get transaction status', {
        status: response.status,
        exchangeId,
        error: errorData.message || errorText
      })
      
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Invalid SimpleSwap API key (${response.status}): ${errorData.message || errorText}. Please check your SIMPLESWAP_API_KEY in .env file.`)
      } else if (response.status === 404) {
        throw new Error(`Transaction not found: ${exchangeId}`)
      } else {
        throw new Error(`SimpleSwap API error: ${response.status} - ${errorData.message || errorText}`)
      }
    }

    const data = await response.json()
    log('info', 'Transaction status retrieved', {
      exchangeId,
      status: data.status
    })

    // Map SimpleSwap status to BlockPay status
    const statusMap = {
      'waiting': 'awaiting_deposit',
      'confirming': 'awaiting_deposit',
      'exchanging': 'processing',
      'sending': 'processing',
      'finished': 'completed',
      'failed': 'failed',
      'refunded': 'failed',
      'expired': 'failed',
    }

    return {
      status: statusMap[data.status] || 'awaiting_deposit',
      depositAddress: data.address_from,
      depositTxHash: data.tx_from,
      swapTxHash: data.tx_to,
      fromAmount: data.amount_from,
      toAmount: data.amount_to,
      exchangeRate: data.rate,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    log('error', 'Error getting transaction status', {
      exchangeId,
      error: error.message
    })
    throw error
  }
}

/**
 * Get exchange rate estimate
 * SimpleSwap API: GET /api/v2/estimate
 * @param {string} fromAsset - Source asset symbol
 * @param {string} toAsset - Destination asset symbol
 * @param {string} fromChain - Source chain
 * @param {string} toChain - Destination chain
 * @param {number|string} amount - Amount to exchange
 * @returns {Promise<object>} - Exchange rate data
 */
export const getExchangeRate = async (fromAsset, toAsset, fromChain, toChain, amount) => {
  try {
    // Validate inputs
    const amountValidation = validateAmount(amount)
    if (!amountValidation.valid) {
      throw new Error(amountValidation.error)
    }
    
    const apiKey = process.env.SIMPLESWAP_API_KEY || BLOCKPAY_CONFIG.simpleswap.apiKey || ''
    
    if (!apiKey || apiKey === '') {
      log('error', 'API key is missing')
      throw new Error('SimpleSwap API key is not configured. Please set SIMPLESWAP_API_KEY in your .env file.')
    }

    const fromCurrency = getSimpleSwapCurrency(fromAsset, fromChain)
    const toCurrency = getSimpleSwapCurrency(toAsset, toChain)
    const normalizedAmount = normalizeAmount(amount)
    // SimpleSwap API v1 endpoint format: /v1/estimate
    const apiUrl = `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/estimate?currency_from=${fromCurrency}&currency_to=${toCurrency}&amount=${normalizedAmount}`
    
    log('info', 'Getting exchange rate', {
      from: `${fromAsset}(${fromChain})`,
      to: `${toAsset}(${toChain})`,
      amount: normalizedAmount
    })

    // Retry on transient server errors with exponential backoff
    let response
    let lastError = null
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // SimpleSwap authentication
        const headers = {
          'Content-Type': 'application/json',
        }
        
        if (apiKey && apiKey.length > 100) {
          headers['Authorization'] = `Bearer ${apiKey}`
        } else {
          headers['X-API-KEY'] = apiKey
        }
        
        response = await fetchWithTimeout(apiUrl, {
          method: 'GET',
          headers,
        }, API_TIMEOUT)
        
        if (response.ok) break
        
        const status = response.status
        const text = await response.text()
        let parsed
        try { parsed = JSON.parse(text) } catch { parsed = { message: text } }
        
        const isTransient = status >= 500
        const isRetryable = isTransient && attempt < MAX_RETRIES - 1
        
        if (isRetryable) {
          log('warn', `Rate request failed, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`, {
            status,
            error: parsed.error || parsed.message,
            attempt: attempt + 1
          })
          await exponentialBackoff(attempt)
          continue
        }
        
        lastError = { status, text, parsed }
        break
      } catch (fetchError) {
        if (fetchError.message?.includes('timeout') && attempt < MAX_RETRIES - 1) {
          log('warn', `Rate request timeout, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`, { attempt: attempt + 1 })
          await exponentialBackoff(attempt)
          continue
        }
        throw fetchError
      }
    }

    if (!response.ok) {
      const errorData = lastError || { status: response.status, text: await response.text() }
      let error
      try {
        error = JSON.parse(errorData.text)
      } catch (e) {
        error = { message: errorData.text }
      }
      
      log('error', 'Failed to get exchange rate', {
        status: errorData.status,
        from: `${fromAsset}(${fromChain})`,
        to: `${toAsset}(${toChain})`,
        error: error.error || error.message
      })
      
      if (errorData.status === 401 || errorData.status === 403) {
        throw new Error(`Invalid SimpleSwap API key (${errorData.status}): ${error.message || errorData.text}. Please check your SIMPLESWAP_API_KEY in .env file.`)
      } else if (errorData.status === 404) {
        throw new Error(`Exchange pair not available: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain})`)
      } else if (errorData.status >= 500) {
        throw new Error(`SimpleSwap is temporarily unavailable for ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try again shortly.`)
      } else {
        throw new Error(`SimpleSwap API error: ${errorData.status} - ${error.message || error.error || errorData.text}`)
      }
    }

    const data = await response.json()
    
    const estimatedAmount = data.amount_to || data.estimated_amount || data.amount
    
    if (estimatedAmount === null || estimatedAmount === undefined || isNaN(estimatedAmount)) {
      log('error', 'Invalid response from SimpleSwap API', { data })
      throw new Error('Invalid response from SimpleSwap API')
    }

    log('info', 'Exchange rate retrieved', {
      from: `${fromAsset}(${fromChain})`,
      to: `${toAsset}(${toChain})`,
      estimatedAmount: estimatedAmount.toString()
    })

    return {
      estimatedAmount: estimatedAmount.toString(),
      rate: data.rate || null,
      minAmount: data.min_amount || null,
      maxAmount: data.max_amount || null,
    }
  } catch (error) {
    log('error', 'Error getting exchange rate', {
      from: `${fromAsset}(${fromChain})`,
      to: `${toAsset}(${toChain})`,
      error: error.message
    })
    throw error
  }
}

export default {
  createExchangeTransaction,
  getExchangeStatus,
  getExchangeRate,
}

