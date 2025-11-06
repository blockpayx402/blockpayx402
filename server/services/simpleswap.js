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
const API_TIMEOUT = 20000 // 20 seconds (increased for SimpleSwap)
const MAX_RETRIES = 2 // Reduced retries to avoid timeouts
const RETRY_DELAY_BASE = 1000 // Base delay in ms
const RETRY_DELAY_MAX = 5000 // Max delay in ms (reduced)

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

// Cache for SimpleSwap currency list
let currencyListCache = null
let currencyListCacheTime = 0
const CURRENCY_CACHE_TTL = 3600000 // 1 hour

/**
 * Fetch available currencies from SimpleSwap API
 * This gets the exact currency codes SimpleSwap uses
 */
const fetchSimpleSwapCurrencies = async () => {
  try {
    const apiKey = (process.env.SIMPLESWAP_API_KEY || BLOCKPAY_CONFIG.simpleswap.apiKey || '').trim()
    if (!apiKey) {
      log('warn', 'No API key for fetching currencies, using fallback mapping')
      return null
    }

    // Try v3 first
    let apiUrl = `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/v3/get_currencies`
    let headers = { 'Authorization': `Bearer ${apiKey}` }
    
    let response = await fetchWithTimeout(apiUrl, { method: 'GET', headers }, 10000)
    
    // If v3 fails, try v1
    if (!response.ok) {
      apiUrl = `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/get_currencies?api_key=${encodeURIComponent(apiKey)}`
      headers = {}
      response = await fetchWithTimeout(apiUrl, { method: 'GET', headers }, 10000)
    }
    
    if (response.ok) {
      const data = await response.json()
      currencyListCache = data
      currencyListCacheTime = Date.now()
      log('info', 'Fetched SimpleSwap currency list', { count: Array.isArray(data) ? data.length : Object.keys(data).length })
      return data
    }
  } catch (error) {
    log('warn', 'Failed to fetch SimpleSwap currencies, using fallback', { error: error.message })
  }
  return null
}

/**
 * Get SimpleSwap currency code by searching the currency list
 * This uses the exact format SimpleSwap uses
 */
const getSimpleSwapCurrencyFromList = (currency, chain = null) => {
  if (!currencyListCache) return null
  
  const upperCurrency = currency.toUpperCase()
  const chainLower = chain ? chain.toLowerCase() : null
  
  // Try to find exact match in currency list
  // Currency list format varies, could be array or object
  let currencies = []
  if (Array.isArray(currencyListCache)) {
    currencies = currencyListCache
  } else if (currencyListCache.currencies) {
    currencies = currencyListCache.currencies
  } else if (typeof currencyListCache === 'object') {
    currencies = Object.values(currencyListCache)
  }
  
  // Search for matching currency
  for (const item of currencies) {
    const itemSymbol = (item.symbol || item.code || item.currency || '').toUpperCase()
    const itemNetwork = (item.network || item.chain || '').toLowerCase()
    
    // Match by symbol
    if (itemSymbol === upperCurrency) {
      // If chain specified, match network too
      if (chainLower) {
        const networkMap = {
          'ethereum': ['eth', 'ethereum', 'erc20'],
          'bnb': ['bsc', 'bep20', 'binance'],
          'polygon': ['matic', 'polygon'],
          'solana': ['sol', 'solana', 'spl'],
        }
        const expectedNetworks = networkMap[chainLower] || [chainLower]
        
        if (!itemNetwork || expectedNetworks.some(n => itemNetwork.includes(n))) {
          return item.code || item.currency || itemSymbol.toLowerCase()
        }
      } else {
        // No chain specified, return first match
        return item.code || item.currency || itemSymbol.toLowerCase()
      }
    }
  }
  
  return null
}

/**
 * Get SimpleSwap currency code
 * First tries to fetch from SimpleSwap API, then falls back to mapping
 * @param {string} currency - Currency symbol
 * @param {string} chain - Chain name
 * @returns {string} - SimpleSwap currency code
 */
const getSimpleSwapCurrency = async (currency, chain = null) => {
  if (!currency) return 'eth'
  
  try {
    // Refresh cache if expired
    if (!currencyListCache || Date.now() - currencyListCacheTime > CURRENCY_CACHE_TTL) {
      await fetchSimpleSwapCurrencies()
    }
    
    // Try to get from currency list first
    const fromList = getSimpleSwapCurrencyFromList(currency, chain)
    if (fromList) {
      return fromList
    }
  } catch (error) {
    // If fetching currencies fails, just use fallback mapping
    log('warn', 'Failed to get currency from list, using fallback', { 
      currency, 
      chain, 
      error: error.message 
    })
  }
  
  // Fallback to mapping
  const upperCurrency = currency.toUpperCase()
  const chainLower = chain ? chain.toLowerCase() : null
  
  // Native currencies don't need network suffix
  if (CURRENCY_MAP[upperCurrency]) {
    return CURRENCY_MAP[upperCurrency]
  }
  
  // For tokens, include network if specified
  if (chainLower && NETWORK_MAP[chainLower]) {
    const network = NETWORK_MAP[chainLower]
    
    // For tokens on any network, use currency_network format
    // Format: currency_network (e.g., usdc_eth, usdc_sol)
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
    // Check if it's the same currency on the same chain - no exchange needed
    if (fromChain === toChain && fromAsset.toUpperCase() === toAsset.toUpperCase()) {
      throw new Error(`Cannot create exchange for the same currency on the same chain: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please use direct payment instead.`)
    }
    
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
    
    // Read API key - config already has fallback, so just use it
    const apiKey = (process.env.SIMPLESWAP_API_KEY || BLOCKPAY_CONFIG.simpleswap.apiKey || '').trim()
    
    // Debug logging
    console.log('[SimpleSwap createExchangeTransaction] API key check:', {
      hasEnvKey: !!process.env.SIMPLESWAP_API_KEY,
      hasConfigKey: !!BLOCKPAY_CONFIG.simpleswap.apiKey,
      configKeyLength: BLOCKPAY_CONFIG.simpleswap.apiKey ? BLOCKPAY_CONFIG.simpleswap.apiKey.length : 0,
      finalKeyLength: apiKey.length,
      configKeyPreview: BLOCKPAY_CONFIG.simpleswap.apiKey ? BLOCKPAY_CONFIG.simpleswap.apiKey.substring(0, 30) + '...' : 'none'
    })
    
    if (!apiKey || apiKey === '' || apiKey === 'undefined') {
      log('error', 'API key not configured', {
        envKey: !!process.env.SIMPLESWAP_API_KEY,
        configKey: !!BLOCKPAY_CONFIG.simpleswap.apiKey,
        configKeyValue: BLOCKPAY_CONFIG.simpleswap.apiKey ? BLOCKPAY_CONFIG.simpleswap.apiKey.substring(0, 20) + '...' : 'none',
        BLOCKPAY_CONFIG_exists: !!BLOCKPAY_CONFIG,
        simpleswap_exists: !!BLOCKPAY_CONFIG?.simpleswap
      })
      throw new Error('SimpleSwap API key is not configured. Please set SIMPLESWAP_API_KEY in Netlify environment variables or check server configuration.')
    }

    // Get currency codes (await since it's now async)
    const fromCurrency = await getSimpleSwapCurrency(fromAsset, fromChain)
    const toCurrency = await getSimpleSwapCurrency(toAsset, toChain)
    
    // Try v3 first, fallback to v1
    let apiUrl = `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/v3/create_exchange`
    let useV3 = true
    
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
    
    // Prepare payload - v3 uses different format than v1
    let payload
    if (useV3) {
      // SimpleSwap API v3 format
      payload = {
        fixed: false,
        currency_from: fromCurrency,
        currency_to: toCurrency,
        amount: payloadAmount,
        address_to: recipientAddress.trim(),
        ...(validRefundAddress && { user_refund_address: validRefundAddress }),
      }
    } else {
      // SimpleSwap API v1 format
      payload = {
        fixed: false,
        currency_from: fromCurrency,
        currency_to: toCurrency,
        amount: payloadAmount,
        address_to: recipientAddress.trim(),
        ...(validRefundAddress && { user_refund_address: validRefundAddress }),
      }
    }
    
    console.log('[SimpleSwap createExchangeTransaction] Request payload:', {
      currency_from: fromCurrency,
      currency_to: toCurrency,
      amount: payloadAmount,
      address_to: recipientAddress.substring(0, 10) + '...',
      has_refund: !!validRefundAddress,
      fromAsset,
      fromChain,
      toAsset,
      toChain,
      apiUrl: apiUrl.replace(apiKey.substring(0, 20), '***')
    })

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
        
        // SimpleSwap API v3 uses Authorization header, v1 uses query parameter
        if (useV3) {
          headers['Authorization'] = `Bearer ${apiKey}`
        } else {
          // v1: api_key in query parameter
          apiUrl = `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/create_exchange?api_key=${encodeURIComponent(apiKey)}`
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
        
        // If v3 returns 404 or 401, try v1
        if (useV3 && (status === 404 || status === 401) && attempt === 0) {
          log('info', 'v3 not available, falling back to v1', { status, error: parsed.error || parsed.message })
          useV3 = false
          apiUrl = `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/create_exchange?api_key=${encodeURIComponent(apiKey)}`
          delete headers['Authorization']
          continue
        }
        
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
        throw new Error(`Exchange pair not available: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). This pair may not be supported by SimpleSwap.`)
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
    
    // Read API key - config already has fallback, so just use it
    const apiKey = (process.env.SIMPLESWAP_API_KEY || BLOCKPAY_CONFIG.simpleswap.apiKey || '').trim()
    
    if (!apiKey || apiKey === '' || apiKey === 'undefined') {
      log('error', 'API key not configured', {
        envKey: !!process.env.SIMPLESWAP_API_KEY,
        configKey: !!BLOCKPAY_CONFIG.simpleswap.apiKey
      })
      throw new Error('SimpleSwap API key is not configured. Please set SIMPLESWAP_API_KEY in Netlify environment variables or check server configuration.')
    }

    // Try v3 first, fallback to v1
    let apiUrl = `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/v3/get_exchange?id=${encodeURIComponent(exchangeId.trim())}`
    let useV3 = true
    
    log('info', 'Getting transaction status', { exchangeId, useV3 })
    
    // SimpleSwap API v3 uses Authorization header, v1 uses query parameter
    const headers = {
      'Content-Type': 'application/json',
    }
    
    if (useV3) {
      headers['Authorization'] = `Bearer ${apiKey}`
    } else {
      // v1: api_key in query parameter
      apiUrl = `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/get_exchange?api_key=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(exchangeId.trim())}`
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

    const fromCurrency = await getSimpleSwapCurrency(fromAsset, fromChain)
    const toCurrency = await getSimpleSwapCurrency(toAsset, toChain)
    const normalizedAmount = normalizeAmount(amount)
    
    console.log('[SimpleSwap getExchangeRate] Currency mapping:', {
      fromAsset,
      fromChain,
      fromCurrency,
      toAsset,
      toChain,
      toCurrency,
      amount: normalizedAmount,
      apiUrl: `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/v3/get_estimated?fixed=false&currency_from=${fromCurrency}&currency_to=${toCurrency}&amount=${normalizedAmount}`.replace(apiKey, '***')
    })
    
    // Try v3 first, fallback to v1
    let apiUrl = `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/v3/get_estimated?fixed=false&currency_from=${fromCurrency}&currency_to=${toCurrency}&amount=${normalizedAmount}`
    let useV3 = true
    
    log('info', 'Getting exchange rate', {
      from: `${fromAsset}(${fromChain})`,
      to: `${toAsset}(${toChain})`,
      amount: normalizedAmount,
      url: apiUrl.replace(apiKey, '***')
    })

    // Retry on transient server errors with exponential backoff
    let response
    let lastError = null
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // SimpleSwap API v3 uses Authorization header, v1 uses query parameter
        const headers = {
          'Content-Type': 'application/json',
        }
        
        if (useV3) {
          headers['Authorization'] = `Bearer ${apiKey}`
        } else {
          // v1: api_key in query parameter
          apiUrl = `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/get_estimated?api_key=${encodeURIComponent(apiKey)}&fixed=false&currency_from=${fromCurrency}&currency_to=${toCurrency}&amount=${normalizedAmount}`
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
        throw new Error(`Exchange pair not available: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). This pair may not be supported by SimpleSwap.`)
      } else if (errorData.status >= 500) {
        throw new Error(`SimpleSwap is temporarily unavailable for ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try again shortly.`)
      } else {
        throw new Error(`SimpleSwap API error: ${errorData.status} - ${error.message || error.error || errorData.text}`)
      }
    }

    // SimpleSwap API v1 returns the estimated amount as a plain string
    const text = await response.text()
    let estimatedAmount = null
    
    try {
      // Try parsing as JSON first (in case it's wrapped)
      const parsed = JSON.parse(text)
      if (typeof parsed === 'string') {
        estimatedAmount = parsed
      } else if (typeof parsed === 'number') {
        estimatedAmount = parsed.toString()
      } else {
        estimatedAmount = parsed
      }
    } catch {
      // If not JSON, it's a plain string
      estimatedAmount = text.trim()
    }
    
    if (!estimatedAmount || estimatedAmount === '' || isNaN(parseFloat(estimatedAmount))) {
      log('error', 'Invalid response from SimpleSwap API - no amount found', { 
        text,
        estimatedAmount
      })
      throw new Error('Invalid response from SimpleSwap API: Could not find estimated amount in response')
    }

    log('info', 'Exchange rate retrieved', {
      from: `${fromAsset}(${fromChain})`,
      to: `${toAsset}(${toChain})`,
      estimatedAmount: estimatedAmount.toString()
    })

    return {
      estimatedAmount: estimatedAmount.toString(),
      rate: null,
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

export default {
  createExchangeTransaction,
  getExchangeStatus,
  getExchangeRate,
}

