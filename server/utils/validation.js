/**
 * Input Validation Utilities
 * Production-ready validation for chain swapping operations
 */

/**
 * Supported chains
 */
export const SUPPORTED_CHAINS = ['ethereum', 'bnb', 'polygon', 'solana', 'bitcoin']

/**
 * Supported assets per chain
 */
export const SUPPORTED_ASSETS = {
  ethereum: ['ETH', 'USDT', 'USDC', 'DAI'],
  bnb: ['BNB', 'USDT', 'USDC', 'BUSD'],
  polygon: ['MATIC', 'USDT', 'USDC'],
  solana: ['SOL', 'USDC'],
  bitcoin: ['BTC']
}

/**
 * Validate chain name
 * @param {string} chain - Chain name to validate
 * @returns {boolean} - True if valid
 */
export const validateChain = (chain) => {
  if (!chain || typeof chain !== 'string') return false
  return SUPPORTED_CHAINS.includes(chain.toLowerCase())
}

/**
 * Validate asset for a specific chain
 * @param {string} asset - Asset symbol to validate
 * @param {string} chain - Chain name
 * @returns {boolean} - True if valid
 */
export const validateAsset = (asset, chain) => {
  if (!asset || typeof asset !== 'string') return false
  if (!chain || !validateChain(chain)) return false
  
  const chainLower = chain.toLowerCase()
  const assetUpper = asset.toUpperCase()
  const supported = SUPPORTED_ASSETS[chainLower] || []
  
  return supported.includes(assetUpper)
}

/**
 * Validate amount
 * @param {number|string} amount - Amount to validate
 * @param {number} min - Minimum amount (optional)
 * @param {number} max - Maximum amount (optional)
 * @returns {{ valid: boolean, error?: string }} - Validation result
 */
export const validateAmount = (amount, min = null, max = null) => {
  if (amount === null || amount === undefined || amount === '') {
    return { valid: false, error: 'Amount is required' }
  }
  
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  
  if (!isFinite(num) || isNaN(num)) {
    return { valid: false, error: 'Amount must be a valid number' }
  }
  
  if (num <= 0) {
    return { valid: false, error: 'Amount must be greater than zero' }
  }
  
  if (min !== null && num < min) {
    return { valid: false, error: `Amount must be at least ${min}` }
  }
  
  if (max !== null && num > max) {
    return { valid: false, error: `Amount must not exceed ${max}` }
  }
  
  return { valid: true }
}

/**
 * Validate EVM address (Ethereum, BNB, Polygon)
 * @param {string} address - Address to validate
 * @returns {boolean} - True if valid
 */
export const validateEVMAddress = (address) => {
  if (!address || typeof address !== 'string') return false
  // EVM addresses are 0x followed by 40 hex characters
  return /^0x[a-fA-F0-9]{40}$/i.test(address.trim())
}

/**
 * Validate Solana address
 * @param {string} address - Address to validate
 * @returns {boolean} - True if valid
 */
export const validateSolanaAddress = (address) => {
  if (!address || typeof address !== 'string') return false
  // Solana addresses are base58 encoded, 32-44 characters
  const trimmed = address.trim()
  // Base58 regex: excludes 0, O, I, l
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)
}

/**
 * Validate Bitcoin address
 * @param {string} address - Address to validate
 * @returns {boolean} - True if valid (basic check)
 */
export const validateBitcoinAddress = (address) => {
  if (!address || typeof address !== 'string') return false
  const trimmed = address.trim()
  // Basic Bitcoin address formats: legacy (1...), segwit (3...), bech32 (bc1...)
  return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(trimmed)
}

/**
 * Validate address for a specific chain
 * @param {string} address - Address to validate
 * @param {string} chain - Chain name
 * @returns {{ valid: boolean, error?: string }} - Validation result
 */
export const validateAddress = (address, chain) => {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Address is required' }
  }
  
  if (!chain || !validateChain(chain)) {
    return { valid: false, error: 'Invalid chain' }
  }
  
  const chainLower = chain.toLowerCase()
  const trimmed = address.trim()
  
  if (chainLower === 'solana') {
    if (!validateSolanaAddress(trimmed)) {
      return { valid: false, error: 'Invalid Solana address format' }
    }
  } else if (chainLower === 'bitcoin') {
    if (!validateBitcoinAddress(trimmed)) {
      return { valid: false, error: 'Invalid Bitcoin address format' }
    }
  } else {
    // EVM chains (ethereum, bnb, polygon)
    if (!validateEVMAddress(trimmed)) {
      return { valid: false, error: 'Invalid EVM address format (must be 0x followed by 40 hex characters)' }
    }
  }
  
  return { valid: true }
}

/**
 * Validate exchange order data
 * @param {object} orderData - Order data to validate
 * @returns {{ valid: boolean, error?: string }} - Validation result
 */
export const validateExchangeOrder = (orderData) => {
  const { fromChain, fromAsset, toChain, toAsset, amount, recipientAddress, refundAddress } = orderData
  
  // Validate chains
  if (!validateChain(fromChain)) {
    return { valid: false, error: `Unsupported source chain: ${fromChain}` }
  }
  
  if (!validateChain(toChain)) {
    return { valid: false, error: `Unsupported destination chain: ${toChain}` }
  }
  
  // Validate assets
  if (!validateAsset(fromAsset, fromChain)) {
    return { valid: false, error: `Unsupported asset ${fromAsset} on chain ${fromChain}` }
  }
  
  if (!validateAsset(toAsset, toChain)) {
    return { valid: false, error: `Unsupported asset ${toAsset} on chain ${toChain}` }
  }
  
  // Validate amount
  const amountValidation = validateAmount(amount, 0.00000001) // Minimum 0.00000001
  if (!amountValidation.valid) {
    return amountValidation
  }
  
  // Validate recipient address
  const recipientValidation = validateAddress(recipientAddress, toChain)
  if (!recipientValidation.valid) {
    return { valid: false, error: `Invalid recipient address: ${recipientValidation.error}` }
  }
  
  // Validate refund address if provided
  if (refundAddress) {
    const refundValidation = validateAddress(refundAddress, fromChain)
    if (!refundValidation.valid) {
      return { valid: false, error: `Invalid refund address: ${refundValidation.error}` }
    }
  }
  
  return { valid: true }
}

/**
 * Sanitize string input
 * @param {string} input - Input to sanitize
 * @param {number} maxLength - Maximum length (optional)
 * @returns {string} - Sanitized string
 */
export const sanitizeString = (input, maxLength = null) => {
  if (typeof input !== 'string') return ''
  let sanitized = input.trim()
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }
  return sanitized
}

/**
 * Normalize amount to safe number
 * @param {number|string} amount - Amount to normalize
 * @returns {number} - Normalized number
 */
export const normalizeAmountNumber = (amount) => {
  if (typeof amount === 'string') {
    const parsed = parseFloat(amount)
    return isFinite(parsed) ? parsed : 0
  }
  return isFinite(amount) ? amount : 0
}

