/**
 * ChangeNOW API Integration
 * Production-ready integration with ChangeNOW for cross-chain swaps
 */

import { BLOCKPAY_CONFIG, getChangeNowHeaders } from '../config.js'
import { validateExchangeOrder, validateAmount, validateAddress } from '../utils/validation.js'

// Validate API key on import
if (!BLOCKPAY_CONFIG.changenow.apiKey && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  WARNING: ChangeNOW API key not configured. Set CHANGENOW_API_KEY in .env file.')
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
  const logData = {
    timestamp,
    service: 'ChangeNOW',
    level,
    message,
    ...metadata
  }
  
  if (level === 'error') {
    console.error(`[${timestamp}] [ChangeNOW] ${message}`, metadata)
  } else if (level === 'warn') {
    console.warn(`[${timestamp}] [ChangeNOW] ${message}`, metadata)
  } else {
    console.log(`[${timestamp}] [ChangeNOW] ${message}`, metadata)
  }
}

/**
 * Currency mapping for ChangeNOW
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
 * Network mapping for ChangeNOW
 */
const NETWORK_MAP = {
  'ethereum': 'eth',
  'bnb': 'bsc',
  'polygon': 'matic',
  'solana': 'sol',
  'bitcoin': 'btc',
}

/**
 * Get ChangeNOW currency code with network specification
 * For tokens, includes network: e.g., "usdc_eth", "usdc_bsc", "usdc_sol"
 * For native currencies, returns just the currency code
 * 
 * Note: ChangeNOW v1 uses different formats:
 * - BSC tokens: For USDT on BSC, ChangeNOW uses just "usdt" (not "usdt_bsc")
 * - Ethereum tokens: "usdt_eth" or "usdt"
 * - Solana tokens: "usdc_sol"
 */
const getChangeNowCurrency = (currency, chain = null) => {
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
    
    // Special handling for BSC tokens
    // ChangeNOW v1 API uses just "usdt" for USDT on BSC (not "usdt_bsc")
    if (network === 'bsc' && (upperCurrency === 'USDT' || upperCurrency === 'BUSD')) {
      // For USDT and BUSD on BSC, use just the currency code without network suffix
      return upperCurrency.toLowerCase()
    }
    
    // For other networks, use currency_network format
    // Format: currency_network (e.g., usdc_eth, usdc_sol)
    return `${upperCurrency.toLowerCase()}_${network}`
  }
  
  // Fallback: just currency code
  return upperCurrency.toLowerCase()
}

/**
 * Get ChangeNOW network code
 */
const getChangeNowNetwork = (chain) => {
  return NETWORK_MAP[chain] || chain.toLowerCase()
}

// Normalize amount to string with up to 8 decimals (v1 accepts number-like strings)
const normalizeAmount = (amount) => {
  const num = typeof amount === 'string' ? Number(amount) : amount
  if (!isFinite(num) || num <= 0) return '0'
  // Trim trailing zeros
  return Number(num.toFixed(8)).toString()
}

// Get minimum amount for a pair (v1)
const getMinAmountV1 = async (fromAsset, toAsset, fromChain, toChain) => {
  try {
    const apiKey = process.env.CHANGENOW_API_KEY || BLOCKPAY_CONFIG.changenow.apiKey || ''
    if (!apiKey) return null
    const fromCurrency = getChangeNowCurrency(fromAsset, fromChain)
    const toCurrency = getChangeNowCurrency(toAsset, toChain)
    const url = `https://api.changenow.io/v1/min-amount/${fromCurrency}_${toCurrency}?api_key=${apiKey}`
    const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    // v1 returns just a number or { minAmount }
    const value = typeof data === 'number' ? data : (data.minAmount || data.min_amount)
    return typeof value === 'number' && value > 0 ? Number(value.toFixed(8)) : null
  } catch {
    return null
  }
}

/**
 * Create a new exchange transaction
 * Returns deposit address and order ID
 * @param {object} orderData - Order data
 * @param {string} orderData.fromChain - Source chain
 * @param {string} orderData.fromAsset - Source asset
 * @param {string} orderData.toChain - Destination chain
 * @param {string} orderData.toAsset - Destination asset
 * @param {number|string} orderData.amount - Amount to exchange
 * @param {string} orderData.recipientAddress - Recipient address
 * @param {string} [orderData.refundAddress] - Refund address (optional)
 * @param {string} [orderData.orderId] - BlockPay order ID (optional)
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
    orderId, // BlockPay order ID
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
        originalAmount: amount,
        normalizedAmount: normalizedAmount,
        amountType: typeof amount,
        orderData: { ...orderData, recipientAddress: recipientAddress?.substring(0, 10) + '...' } 
      })
      throw new Error(validation.error)
    }
    
    // Read API key dynamically from environment
    const apiKey = process.env.CHANGENOW_API_KEY || BLOCKPAY_CONFIG.changenow.apiKey || ''
    
    if (!apiKey || apiKey === '') {
      log('error', 'API key not configured')
      throw new Error('ChangeNOW API key is not configured. Please set CHANGENOW_API_KEY in your .env file.')
    }

    // Use v1 API format: POST /v1/transactions/{api_key}
    // Include network in currency code for tokens (e.g., usdc_eth, usdc_sol)
    const fromCurrency = getChangeNowCurrency(fromAsset, fromChain)
    const toCurrency = getChangeNowCurrency(toAsset, toChain)
    const apiUrl = `https://api.changenow.io/v1/transactions/${apiKey}`
    
    // Use normalized amount for payload
    const payloadAmount = normalizeAmount(normalizedAmount)
    
    const payload = {
      from: fromCurrency,
      to: toCurrency,
      address: recipientAddress.trim(),
      amount: payloadAmount,
      ...(refundAddress && { refundAddress: refundAddress.trim() }),
      // Only include extraId if the currency supports it (Solana doesn't support extraId)
      ...(orderId && toCurrency !== 'sol' && toCurrency !== 'SOL' && { extraId: orderId }),
    }

    log('info', 'Creating exchange transaction', {
      from: `${fromAsset}(${fromChain})`,
      to: `${toAsset}(${toChain})`,
      amount: payload.amount,
      recipientPrefix: recipientAddress.substring(0, 10) + '...'
    })

    // Preflight: if amount is below min, bump to min
    try {
      const preflight = await getExchangeRate(fromAsset, toAsset, fromChain, toChain, payload.amount)
      if (preflight?.estimatedAmount === '0') {
        // No route; continue to normal flow to get proper error
      }
    } catch (e) {
      const msg = String(e?.message || '')
      if (msg.includes('below minimum') || msg.includes('min_amount')) {
        const min = await getMinAmountV1(fromAsset, toAsset, fromChain, toChain)
        if (min && min > 0) {
          payload.amount = normalizeAmount(min)
        }
      }
    }

    // Retry on transient server errors with exponential backoff
    let response
    let lastError = null
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        response = await fetchWithTimeout(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }, API_TIMEOUT)

        if (response.ok) break

        const status = response.status
        const text = await response.text()
        let parsed
        try { parsed = JSON.parse(text) } catch { parsed = { message: text } }
        
        const isTransient = status >= 500 || parsed?.error === 'unknown_error'
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
        
        // Not retryable or last attempt - store error for handling below
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
        to: `${toAsset}(${toChain})`
      })
      
      // Handle specific error cases with user-friendly messages
      if (errorData.status === 401 || errorData.status === 403) {
        throw new Error(`Invalid ChangeNOW API key (${errorData.status}): ${error.message || errorData.text}. Please check your CHANGENOW_API_KEY in .env file.`)
      } else if (errorData.status === 404) {
        throw new Error(`Exchange pair not available: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain})`)
      } else if (errorData.status >= 500 || error?.error === 'unknown_error') {
        throw new Error(`ChangeNOW is temporarily unavailable for ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try again shortly or adjust the amount.`)
      } else if (error.error === 'max_amount_exceeded') {
        throw new Error(`Amount exceeds maximum limit: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try a smaller amount.`)
      } else if (error.error === 'min_amount') {
        const min = await getMinAmountV1(fromAsset, toAsset, fromChain, toChain)
        if (min) {
          throw new Error(`Amount is below minimum limit: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Minimum is ${min}.`)
        } else {
          throw new Error(`Amount is below minimum limit: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try a larger amount.`)
        }
      } else if (error.error === 'pair_is_inactive') {
        throw new Error(`Exchange pair is currently inactive: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try a different currency pair.`)
      } else {
        throw new Error(`ChangeNOW v1 API error: ${errorData.status} - ${error.message || error.error || errorData.text}`)
      }
    }

    const data = await response.json()
    log('info', 'Transaction created successfully', {
      exchangeId: data.id || data.transactionId,
      depositAddressPrefix: (data.payinAddress || data.address || '').substring(0, 10) + '...'
    })

    // v1 API response format: { payinAddress, id, payoutAmount, rate, etc. }
    const result = {
      depositAddress: data.payinAddress || data.address || data.payin_address,
      exchangeId: data.id || data.transactionId || data.transaction_id,
      estimatedAmount: data.payoutAmount || data.amount || data.payout_amount,
      exchangeRate: data.rate || null,
      validUntil: data.validUntil || data.valid_until || null,
      flow: data.flow || 'standard',
    }
    
    // Validate response data
    if (!result.depositAddress || !result.exchangeId) {
      log('error', 'Invalid response from ChangeNOW API', { data })
      throw new Error('Invalid response from ChangeNOW API: missing required fields')
    }
    
    return result
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
 * @param {string} exchangeId - ChangeNOW exchange transaction ID
 * @returns {Promise<object>} - Transaction status data
 */
export const getExchangeStatus = async (exchangeId) => {
  try {
    // Validate exchange ID
    if (!exchangeId || typeof exchangeId !== 'string' || exchangeId.trim() === '') {
      throw new Error('Exchange ID is required')
    }
    
    // Read API key dynamically from environment
    const apiKey = process.env.CHANGENOW_API_KEY || BLOCKPAY_CONFIG.changenow.apiKey || ''
    
    if (!apiKey || apiKey === '') {
      log('error', 'API key not configured')
      throw new Error('ChangeNOW API key is not configured. Please set CHANGENOW_API_KEY in your .env file.')
    }

    // Use v1 API format: GET /v1/transactions/{id}/{api_key}
    const apiUrl = `https://api.changenow.io/v1/transactions/${exchangeId.trim()}/${apiKey}`
    
    log('info', 'Getting transaction status', { exchangeId })
    
    const response = await fetchWithTimeout(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
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
        throw new Error(`Invalid ChangeNOW API key (${response.status}): ${errorData.message || errorText}. Please check your CHANGENOW_API_KEY in .env file.`)
      } else if (response.status === 404) {
        throw new Error(`Transaction not found: ${exchangeId}`)
      } else {
        throw new Error(`ChangeNOW v1 API error: ${response.status} - ${errorData.message || errorText}`)
      }
    }

    const data = await response.json()
    log('info', 'Transaction status retrieved', {
      exchangeId,
      status: data.status
    })

    // Map ChangeNOW status to BlockPay status
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
      depositAddress: data.payinAddress,
      depositTxHash: data.payinHash,
      swapTxHash: data.payoutHash,
      fromAmount: data.fromAmount,
      toAmount: data.toAmount,
      exchangeRate: data.rate,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
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
    
    // Read API key dynamically from environment (not from cached config)
    const apiKey = process.env.CHANGENOW_API_KEY || BLOCKPAY_CONFIG.changenow.apiKey || ''
    
    // Check if API key is configured
    if (!apiKey || apiKey === '') {
      log('error', 'API key is missing')
      throw new Error('ChangeNOW API key is not configured. Please set CHANGENOW_API_KEY in your .env file.')
    }

    // Use v1 API format: /v1/exchange-amount/{amount}/{from}_{to}?api_key={key}
    // Include network in currency code for tokens (e.g., usdc_eth, usdc_sol)
    const fromCurrency = getChangeNowCurrency(fromAsset, fromChain)
    const toCurrency = getChangeNowCurrency(toAsset, toChain)
    const normalizedAmount = normalizeAmount(amount)
    const url = `https://api.changenow.io/v1/exchange-amount/${normalizedAmount}/${fromCurrency}_${toCurrency}?api_key=${apiKey}`
    
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
        response = await fetchWithTimeout(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }, API_TIMEOUT)
        
        if (response.ok) break
        
        const status = response.status
        const text = await response.text()
        let parsed
        try { parsed = JSON.parse(text) } catch { parsed = { message: text } }
        
        const isTransient = status >= 500 || parsed?.error === 'unknown_error'
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
      
      // Handle specific v1 API errors
      if (errorData.error === 'max_amount_exceeded') {
        throw new Error(`Amount exceeds maximum limit: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try a smaller amount.`)
      } else if (errorData.error === 'min_amount') {
        const min = await getMinAmountV1(fromAsset, toAsset, fromChain, toChain)
        if (min) {
          throw new Error(`Amount is below minimum limit: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Minimum is ${min}.`)
        } else {
          throw new Error(`Amount is below minimum limit: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try a larger amount.`)
        }
      } else if (errorData.error === 'pair_is_inactive') {
        throw new Error(`Exchange pair is currently inactive: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try a different currency pair.`)
      } else if (response.status === 401 || response.status === 403) {
        const detailedError = errorData.message || errorData.error || errorText
        throw new Error(`Invalid ChangeNOW API key (${response.status}): ${detailedError}. Please check your CHANGENOW_API_KEY in .env file.`)
      } else if (response.status === 404) {
        throw new Error(`Exchange pair not available: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain})`)
      } else if (response.status >= 500 || errorData?.error === 'unknown_error') {
        throw new Error(`ChangeNOW is temporarily unavailable for ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try again shortly or adjust the amount.`)
      } else {
        throw new Error(`ChangeNOW v1 API error: ${response.status} - ${errorData.message || errorData.error || errorText}`)
      }
    }

    const data = await response.json()
    
    // v1 API returns just a number (the estimated amount), not an object
    const estimatedAmount = typeof data === 'number' ? data : (data.estimatedAmount || data.amount || data)
    
    if (estimatedAmount === null || estimatedAmount === undefined || isNaN(estimatedAmount)) {
      log('error', 'Invalid response from ChangeNOW API', { data })
      throw new Error('Invalid response from ChangeNOW v1 API')
    }

    log('info', 'Exchange rate retrieved', {
      from: `${fromAsset}(${fromChain})`,
      to: `${toAsset}(${toChain})`,
      estimatedAmount: estimatedAmount.toString()
    })

    return {
      estimatedAmount: estimatedAmount.toString(),
      rate: null, // v1 doesn't provide rate
      minAmount: null,
      maxAmount: null,
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

/**
 * Validate exchange pair
 * Returns { available: true/false } or null if validation fails
 */
export const validateExchangePair = async (fromAsset, toAsset, fromChain, toChain) => {
  try {
    // Use v1 API format for pair validation - faster and more reliable
    const apiKey = process.env.CHANGENOW_API_KEY || BLOCKPAY_CONFIG.changenow.apiKey || ''
    if (!apiKey) {
      return null // Skip validation if no API key
    }

    // Try to get exchange rate as a quick validation (with timeout)
    const fromCurrency = getChangeNowCurrency(fromAsset, fromChain)
    const toCurrency = getChangeNowCurrency(toAsset, toChain)
    
    // Use a small test amount to validate the pair
    const testAmount = 1
    const url = `https://api.changenow.io/v1/exchange-amount/${testAmount}/${fromCurrency}_${toCurrency}?api_key=${apiKey}`
    
    try {
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }, 2000) // 2 second timeout for validation
      
      if (response.ok) {
        const data = await response.json()
        // If we get a valid number response, pair is available
        const isValid = typeof data === 'number' && !isNaN(data) && data > 0
        return { available: isValid }
      } else if (response.status === 404 || response.status === 400) {
        // Pair not available
        return { available: false }
      } else {
        // Other errors - assume available and let ChangeNOW handle it
        return null
      }
    } catch (fetchError) {
      if (fetchError.message?.includes('timeout') || fetchError.name === 'AbortError') {
        // Timeout - skip validation
        return null
      }
      throw fetchError
    }
  } catch (error) {
    log('warn', 'Pair validation error (non-critical)', { error: error.message })
    // Return null to indicate validation should be skipped
    return null
  }
}

export default {
  createExchangeTransaction,
  getExchangeStatus,
  getExchangeRate,
  validateExchangePair,
}

