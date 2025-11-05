/**
 * BlockPay Configuration
 * Production-ready configuration for BlockPay payment system
 */

export const BLOCKPAY_CONFIG = {
  // Service name
  name: 'BlockPay',
  version: '1.0.0',
  
  // ChangeNOW API Configuration
  changenow: {
    apiKey: process.env.CHANGENOW_API_KEY || '',
    apiUrl: 'https://api.changenow.io/v2',
    // Partner ID for affiliate tracking
    partnerId: process.env.CHANGENOW_PARTNER_ID || '',
    // Default affiliate fee (0.4% is ChangeNOW default, can be customized)
    defaultAffiliateFee: 0.004, // 0.4%
  },
  
  // BlockPay Fee Configuration
  fees: {
    // Platform fee percentage (e.g., 0.01 = 1%)
    platformFeePercent: parseFloat(process.env.BLOCKPAY_FEE_PERCENT || '0.01'),
    // Minimum fee amount (in USD equivalent)
    minFeeUSD: parseFloat(process.env.BLOCKPAY_MIN_FEE_USD || '0.10'),
    // Maximum fee amount (in USD equivalent, 0 = no limit)
    maxFeeUSD: parseFloat(process.env.BLOCKPAY_MAX_FEE_USD || '0'),
    // Fee recipient address (where fees are collected)
    feeRecipientAddress: process.env.BLOCKPAY_FEE_RECIPIENT || '',
    // Fee collection chain (which chain to collect fees on)
    feeChain: process.env.BLOCKPAY_FEE_CHAIN || 'ethereum',
  },
  
  // Payment Request Settings
  paymentRequest: {
    // Expiration time in hours
    expirationHours: parseInt(process.env.PAYMENT_REQUEST_EXPIRY_HOURS || '1'),
    // Auto-monitoring interval in seconds
    monitoringInterval: parseInt(process.env.MONITORING_INTERVAL_SECONDS || '20'),
  },
  
  // Order Settings
  order: {
    // Order expiration time in hours (after which order is cancelled)
    expirationHours: parseInt(process.env.ORDER_EXPIRY_HOURS || '24'),
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
}

/**
 * Calculate BlockPay platform fee
 * @param {number} amount - Transaction amount
 * @param {string} currency - Currency symbol
 * @returns {Object} Fee details
 */
export const calculatePlatformFee = (amount, currency = 'USD') => {
  const config = BLOCKPAY_CONFIG.fees
  const feePercent = config.platformFeePercent
  
  // Calculate fee
  let feeAmount = amount * feePercent
  
  // Apply minimum fee
  if (feeAmount < config.minFeeUSD) {
    feeAmount = config.minFeeUSD
  }
  
  // Apply maximum fee if set
  if (config.maxFeeUSD > 0 && feeAmount > config.maxFeeUSD) {
    feeAmount = config.maxFeeUSD
  }
  
  return {
    amount: feeAmount,
    percent: feePercent * 100,
    currency,
    recipientAddress: config.feeRecipientAddress,
    chain: config.feeChain,
  }
}

/**
 * Get ChangeNOW API headers
 */
export const getChangeNowHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'x-api-key': BLOCKPAY_CONFIG.changenow.apiKey,
    ...(BLOCKPAY_CONFIG.changenow.partnerId && {
      'x-partner-id': BLOCKPAY_CONFIG.changenow.partnerId,
    }),
  }
}

export default BLOCKPAY_CONFIG

