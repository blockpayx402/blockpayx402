/**
 * ChangeNOW Exchange Integration
 * Generate exchange links for users to convert their crypto to payment currency
 */

// ChangeNOW API configuration
const CHANGENOW_CONFIG = {
  baseUrl: 'https://changenow.io/pro/exchange',
  // In production, add your affiliate ID here
  affiliateId: process.env.VITE_CHANGENOW_AFFILIATE_ID || '',
}

// Currency mapping for ChangeNOW
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
 * Get ChangeNOW currency code
 */
export const getChangeNowCurrency = (currency) => {
  if (!currency) return 'eth'
  
  const upperCurrency = currency.toUpperCase()
  return CURRENCY_MAP[upperCurrency] || currency.toLowerCase()
}

/**
 * Generate ChangeNOW exchange link
 * @param {string} fromCurrency - Currency to exchange from
 * @param {string} toCurrency - Currency to exchange to
 * @param {number} amount - Optional amount to exchange
 * @param {string} recipientAddress - Optional recipient address for exchange
 * @returns {string} ChangeNOW exchange URL
 */
export const generateExchangeLink = (fromCurrency, toCurrency, amount = null, recipientAddress = null) => {
  const from = getChangeNowCurrency(fromCurrency)
  const to = getChangeNowCurrency(toCurrency)
  
  let url = `${CHANGENOW_CONFIG.baseUrl}?from=${from}&to=${to}`
  
  // Add affiliate ID if configured
  if (CHANGENOW_CONFIG.affiliateId) {
    url += `&aff_id=${CHANGENOW_CONFIG.affiliateId}`
  }
  
  // Add amount if provided
  if (amount) {
    url += `&amount=${amount}`
  }
  
  // Add recipient address if provided (for direct exchange to payment address)
  if (recipientAddress) {
    url += `&address=${encodeURIComponent(recipientAddress)}`
  }
  
  return url
}

/**
 * Get exchange link for payment
 * If user doesn't have the required currency, they can exchange
 */
export const getExchangeLinkForPayment = (paymentCurrency, paymentAmount, recipientAddress = null) => {
  // For now, default from BTC (most common)
  // In production, detect user's wallet balance and suggest best exchange
  return generateExchangeLink('BTC', paymentCurrency, paymentAmount, recipientAddress)
}

/**
 * Get available exchange options
 * Returns list of currencies user can exchange from
 */
export const getAvailableExchangeCurrencies = () => {
  return Object.keys(CURRENCY_MAP).map(key => ({
    symbol: key,
    code: CURRENCY_MAP[key],
    name: key === 'ETH' ? 'Ethereum' :
          key === 'BTC' ? 'Bitcoin' :
          key === 'BNB' ? 'BNB Chain' :
          key === 'MATIC' ? 'Polygon' :
          key === 'SOL' ? 'Solana' :
          key
  }))
}

export default {
  generateExchangeLink,
  getExchangeLinkForPayment,
  getAvailableExchangeCurrencies,
  getChangeNowCurrency,
}

