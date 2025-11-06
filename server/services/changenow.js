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
  // Ethereum
  'ETH': 'eth',
  'USDT': 'usdt',
  'USDC': 'usdc',
  'DAI': 'dai',
  
  // BNB Chain
  'BNB': 'bnb',
  'BUSD': 'busd',
  
  // Polygon
  'MATIC': 'matic',
  
  // Solana
  'SOL': 'sol',
  
  // Bitcoin
  'BTC': 'btc',
  
  // Other popular
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
 * Get ChangeNOW currency code
 */
const getChangeNowCurrency = (currency) => {
  if (!currency) return 'eth'
  const upperCurrency = currency.toUpperCase()
  return CURRENCY_MAP[upperCurrency] || currency.toLowerCase()
}

/**
 * Get ChangeNOW network code
 */
const getChangeNowNetwork = (chain) => {
  return NETWORK_MAP[chain] || chain.toLowerCase()
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
    const fromCurrency = getChangeNowCurrency(fromAsset)
    const toCurrency = getChangeNowCurrency(toAsset)
    const apiUrl = `https://api.changenow.io/v1/transactions/${apiKey}`
    
    const payload = {
      from: fromCurrency,
      to: toCurrency,
      address: recipientAddress,
      amount: amount,
      ...(refundAddress && { refundAddress }),
      ...(orderId && { extraId: orderId }),
    }

    console.log(`[ChangeNOW] Creating transaction (v1): ${apiUrl.replace(apiKey, apiKey.substring(0, 8) + '...')}`)
    console.log(`[ChangeNOW] Transaction payload:`, { ...payload, address: recipientAddress.substring(0, 10) + '...' })

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

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
    const fromCurrency = getChangeNowCurrency(fromAsset)
    const toCurrency = getChangeNowCurrency(toAsset)
    const url = `https://api.changenow.io/v1/exchange-amount/${amount}/${fromCurrency}_${toCurrency}?api_key=${apiKey}`
    
    console.log(`[ChangeNOW] Getting exchange rate (v1): ${url.replace(apiKey, apiKey.substring(0, 8) + '...')}`)

    const response = await fetch(url, {
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
      console.error(`[ChangeNOW] Request URL: ${url.replace(apiKey, apiKey.substring(0, 8) + '...')}`)
      console.error(`[ChangeNOW] Full error response:`, errorText)
      
      // Handle specific v1 API errors
      if (errorData.error === 'max_amount_exceeded') {
        throw new Error(`Amount exceeds maximum limit: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try a smaller amount.`)
      } else if (errorData.error === 'min_amount') {
        throw new Error(`Amount is below minimum limit: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try a larger amount.`)
      } else if (errorData.error === 'pair_is_inactive') {
        throw new Error(`Exchange pair is currently inactive: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try a different currency pair.`)
      } else if (response.status === 401 || response.status === 403) {
        const detailedError = errorData.message || errorData.error || errorText
        throw new Error(`Invalid ChangeNOW API key (${response.status}): ${detailedError}. Please check your CHANGENOW_API_KEY in .env file.`)
      } else if (response.status === 404) {
        throw new Error(`Exchange pair not available: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain})`)
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
 */
export const validateExchangePair = async (fromAsset, toAsset, fromChain, toChain) => {
  try {
    const apiUrl = `${BLOCKPAY_CONFIG.changenow.apiUrl}/exchange/available-pairs`
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: getChangeNowHeaders(),
    })

    if (!response.ok) {
      return { available: false }
    }

    const pairs = await response.json()
    const fromCurrency = getChangeNowCurrency(fromAsset)
    const toCurrency = getChangeNowCurrency(toAsset)
    const fromNetwork = getChangeNowNetwork(fromChain)
    const toNetwork = getChangeNowNetwork(toChain)

    const isAvailable = pairs.some(pair => 
      pair.fromCurrency === fromCurrency &&
      pair.toCurrency === toCurrency &&
      pair.fromNetwork === fromNetwork &&
      pair.toNetwork === toNetwork
    )

    return { available: isAvailable }
  } catch (error) {
    console.error('Error validating exchange pair:', error)
    return { available: false }
  }
}

export default {
  createExchangeTransaction,
  getExchangeStatus,
  getExchangeRate,
  validateExchangePair,
}

