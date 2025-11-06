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
    const apiUrl = `${BLOCKPAY_CONFIG.changenow.apiUrl}/exchange`
    
    const payload = {
      fromCurrency: getChangeNowCurrency(fromAsset),
      toCurrency: getChangeNowCurrency(toAsset),
      fromNetwork: getChangeNowNetwork(fromChain),
      toNetwork: getChangeNowNetwork(toChain),
      fromAmount: amount,
      address: recipientAddress,
      flow: 'standard', // or 'fixed-rate' for fixed rate exchanges
      ...(refundAddress && { refundAddress }),
      // Add partner ID for affiliate tracking
      ...(BLOCKPAY_CONFIG.changenow.partnerId && {
        partnerId: BLOCKPAY_CONFIG.changenow.partnerId,
      }),
      // Add extra ID to track BlockPay order
      extraId: orderId,
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: getChangeNowHeaders(),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }))
      throw new Error(error.message || `ChangeNOW API error: ${response.status}`)
    }

    const data = await response.json()

    return {
      depositAddress: data.payinAddress,
      exchangeId: data.id,
      estimatedAmount: data.payoutAmount,
      exchangeRate: data.rate,
      validUntil: data.validUntil,
      flow: data.flow,
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
    const apiUrl = `${BLOCKPAY_CONFIG.changenow.apiUrl}/exchange/${exchangeId}`
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: getChangeNowHeaders(),
    })

    if (!response.ok) {
      throw new Error(`ChangeNOW API error: ${response.status}`)
    }

    const data = await response.json()

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

    const apiUrl = `${BLOCKPAY_CONFIG.changenow.apiUrl}/exchange/estimated-amount`
    
    const params = new URLSearchParams({
      fromCurrency: getChangeNowCurrency(fromAsset),
      toCurrency: getChangeNowCurrency(toAsset),
      fromNetwork: getChangeNowNetwork(fromChain),
      toNetwork: getChangeNowNetwork(toChain),
      fromAmount: amount.toString(),
      flow: 'standard',
    })

    const url = `${apiUrl}?${params}`
    console.log(`[ChangeNOW] Getting exchange rate: ${url}`)
    
    const headers = getChangeNowHeaders()
    console.log(`[ChangeNOW] Request headers:`, {
      'Content-Type': headers['Content-Type'],
      'x-api-key': headers['x-api-key'] ? `${headers['x-api-key'].substring(0, 8)}...${headers['x-api-key'].substring(headers['x-api-key'].length - 4)}` : 'missing',
      'x-partner-id': headers['x-partner-id'] || 'not set'
    })

    let response = await fetch(url, {
      method: 'GET',
      headers: headers,
    })

    // If v2 API returns 401/403, fallback to v1 API (which works with your API key)
    if ((response.status === 401 || response.status === 403) && BLOCKPAY_CONFIG.changenow.apiUrl.includes('/v2')) {
      console.log('[ChangeNOW] v2 API returned 401/403, falling back to v1 API...')
      
      // Try v1 API format: /v1/exchange-amount/{amount}/{from}_{to}?api_key={key}
      const fromCurrency = getChangeNowCurrency(fromAsset)
      const toCurrency = getChangeNowCurrency(toAsset)
      const v1Url = `https://api.changenow.io/v1/exchange-amount/${amount}/${fromCurrency}_${toCurrency}?api_key=${apiKey}`
      
      console.log(`[ChangeNOW] Trying v1 API: ${v1Url.replace(apiKey, apiKey.substring(0, 8) + '...')}`)
      
      try {
        response = await fetch(v1Url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        if (response.ok) {
          const v1Data = await response.json()
          console.log(`[ChangeNOW] v1 API success:`, v1Data)
          
          // v1 API returns just a number (the estimated amount), not an object
          const estimatedAmount = typeof v1Data === 'number' ? v1Data : (v1Data.estimatedAmount || v1Data.amount || v1Data)
          
          return {
            estimatedAmount: estimatedAmount.toString(),
            rate: null, // v1 doesn't provide rate
            minAmount: null,
            maxAmount: null,
          }
        }
      } catch (v1Error) {
        console.error('[ChangeNOW] v1 API fallback also failed:', v1Error)
        // Continue to throw the original v2 error
      }
    }

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { message: errorText }
      }
      
      console.error(`[ChangeNOW] API error ${response.status}:`, errorData)
      console.error(`[ChangeNOW] Request URL: ${url}`)
      console.error(`[ChangeNOW] Response headers:`, Object.fromEntries(response.headers.entries()))
      console.error(`[ChangeNOW] Full error response:`, errorText)
      
      if (response.status === 401 || response.status === 403) {
        const detailedError = errorData.message || errorData.error || errorText
        throw new Error(`Invalid ChangeNOW API key (${response.status}): ${detailedError}. Please check your CHANGENOW_API_KEY in .env file.`)
      } else if (response.status === 404) {
        throw new Error(`Exchange pair not available: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain})`)
      } else {
        throw new Error(`ChangeNOW API error: ${response.status} - ${errorData.message || errorText}`)
      }
    }

    const data = await response.json()
    console.log(`[ChangeNOW] Exchange rate response:`, data)

    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response from ChangeNOW API')
    }

    return {
      estimatedAmount: data.toAmount || data.estimatedAmount || null,
      rate: data.rate || null,
      minAmount: data.minAmount || null,
      maxAmount: data.maxAmount || null,
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

