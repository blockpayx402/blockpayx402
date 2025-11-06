/**
 * ChangeNOW API Integration
 * Production-ready integration with ChangeNOW for cross-chain swaps
 */

import { BLOCKPAY_CONFIG, getChangeNowHeaders } from '../config.js'

// Validate API key on import
if (!BLOCKPAY_CONFIG.changenow.apiKey && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  WARNING: ChangeNOW API key not configured. Set CHANGENOW_API_KEY in .env file.')
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
    // Format: currency_network (e.g., usdc_eth, usdc_bsc, usdc_sol)
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
    // Read API key dynamically from environment
    const apiKey = process.env.CHANGENOW_API_KEY || BLOCKPAY_CONFIG.changenow.apiKey || ''
    
    if (!apiKey || apiKey === '') {
      throw new Error('ChangeNOW API key is not configured. Please set CHANGENOW_API_KEY in your .env file.')
    }

    // Use v1 API format: POST /v1/transactions/{api_key}
    // Include network in currency code for tokens (e.g., usdc_eth, usdc_sol)
    const fromCurrency = getChangeNowCurrency(fromAsset, fromChain)
    const toCurrency = getChangeNowCurrency(toAsset, toChain)
    const apiUrl = `https://api.changenow.io/v1/transactions/${apiKey}`
    
    const payload = {
      from: fromCurrency,
      to: toCurrency,
      address: recipientAddress,
      amount: normalizeAmount(amount),
      ...(refundAddress && { refundAddress }),
      // Only include extraId if the currency supports it (Solana doesn't support extraId)
      ...(orderId && toCurrency !== 'sol' && toCurrency !== 'SOL' && { extraId: orderId }),
    }

    console.log(`[ChangeNOW] Creating transaction (v1): ${apiUrl.replace(apiKey, apiKey.substring(0, 8) + '...')}`)
    console.log(`[ChangeNOW] Transaction payload:`, { ...payload, address: recipientAddress.substring(0, 10) + '...' })

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

    // Retry on transient server errors
    let response
    for (let attempt = 0; attempt < 2; attempt++) {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) break

      // For 5xx or unknown_error, wait briefly and retry once
      const status = response.status
      const text = await response.text()
      let parsed
      try { parsed = JSON.parse(text) } catch { parsed = { message: text } }
      const isTransient = status >= 500 || parsed?.error === 'unknown_error'
      if (attempt === 0 && isTransient) {
        await new Promise(r => setTimeout(r, 600))
        continue
      }
      // Put text back for the unified handler below
      response = {
        ok: false,
        status,
        async text() { return text },
      }
      break
    }

    if (!response.ok) {
      const errorText = await response.text()
      let error
      try {
        error = JSON.parse(errorText)
      } catch (e) {
        error = { message: errorText || 'Unknown error' }
      }
      
      console.error(`[ChangeNOW] v1 API error ${response.status}:`, error)
      console.error(`[ChangeNOW] Request URL: ${apiUrl.replace(apiKey, apiKey.substring(0, 8) + '...')}`)
      console.error(`[ChangeNOW] Full error response:`, errorText)
      
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Invalid ChangeNOW API key (${response.status}): ${error.message || errorText}. Please check your CHANGENOW_API_KEY in .env file.`)
      } else if (response.status === 404) {
        throw new Error(`Exchange pair not available: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain})`)
      } else if (response.status >= 500 || error?.error === 'unknown_error') {
        throw new Error(`ChangeNOW is temporarily unavailable for ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try again shortly or adjust the amount.`)
      } else {
        throw new Error(`ChangeNOW v1 API error: ${response.status} - ${error.message || error.error || errorText}`)
      }
    }

    const data = await response.json()
    console.log(`[ChangeNOW] v1 API transaction response:`, data)

    // v1 API response format: { payinAddress, id, payoutAmount, rate, etc. }
    return {
      depositAddress: data.payinAddress || data.address || data.payin_address,
      exchangeId: data.id || data.transactionId || data.transaction_id,
      estimatedAmount: data.payoutAmount || data.amount || data.payout_amount,
      exchangeRate: data.rate || null,
      validUntil: data.validUntil || data.valid_until || null,
      flow: data.flow || 'standard',
    }
  } catch (error) {
    console.error('Error creating ChangeNOW transaction:', error)
    throw error
  }
}

/**
 * Get exchange transaction status
 */
export const getExchangeStatus = async (exchangeId) => {
  try {
    // Read API key dynamically from environment
    const apiKey = process.env.CHANGENOW_API_KEY || BLOCKPAY_CONFIG.changenow.apiKey || ''
    
    if (!apiKey || apiKey === '') {
      throw new Error('ChangeNOW API key is not configured. Please set CHANGENOW_API_KEY in your .env file.')
    }

    // Use v1 API format: GET /v1/transactions/{id}/{api_key}
    const apiUrl = `https://api.changenow.io/v1/transactions/${exchangeId}/${apiKey}`
    
    console.log(`[ChangeNOW] Getting transaction status (v1): ${apiUrl.replace(apiKey, apiKey.substring(0, 8) + '...')}`)
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { message: errorText }
      }
      
      console.error(`[ChangeNOW] v1 API error ${response.status}:`, errorData)
      
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Invalid ChangeNOW API key (${response.status}): ${errorData.message || errorText}. Please check your CHANGENOW_API_KEY in .env file.`)
      } else if (response.status === 404) {
        throw new Error(`Transaction not found: ${exchangeId}`)
      } else {
        throw new Error(`ChangeNOW v1 API error: ${response.status} - ${errorData.message || errorText}`)
      }
    }

    const data = await response.json()
    console.log(`[ChangeNOW] v1 API status response:`, data)

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
    console.error('Error getting ChangeNOW status:', error)
    throw error
  }
}

/**
 * Get exchange rate estimate
 */
export const getExchangeRate = async (fromAsset, toAsset, fromChain, toChain, amount) => {
  try {
    // Read API key dynamically from environment (not from cached config)
    const apiKey = process.env.CHANGENOW_API_KEY || BLOCKPAY_CONFIG.changenow.apiKey || ''
    
    // Check if API key is configured
    if (!apiKey || apiKey === '') {
      console.error('[ChangeNOW] API key is missing!')
      console.error('[ChangeNOW] process.env.CHANGENOW_API_KEY exists:', !!process.env.CHANGENOW_API_KEY)
      console.error('[ChangeNOW] process.env.CHANGENOW_API_KEY length:', process.env.CHANGENOW_API_KEY?.length || 0)
      console.error('[ChangeNOW] BLOCKPAY_CONFIG.changenow.apiKey exists:', !!BLOCKPAY_CONFIG.changenow.apiKey)
      throw new Error('ChangeNOW API key is not configured. Please set CHANGENOW_API_KEY in your .env file.')
    }

    // Debug: Log API key info (without exposing full key)
    const apiKeyPrefix = apiKey.substring(0, 8)
    const apiKeySuffix = apiKey.substring(apiKey.length - 4)
    console.log(`[ChangeNOW] Using API key: ${apiKeyPrefix}...${apiKeySuffix} (length: ${apiKey.length})`)
    console.log(`[ChangeNOW] API key source: ${process.env.CHANGENOW_API_KEY ? 'process.env' : 'BLOCKPAY_CONFIG'}`)

    // Use v1 API format: /v1/exchange-amount/{amount}/{from}_{to}?api_key={key}
    // Include network in currency code for tokens (e.g., usdc_eth, usdc_sol)
    const fromCurrency = getChangeNowCurrency(fromAsset, fromChain)
    const toCurrency = getChangeNowCurrency(toAsset, toChain)
    const url = `https://api.changenow.io/v1/exchange-amount/${normalizeAmount(amount)}/${fromCurrency}_${toCurrency}?api_key=${apiKey}`
    
    console.log(`[ChangeNOW] Getting exchange rate (v1): ${url.replace(apiKey, apiKey.substring(0, 8) + '...')}`)

    // Retry on transient server errors
    let response
    for (let attempt = 0; attempt < 2; attempt++) {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) break
      const status = response.status
      const text = await response.text()
      let parsed
      try { parsed = JSON.parse(text) } catch { parsed = { message: text } }
      const isTransient = status >= 500 || parsed?.error === 'unknown_error'
      if (attempt === 0 && isTransient) {
        await new Promise(r => setTimeout(r, 500))
        continue
      }
      response = {
        ok: false,
        status,
        async text() { return text },
      }
      break
    }

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { message: errorText }
      }
      
      console.error(`[ChangeNOW] v1 API error ${response.status}:`, errorData)
      console.error(`[ChangeNOW] Request URL: ${url.replace(apiKey, apiKey.substring(0, 8) + '...')}`)
      console.error(`[ChangeNOW] Full error response:`, errorText)
      
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
    console.log(`[ChangeNOW] v1 API response:`, data)

    // v1 API returns just a number (the estimated amount), not an object
    const estimatedAmount = typeof data === 'number' ? data : (data.estimatedAmount || data.amount || data)
    
    if (estimatedAmount === null || estimatedAmount === undefined || isNaN(estimatedAmount)) {
      throw new Error('Invalid response from ChangeNOW v1 API')
    }

    return {
      estimatedAmount: estimatedAmount.toString(),
      rate: null, // v1 doesn't provide rate
      minAmount: null,
      maxAmount: null,
    }
  } catch (error) {
    console.error('[ChangeNOW] Error getting exchange rate:', error)
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
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000) // 2 second timeout
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
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
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        // Timeout - skip validation
        return null
      }
      throw fetchError
    }
  } catch (error) {
    console.warn('[ChangeNOW] Pair validation error (non-critical):', error.message)
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

