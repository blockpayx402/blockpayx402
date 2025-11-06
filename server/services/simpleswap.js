/**
 * SimpleSwap API Integration
 * Production-ready integration with SimpleSwap for cross-chain swaps
 * API Documentation: https://api.simpleswap.io/
 * 
 * This implementation matches SimpleSwap's v1 API exactly as documented
 */

import { BLOCKPAY_CONFIG } from '../config.js'
import { validateExchangeOrder, validateAmount, validateAddress } from '../utils/validation.js'

// Validate API key on import
if (!BLOCKPAY_CONFIG.simpleswap.apiKey && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  WARNING: SimpleSwap API key not configured. Set SIMPLESWAP_API_KEY in .env file.')
}

// Configuration constants
const API_TIMEOUT = 20000 // 20 seconds
const MAX_RETRIES = 2
const RETRY_DELAY_BASE = 1000
const RETRY_DELAY_MAX = 5000

/**
 * Create a fetch request with timeout
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
 */
const exponentialBackoff = async (attempt) => {
  const delay = Math.min(RETRY_DELAY_BASE * Math.pow(2, attempt), RETRY_DELAY_MAX)
  await new Promise(resolve => setTimeout(resolve, delay))
}

/**
 * Simple logging helper
 */
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString()
  console[level](`[SimpleSwap ${timestamp}] ${message}`, data)
}

/**
 * Currency mapping for SimpleSwap
 * SimpleSwap uses specific currency codes
 */
const CURRENCY_MAP = {
  'BTC': 'btc',
  'ETH': 'eth',
  'BNB': 'bnb',
  'SOL': 'sol',
  'USDT': 'usdt',
  'USDC': 'usdc',
  'BUSD': 'busd',
  'MATIC': 'matic',
  'AVAX': 'avax',
  'TRX': 'trx',
  'LTC': 'ltc',
  'XRP': 'xrp',
  'ADA': 'ada',
  'DOT': 'dot',
  'DOGE': 'doge',
}

/**
 * Network mapping for SimpleSwap
 */
const NETWORK_MAP = {
  'ethereum': 'eth',
  'bnb': 'bsc',
  'polygon': 'matic',
  'solana': 'sol',
  'bitcoin': 'btc',
  'tron': 'trx',
  'avalanche': 'avax',
}

// Cache for SimpleSwap currency list
let currencyListCache = null
let currencyListCacheTime = 0
const CURRENCY_CACHE_TTL = 3600000 // 1 hour

/**
 * Fetch available currencies from SimpleSwap API
 */
const fetchSimpleSwapCurrencies = async () => {
  try {
    const apiKey = (process.env.SIMPLESWAP_API_KEY || BLOCKPAY_CONFIG.simpleswap.apiKey || '').trim()
    if (!apiKey) {
      log('warn', 'No API key for fetching currencies, using fallback mapping')
      return null
    }
    
    // Try v3 first, fallback to v1
    let response
    try {
      response = await fetchWithTimeout(
        `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/v3/currencies`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        },
        5000
      )
      if (response.ok) {
        const data = await response.json()
        currencyListCache = data
        currencyListCacheTime = Date.now()
        log('info', 'Fetched currencies from v3 API', { count: data?.length || 0 })
        return data
      }
    } catch (e) {
      // v3 failed, try v1
    }
    
    // Fallback to v1
    response = await fetchWithTimeout(
      `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/get_all_currencies?api_key=${encodeURIComponent(apiKey)}`,
      { method: 'GET' },
      5000
    )
    
    if (response.ok) {
      const data = await response.json()
      currencyListCache = data
      currencyListCacheTime = Date.now()
      log('info', 'Fetched currencies from v1 API', { count: Array.isArray(data) ? data.length : Object.keys(data || {}).length })
      return data
    }
  } catch (error) {
    log('warn', 'Failed to fetch currencies from API', { error: error.message })
    return null
  }
}

/**
 * Search currency list for exact match
 */
const getSimpleSwapCurrencyFromList = (currency, chain) => {
  if (!currencyListCache) return null
  
  const upperCurrency = currency.toUpperCase()
  const chainLower = chain ? chain.toLowerCase() : null
  
  // Handle array format (v3) or object format (v1)
  const currencies = Array.isArray(currencyListCache) 
    ? currencyListCache 
    : Object.values(currencyListCache).flat()
  
  for (const item of currencies) {
    const itemSymbol = (item.symbol || item.ticker || '').toUpperCase()
    const itemCode = (item.code || item.itemCode || itemSymbol || '').toLowerCase()
    const itemNetwork = (item.network || '').toLowerCase()
    
    // Match by symbol and network
    if (itemSymbol === upperCurrency) {
      // For BSC tokens, check if network matches
      if (chainLower === 'bnb' || chainLower === 'bsc') {
        if (itemNetwork === 'bsc' || itemNetwork === 'binance' || !itemNetwork) {
          return itemCode
        }
      } else if (chainLower && itemNetwork) {
        if (itemNetwork === NETWORK_MAP[chainLower] || itemNetwork === chainLower) {
          return itemCode
        }
      } else if (!chainLower || !itemNetwork) {
        return itemCode
      }
    }
  }
  
  return null
}

/**
 * Get SimpleSwap currency code
 * Matches SimpleSwap's exact format
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
    
    // BSC tokens: USDT/BUSD use just "usdt"/"busd" (confirmed from SimpleSwap website)
    if (network === 'bsc' && (upperCurrency === 'USDT' || upperCurrency === 'BUSD')) {
      return upperCurrency.toLowerCase()
    }
    
    // For other networks, try currency_network format
    return `${upperCurrency.toLowerCase()}_${network}`
  }
  
  // Fallback: just currency code
  return upperCurrency.toLowerCase()
}

/**
 * Normalize amount to string with up to 8 decimals
 * SimpleSwap expects amounts as strings
 */
const normalizeAmount = (amount) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount)
  if (!isFinite(num) || isNaN(num)) {
    throw new Error(`Invalid amount: ${amount}`)
  }
  return Number(num.toFixed(8)).toString()
}

/**
 * Create a new exchange transaction
 * SimpleSwap API v1: POST /create_exchange?api_key={key}
 * 
 * Request body (exact format from SimpleSwap docs):
 * {
 *   "fixed": false,
 *   "currency_from": "btc",
 *   "currency_to": "eth",
 *   "amount": "0.2",
 *   "address_to": "string",
 *   "extra_id_to": "",
 *   "user_refund_address": "string",
 *   "user_refund_extra_id": "string"
 * }
 * 
 * Response (exact format from SimpleSwap docs):
 * {
 *   "id": "string",
 *   "address_from": "string",  // Deposit address
 *   "amount_to": "string",
 *   "status": "confirming",
 *   ...
 * }
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
    // Only block if it's the EXACT same currency on the same chain
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
    
    // Read API key
    const apiKey = (process.env.SIMPLESWAP_API_KEY || BLOCKPAY_CONFIG.simpleswap.apiKey || '').trim()
    
    if (!apiKey || apiKey === '' || apiKey === 'undefined') {
      log('error', 'API key not configured')
      throw new Error('SimpleSwap API key is not configured. Please set SIMPLESWAP_API_KEY in Netlify environment variables.')
    }

    // Get currency codes (exact format SimpleSwap expects)
    const fromCurrency = await getSimpleSwapCurrency(fromAsset, fromChain)
    const toCurrency = await getSimpleSwapCurrency(toAsset, toChain)
    
    // Normalize amount to string
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
    let validRefundExtraId = null
    if (refundAddress) {
      const refundValidation = validateAddress(refundAddress.trim(), fromChain)
      if (refundValidation.valid) {
        validRefundAddress = refundAddress.trim()
        // Use orderId as refund extra_id if provided
        if (orderId) {
          validRefundExtraId = orderId
        }
      } else {
        log('warn', 'Refund address invalid for source chain, skipping', {
          refundAddress: refundAddress.substring(0, 10) + '...',
          fromChain,
          error: refundValidation.error
        })
      }
    }
    
    // Prepare payload - EXACT format from SimpleSwap v1 API docs
    const payload = {
      fixed: false,
      currency_from: fromCurrency,
      currency_to: toCurrency,
      amount: payloadAmount,
      address_to: recipientAddress.trim(),
      extra_id_to: '', // Empty string if not needed
      ...(validRefundAddress && { user_refund_address: validRefundAddress }),
      ...(validRefundExtraId && { user_refund_extra_id: validRefundExtraId }),
    }
    
    // Remove extra_id_to if empty (some APIs don't like empty strings)
    if (payload.extra_id_to === '') {
      delete payload.extra_id_to
    }
    
    const apiUrl = `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/create_exchange?api_key=${encodeURIComponent(apiKey)}`
    
    console.log('[SimpleSwap createExchangeTransaction] Request:', {
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
        const headers = {
          'Content-Type': 'application/json',
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
        
        // Log detailed error
        console.error('[SimpleSwap createExchangeTransaction] API Error:', {
          status,
          fromCurrency,
          toCurrency,
          amount: payloadAmount,
          error: parsed,
          fullResponse: text.substring(0, 500),
          apiUrl: apiUrl.replace(apiKey.substring(0, 20), '***'),
          payload: { ...payload, address_to: payload.address_to?.substring(0, 10) + '...' }
        })
        
        const isTransient = status >= 500
        const isRetryable = isTransient && attempt < MAX_RETRIES - 1
        
        if (isRetryable) {
          log('warn', `Exchange creation failed, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`, {
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
          log('warn', `Exchange creation timeout, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`, { attempt: attempt + 1 })
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
      
      // Handle specific error cases
      if (errorData.status === 401 || errorData.status === 403) {
        throw new Error(`Invalid SimpleSwap API key (${errorData.status}): ${error.description || error.message || errorData.text}. Please check your SIMPLESWAP_API_KEY.`)
      } else if (errorData.status === 404) {
        throw new Error(`Exchange pair not available: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). This pair may not be supported by SimpleSwap.`)
      } else if (errorData.status === 422) {
        const errorMsg = error.description || error.message || errorData.text || 'Amount is out of range'
        throw new Error(`SimpleSwap API error (422): ${errorMsg}`)
      } else if (errorData.status === 502) {
        throw new Error(`SimpleSwap API gateway error (502): The service may be temporarily unavailable. Please try again in a few moments.`)
      } else if (errorData.status >= 500) {
        throw new Error(`SimpleSwap is temporarily unavailable for ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try again shortly.`)
      } else {
        throw new Error(`SimpleSwap API error: ${errorData.status} - ${error.description || error.message || errorData.text}`)
      }
    }

    // Parse response - EXACT format from SimpleSwap v1 API docs
    const data = await response.json()
    log('info', 'Transaction created successfully', {
      exchangeId: data.id,
      depositAddressPrefix: (data.address_from || '').substring(0, 10) + '...'
    })

    // Map SimpleSwap response to our format
    // SimpleSwap returns: address_from (deposit address), id (exchange ID), amount_to, etc.
    return {
      depositAddress: data.address_from, // SimpleSwap uses address_from for deposit address
      exchangeId: data.id,
      estimatedAmount: data.amount_to || data.expected_amount,
      exchangeRate: data.rate || null,
      validUntil: data.valid_until || null,
      flow: data.type || 'standard',
      status: data.status || 'confirming',
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
 * SimpleSwap API v1: GET /get_exchange?api_key={key}&id={id}
 * 
 * Response format matches SimpleSwap docs exactly
 */
export const getExchangeStatus = async (exchangeId) => {
  try {
    if (!exchangeId || typeof exchangeId !== 'string') {
      throw new Error('Exchange ID is required')
    }

    const apiKey = (process.env.SIMPLESWAP_API_KEY || BLOCKPAY_CONFIG.simpleswap.apiKey || '').trim()
    
    if (!apiKey || apiKey === '') {
      throw new Error('SimpleSwap API key is not configured')
    }

    const apiUrl = `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/get_exchange?api_key=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(exchangeId)}`
    
    log('info', 'Getting exchange status', { exchangeId })

    let response
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        response = await fetchWithTimeout(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }, API_TIMEOUT)

        if (response.ok) break

        const status = response.status
        if (status >= 500 && attempt < MAX_RETRIES - 1) {
          log('warn', `Status check failed, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`, { status })
          await exponentialBackoff(attempt)
          continue
        }
        
        break
      } catch (fetchError) {
        if (fetchError.message?.includes('timeout') && attempt < MAX_RETRIES - 1) {
          await exponentialBackoff(attempt)
          continue
        }
        throw fetchError
      }
    }

    if (!response.ok) {
      const text = await response.text()
      let error
      try { error = JSON.parse(text) } catch { error = { message: text } }
      
      if (response.status === 404) {
        throw new Error(`Exchange not found: ${exchangeId}`)
      } else if (response.status === 401 || response.status === 403) {
        throw new Error(`Invalid SimpleSwap API key: ${error.description || error.message}`)
      }
      throw new Error(`SimpleSwap API error: ${response.status} - ${error.description || error.message || text}`)
    }

    const data = await response.json()
    
    // Map SimpleSwap status to our status format
    // SimpleSwap statuses: confirming, waiting, exchanging, finished, failed, refunded
    let status = 'awaiting_deposit'
    if (data.status === 'finished') {
      status = 'completed'
    } else if (data.status === 'failed' || data.status === 'refunded') {
      status = 'failed'
    } else if (data.status === 'exchanging') {
      status = 'processing'
    } else if (data.status === 'waiting' || data.status === 'confirming') {
      status = 'awaiting_deposit'
    }

    return {
      status,
      amount: data.amount_from || null,
      toAmount: data.amount_to || null,
      payinHash: data.tx_from || null,
      payoutHash: data.tx_to || null,
      exchangeId: data.id,
    }
  } catch (error) {
    log('error', 'Failed to get exchange status', {
      error: error.message,
      exchangeId
    })
    throw error
  }
}

/**
 * Get exchange rate estimate
 * SimpleSwap API v1: GET /get_estimated?api_key={key}&fixed=false&currency_from={from}&currency_to={to}&amount={amount}
 * 
 * Response: plain string with estimated amount
 */
export const getExchangeRate = async (fromAsset, toAsset, fromChain, toChain, amount) => {
  try {
    // Validate inputs
    const amountValidation = validateAmount(amount)
    if (!amountValidation.valid) {
      throw new Error(amountValidation.error)
    }
    
    const apiKey = (process.env.SIMPLESWAP_API_KEY || BLOCKPAY_CONFIG.simpleswap.apiKey || '').trim()
    
    if (!apiKey || apiKey === '') {
      log('error', 'API key is missing')
      throw new Error('SimpleSwap API key is not configured. Please set SIMPLESWAP_API_KEY in your .env file.')
    }

    const normalizedAmount = normalizeAmount(amount)
    
    // Get currency codes
    const fromCurrency = await getSimpleSwapCurrency(fromAsset, fromChain)
    const toCurrency = await getSimpleSwapCurrency(toAsset, toChain)
    
    // v1 API format: api_key as query parameter
    const apiUrl = `${BLOCKPAY_CONFIG.simpleswap.apiUrl}/get_estimated?api_key=${encodeURIComponent(apiKey)}&fixed=false&currency_from=${fromCurrency}&currency_to=${toCurrency}&amount=${normalizedAmount}`
    
    console.log('[SimpleSwap getExchangeRate] Request:', {
      fromAsset,
      fromChain,
      fromCurrency,
      toAsset,
      toChain,
      toCurrency,
      amount: normalizedAmount
    })
    
    log('info', 'Getting exchange rate', {
      from: `${fromAsset}(${fromChain})`,
      to: `${toAsset}(${toChain})`,
      amount: normalizedAmount,
    })

    // Retry on transient server errors
    let response
    let lastError = null
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const headers = {
          'Content-Type': 'application/json',
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
      
      // Log detailed error
      console.error('[SimpleSwap getExchangeRate] API Error:', {
        status: errorData.status,
        fromCurrency,
        toCurrency,
        fromAsset,
        fromChain,
        toAsset,
        toChain,
        amount: normalizedAmount,
        error: error.description || error.error || error.message,
        fullResponse: errorData.text?.substring(0, 1000),
        apiUrl: apiUrl.replace(apiKey.substring(0, 20), '***'),
        apiKeyLength: apiKey.length,
        apiKeyPrefix: apiKey.substring(0, 10) + '...'
      })
      
      log('error', 'Failed to get exchange rate', {
        status: errorData.status,
        from: `${fromAsset}(${fromChain})`,
        to: `${toAsset}(${toChain})`,
        error: error.description || error.error || error.message
      })
      
      if (errorData.status === 401 || errorData.status === 403) {
        throw new Error(`Invalid SimpleSwap API key (${errorData.status}): ${error.description || error.message || errorData.text}. Please check your SIMPLESWAP_API_KEY.`)
      } else if (errorData.status === 404 || errorData.status === 400) {
        const errorMsg = error.description || error.error || error.message || errorData.text || 'Unknown error'
        if (errorMsg.toLowerCase().includes('pair') || errorMsg.toLowerCase().includes('not available') || errorMsg.toLowerCase().includes('not found')) {
          throw new Error(`Exchange pair not available: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). This pair may not be supported by SimpleSwap API.`)
        } else {
          throw new Error(`SimpleSwap API error (${errorData.status}): ${errorMsg}. Currency codes: currency_from=${fromCurrency} -> currency_to=${toCurrency}`)
        }
      } else if (errorData.status >= 500) {
        throw new Error(`SimpleSwap is temporarily unavailable for ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try again shortly.`)
      } else {
        throw new Error(`SimpleSwap API error: ${errorData.status} - ${error.description || error.message || errorData.text}`)
      }
    }

    // v1 API returns the estimated amount as a plain string (or JSON string)
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
        estimatedAmount = text.trim()
      }
    } catch (e) {
      // If not JSON, treat as plain string (v1 format)
      estimatedAmount = text.trim()
    }
    
    if (!estimatedAmount || estimatedAmount === '' || isNaN(parseFloat(estimatedAmount))) {
      log('error', 'Invalid response from SimpleSwap API - no amount found', { 
        text,
        estimatedAmount
      })
      throw new Error('Invalid response from SimpleSwap API: no estimated amount found')
    }

    return {
      estimatedAmount: parseFloat(estimatedAmount),
      fromAmount: normalizedAmount,
      exchangeRate: parseFloat(estimatedAmount) / parseFloat(normalizedAmount),
    }
  } catch (error) {
    log('error', 'Failed to get exchange rate', {
      error: error.message,
      from: `${fromAsset}(${fromChain})`,
      to: `${toAsset}(${toChain})`
    })
    throw error
  }
}
