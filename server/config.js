/**
 * BlockPay Configuration
 * Production-ready configuration for BlockPay payment system
 */

export const BLOCKPAY_CONFIG = {
  // Service name
  name: 'BlockPay',
  version: '1.0.0',
  
  // Cross-Chain Swap API Configuration
  changenow: {
    apiKey: process.env.CHANGENOW_API_KEY || '',
    apiUrl: 'https://api.changenow.io/v1',
    // Partner ID for affiliate tracking
    partnerId: process.env.CHANGENOW_PARTNER_ID || '',
    // Default affiliate fee
    defaultAffiliateFee: 0.004, // 0.4%
  },
  
  // SimpleSwap API Configuration
  simpleswap: {
    apiKey: process.env.SIMPLESWAP_API_KEY || '',
    apiUrl: 'https://api.simpleswap.io', // Base URL - endpoints use /v1/ prefix
  },
  
  // BlockPay Fee Configuration
  fees: {
    // Platform fee percentage (e.g., 0.01 = 1%)
    platformFeePercent: parseFloat(process.env.BLOCKPAY_FEE_PERCENT || '0.01'),
    // Minimum fee amount (in USD equivalent)
    minFeeUSD: parseFloat(process.env.BLOCKPAY_MIN_FEE_USD || '0.10'),
    // Maximum fee amount (in USD equivalent, 0 = no limit)
    maxFeeUSD: parseFloat(process.env.BLOCKPAY_MAX_FEE_USD || '0'),
    // Fee recipient addresses (chain-specific)
    feeRecipients: {
      // EVM chains (Ethereum, BNB, Polygon)
      ethereum: process.env.BLOCKPAY_FEE_RECIPIENT_EVM || process.env.BLOCKPAY_FEE_RECIPIENT || '0xfe9D33653B41BBE16ddc6C89edF1C089E27Aea78',
      bnb: process.env.BLOCKPAY_FEE_RECIPIENT_EVM || process.env.BLOCKPAY_FEE_RECIPIENT || '0xfe9D33653B41BBE16ddc6C89edF1C089E27Aea78',
      polygon: process.env.BLOCKPAY_FEE_RECIPIENT_EVM || process.env.BLOCKPAY_FEE_RECIPIENT || '0xfe9D33653B41BBE16ddc6C89edF1C089E27Aea78',
      // Solana
      solana: process.env.BLOCKPAY_FEE_RECIPIENT_SOL || '7FSRx9hk9GHcqJNRsG8B9oTLSZSohNB7TZc9pPio45Gn',
    },
    // Legacy: single fee recipient (for backward compatibility)
    feeRecipientAddress: process.env.BLOCKPAY_FEE_RECIPIENT || process.env.BLOCKPAY_FEE_RECIPIENT_EVM || '0xfe9D33653B41BBE16ddc6C89edF1C089E27Aea78',
    // Fee collection chain (which chain to collect fees on)
    feeChain: process.env.BLOCKPAY_FEE_CHAIN || 'ethereum',
  },
  
  // Payment Request Settings
  paymentRequest: {
    // Expiration time in hours
    expirationHours: parseInt(process.env.PAYMENT_REQUEST_EXPIRY_HOURS || '720'),
    // Auto-monitoring interval in seconds
    monitoringInterval: parseInt(process.env.MONITORING_INTERVAL_SECONDS || '20'),
  },
  
  // Order Settings
  order: {
    // Order expiration time in hours (after which order is cancelled)
    expirationHours: parseInt(process.env.ORDER_EXPIRY_HOURS || '720'),
    // Status check interval in seconds
    statusCheckInterval: parseInt(process.env.ORDER_STATUS_CHECK_INTERVAL || '10'),
  },
  
  // Webhook Configuration
  webhook: {
    // Webhook secret for verifying ChangeNOW webhooks
    secret: process.env.WEBHOOK_SECRET || '',
    // Webhook endpoint path
    endpoint: '/api/webhooks/changenow',
  },
  
  // Environment
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Site Configuration
  site: {
    domain: 'blockpay.cloud',
    url: 'https://blockpay.cloud',
    apiUrl: 'https://blockpay.cloud/api',
  },
}

/**
 * Calculate BlockPay platform fee
 * @param {number} amount - Transaction amount
 * @param {string} currency - Currency symbol
 * @param {string} chain - Blockchain chain (optional, defaults to ethereum)
 * @returns {Object} Fee details
 */
export const calculatePlatformFee = (amount, currency = 'USD', chain = 'ethereum') => {
  const config = BLOCKPAY_CONFIG.fees
  const feePercent = config.platformFeePercent
  
  // Calculate fee
  let feeAmount = amount * feePercent
  
  // Apply minimum fee (but don't exceed the amount itself)
  if (feeAmount < config.minFeeUSD) {
    feeAmount = Math.min(config.minFeeUSD, amount * 0.5) // Cap at 50% of amount to prevent negative
  }
  
  // Apply maximum fee if set
  if (config.maxFeeUSD > 0 && feeAmount > config.maxFeeUSD) {
    feeAmount = config.maxFeeUSD
  }
  
  // CRITICAL: Ensure fee never exceeds the amount (prevents negative amounts)
  feeAmount = Math.min(feeAmount, amount * 0.99) // Cap at 99% of amount
  
  // Get chain-specific fee recipient
  const recipientAddress = config.feeRecipients[chain] || config.feeRecipientAddress
  
  return {
    amount: feeAmount,
    percent: feePercent * 100,
    currency,
    recipientAddress,
    chain: chain || config.feeChain,
  }
}

/**
 * Get ChangeNOW API headers
 * Reads API key dynamically from environment to ensure it's always current
 */
export const getChangeNowHeaders = () => {
  // Read API key dynamically from environment (not from cached config)
  const apiKey = process.env.CHANGENOW_API_KEY || BLOCKPAY_CONFIG.changenow.apiKey || ''
  const partnerId = process.env.CHANGENOW_PARTNER_ID || BLOCKPAY_CONFIG.changenow.partnerId || ''
  
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    ...(partnerId && {
      'x-partner-id': partnerId,
    }),
  }
}

export default BLOCKPAY_CONFIG

