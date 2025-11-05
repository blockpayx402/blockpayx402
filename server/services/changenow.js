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
    const apiUrl = `${BLOCKPAY_CONFIG.changenow.apiUrl}/exchange/estimated-amount`
    
    const params = new URLSearchParams({
      fromCurrency: getChangeNowCurrency(fromAsset),
      toCurrency: getChangeNowCurrency(toAsset),
      fromNetwork: getChangeNowNetwork(fromChain),
      toNetwork: getChangeNowNetwork(toChain),
      fromAmount: amount,
      flow: 'standard',
    })

    const response = await fetch(`${apiUrl}?${params}`, {
      method: 'GET',
      headers: getChangeNowHeaders(),
    })

    if (!response.ok) {
      throw new Error(`ChangeNOW API error: ${response.status}`)
    }

    const data = await response.json()

    return {
      estimatedAmount: data.toAmount,
      rate: data.rate,
      minAmount: data.minAmount,
      maxAmount: data.maxAmount,
    }
  } catch (error) {
    console.error('Error getting exchange rate:', error)
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

