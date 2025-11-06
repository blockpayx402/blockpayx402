/**
 * Relay Link API Integration
 * Cross-chain bridging and execution service
 * Documentation: https://docs.relay.link/references/api/overview
 */

import { BLOCKPAY_CONFIG } from '../config.js'

/**
 * Chain ID mapping for Relay Link
 * Note: Relay Link uses its own chain ID system
 * These IDs should match Relay Link's chain IDs from /chains endpoint
 */
const CHAIN_ID_MAP = {
  'ethereum': 1,
  'bnb': 56,
  'polygon': 137,
  'solana': 792703809, // Solana chain ID in Relay Link (verified via API)
  'bitcoin': 0, // Not supported by Relay
}

// Cache for dynamically fetched chain IDs
let chainIdCache = null

/**
 * Currency address mapping for Relay Link
 * Relay uses token addresses, not symbols
 */
const CURRENCY_ADDRESS_MAP = {
  // Ethereum
  'ETH': '0x0000000000000000000000000000000000000000', // Native ETH
  'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT on Ethereum
  'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0c3606eB48', // USDC on Ethereum
  
  // BNB Chain
  'BNB': '0x0000000000000000000000000000000000000000', // Native BNB
  'USDT': '0x55d398326f99059fF775485246999027B3197955', // USDT on BNB
  'USDC': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC on BNB
  
  // Polygon
  'MATIC': '0x0000000000000000000000000000000000000000', // Native MATIC
  'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT on Polygon
  'USDC': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
  
  // Solana
  'SOL': 'So11111111111111111111111111111111111111112', // Native SOL
  'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT on Solana
  'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
}

/**
 * Get Relay chain ID
 * Dynamically fetches chain IDs from Relay API and caches them
 */
const getRelayChainId = async (chain) => {
  // Fetch from API if cache is empty
  if (!chainIdCache) {
    try {
      console.log('[Relay Link] Fetching chains from API...')
      const response = await fetch('https://api.relay.link/chains')
      const data = await response.json()
      chainIdCache = {}
      
      if (data.chains && Array.isArray(data.chains)) {
        data.chains.forEach(chainData => {
          const chainName = chainData.name?.toLowerCase()
          if (chainName) {
            chainIdCache[chainName] = chainData.id
            // Also map common chain names
            if (chainName === 'ethereum') chainIdCache['eth'] = chainData.id
            if (chainName === 'bnb') chainIdCache['bsc'] = chainData.id
            if (chainName === 'polygon') chainIdCache['matic'] = chainData.id
            if (chainName === 'solana') chainIdCache['sol'] = chainData.id
          }
          if (chainData.displayName) {
            chainIdCache[chainData.displayName.toLowerCase()] = chainData.id
          }
        })
        
        console.log('[Relay Link] Cached chain IDs:', Object.keys(chainIdCache).slice(0, 10))
      }
    } catch (error) {
      console.error('[Relay Link] Error fetching chains:', error)
      // Fall back to static mapping on error
      return CHAIN_ID_MAP[chain] || null
    }
  }
  
  // Check cache first (prioritize dynamic lookup)
  const chainKey = chain.toLowerCase()
  const cachedId = chainIdCache[chainKey] || 
                   chainIdCache[chainKey.replace(' ', '')] ||
                   chainIdCache[chainKey.replace('-', '')]
  
  if (cachedId) {
    // Update static map for future reference
    CHAIN_ID_MAP[chain] = cachedId
    return cachedId
  }
  
  // Fall back to static mapping if not found in cache
  return CHAIN_ID_MAP[chain] || null
}

/**
 * Token decimals mapping
 */
const TOKEN_DECIMALS = {
  // Native currencies
  'ETH': 18,
  'BNB': 18,
  'MATIC': 18,
  'SOL': 9,
  
  // Ethereum tokens
  'USDT_ethereum': 6,
  'USDC_ethereum': 6,
  'DAI_ethereum': 18,
  
  // BNB Chain tokens
  'USDT_bnb': 18,
  'USDC_bnb': 18,
  'BUSD_bnb': 18,
  
  // Polygon tokens
  'USDT_polygon': 6,
  'USDC_polygon': 6,
  
  // Solana tokens
  'USDT_solana': 6,
  'USDC_solana': 6,
}

/**
 * Get token decimals for a given asset and chain
 */
const getTokenDecimals = (asset, chain) => {
  const assetUpper = asset.toUpperCase()
  
  // Check for native currency
  if (assetUpper === 'ETH' && chain === 'ethereum') return 18
  if (assetUpper === 'BNB' && chain === 'bnb') return 18
  if (assetUpper === 'MATIC' && chain === 'polygon') return 18
  if (assetUpper === 'SOL' && chain === 'solana') return 9
  
  // Check for token
  const key = `${assetUpper}_${chain}`
  return TOKEN_DECIMALS[key] || 18 // Default to 18 if unknown
}

/**
 * Convert amount to smallest unit (wei, satoshi, etc.) as a string with only digits
 * @param {number|string} amount - Amount in human-readable format (e.g., 1.5)
 * @param {string} asset - Token symbol (e.g., 'USDT', 'ETH')
 * @param {string} chain - Chain name (e.g., 'ethereum', 'bnb')
 * @returns {string} - Amount in smallest unit as string with only digits
 */
const convertToSmallestUnit = (amount, asset, chain) => {
  const decimals = getTokenDecimals(asset, chain)
  const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount
  
  // Multiply by 10^decimals and convert to BigInt to avoid floating point issues
  const multiplier = BigInt(10 ** decimals)
  const amountParts = amountNum.toString().split('.')
  const wholePart = BigInt(amountParts[0] || '0')
  const fractionalPart = amountParts[1] || ''
  
  // Pad fractional part to match decimals
  const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals)
  const fractionalBigInt = BigInt(paddedFractional || '0')
  
  // Calculate: (wholePart * 10^decimals) + fractionalBigInt
  const result = (wholePart * multiplier) + fractionalBigInt
  
  return result.toString()
}

// Cache for currency addresses fetched from Relay Link API
let currencyCache = {}

/**
 * Fetch currency address from Relay Link API
 * Uses the /currencies/v2 endpoint to get the exact currency identifier
 */
const fetchRelayCurrencyAddress = async (asset, chain) => {
  const cacheKey = `${asset.toUpperCase()}_${chain.toLowerCase()}`
  if (currencyCache[cacheKey]) {
    return currencyCache[cacheKey]
  }
  
  try {
    const chainId = await getRelayChainId(chain)
    if (!chainId) {
      throw new Error(`Chain ID not found for ${chain}`)
    }
    
    const response = await fetch('https://api.relay.link/currencies/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chainIds: [chainId],
        term: asset.toUpperCase(),
        verified: true,
        limit: 10,
      }),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch currencies: ${response.status}`)
    }
    
    const currencies = await response.json()
    if (Array.isArray(currencies) && currencies.length > 0) {
      // Find exact match by symbol and chain
      const currency = currencies.find(c => 
        c.symbol?.toUpperCase() === asset.toUpperCase() && 
        c.chainId === chainId
      ) || currencies[0]
      
      if (currency.address) {
        currencyCache[cacheKey] = currency.address
        console.log(`[Relay Link] Fetched currency ${asset} on ${chain}: ${currency.address}`)
        return currency.address
      }
    }
  } catch (error) {
    console.warn(`[Relay Link] Failed to fetch currency from API: ${error.message}`)
  }
  
  return null
}

/**
 * Get Relay currency address
 * Relay Link uses token contract addresses for EVM chains and mint addresses for Solana
 * First tries to fetch from API, then falls back to static mapping
 */
const getRelayCurrencyAddress = async (asset, chain) => {
  const assetUpper = asset.toUpperCase()
  const chainLower = chain.toLowerCase()
  const cacheKey = `${assetUpper}_${chainLower}`
  
  // Try API first
  const apiAddress = await fetchRelayCurrencyAddress(asset, chain)
  if (apiAddress) {
    return apiAddress
  }
  
  // Fallback to static mapping
  // For native currencies on EVM chains, use zero address
  const nativeCurrencies = {
    'ethereum': ['ETH'],
    'bnb': ['BNB'],
    'polygon': ['MATIC'],
  }
  
  if (nativeCurrencies[chainLower]?.includes(assetUpper)) {
    return '0x0000000000000000000000000000000000000000'
  }
  
  // For Solana native currency, use wrapped SOL address
  if (chainLower === 'solana') {
    if (assetUpper === 'SOL') {
      return 'So11111111111111111111111111111111111111112' // Wrapped SOL
    }
    if (assetUpper === 'USDT') {
      return 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
    }
    if (assetUpper === 'USDC') {
      return 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    }
  }
  
  // For EVM chains, use token contract addresses
  const key = `${assetUpper}_${chainLower}`
  const addressMap = {
    'USDT_ethereum': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    'USDC_ethereum': '0xA0b86991c6218b36c1d19D4a2e9Eb0c3606eB48',
    'USDT_bnb': '0x55d398326f99059fF775485246999027B3197955',
    'USDC_bnb': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    'USDT_polygon': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    'USDC_polygon': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  }
  
  const address = addressMap[key] || CURRENCY_ADDRESS_MAP[assetUpper]
  
  if (!address) {
    console.warn(`[Relay Link] Unknown currency address for ${assetUpper} on ${chainLower}, using asset name as fallback`)
    return asset
  }
  
  return address
}

/**
 * Get exchange rate estimate using Relay Link API
 * @param {string} fromAsset - Source currency (e.g., 'USDT')
 * @param {string} toAsset - Destination currency (e.g., 'SOL')
 * @param {string} fromChain - Source chain (e.g., 'ethereum')
 * @param {string} toChain - Destination chain (e.g., 'solana')
 * @param {number} amount - Amount to exchange
 * @returns {Promise<Object>} - { estimatedAmount, rate, minAmount, maxAmount, depositAddress, quoteId }
 */
export const getExchangeRate = async (fromAsset, toAsset, fromChain, toChain, amount) => {
  try {
    const originChainId = await getRelayChainId(fromChain)
    const destinationChainId = await getRelayChainId(toChain)
    
    if (!originChainId || !destinationChainId) {
      throw new Error(`Unsupported chain: ${fromChain} or ${toChain}`)
    }
    
    const originCurrency = await getRelayCurrencyAddress(fromAsset, fromChain)
    const destinationCurrency = await getRelayCurrencyAddress(toAsset, toChain)
    
    const apiUrl = 'https://api.relay.link/quote'
    
    // Convert amount to smallest unit (wei, lamports, etc.) as string with only digits
    const amountInSmallestUnit = convertToSmallestUnit(amount, fromAsset, fromChain)
    
    const payload = {
      originChainId,
      destinationChainId,
      originCurrency,
      destinationCurrency,
      amount: amountInSmallestUnit,
      tradeType: 'EXACT_INPUT',
      recipient: '0x0000000000000000000000000000000000000000', // Placeholder, will be set in actual transaction
      user: '0x0000000000000000000000000000000000000000', // Placeholder
      useDepositAddress: true,
    }
    
    console.log(`[Relay Link] Getting quote: ${apiUrl}`)
    console.log(`[Relay Link] Payload:`, { ...payload, recipient: '...', user: '...' })
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { message: errorText }
      }
      
      console.error(`[Relay Link] API error ${response.status}:`, errorData)
      
      if (response.status === 400) {
        const errorMsg = errorData.message || errorText
        if (errorMsg.includes('Could not execute swap') || errorMsg.includes('swap')) {
          throw new Error(`This swap route is not available: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). The currency pair may not be supported by Relay Link. Please try a different currency pair.`)
        }
        throw new Error(`Invalid request: ${errorMsg}`)
      } else if (response.status === 404) {
        throw new Error(`Exchange pair not available: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain})`)
      } else if (response.status === 500) {
        const errorMsg = errorData.message || errorText || ''
        if (errorMsg.includes('Could not execute swap') || errorMsg.includes('swap')) {
          throw new Error(`Relay Link cannot execute this swap: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). This pair may not be supported or the route is unavailable. Please try a different currency pair or amount.`)
        }
        throw new Error(`Relay Link API error: ${errorMsg || 'Internal server error'}`)
      } else {
        throw new Error(`Relay Link API error: ${response.status} - ${errorData.message || errorText}`)
      }
    }
    
    const data = await response.json()
    console.log(`[Relay Link] Quote response:`, data)
    
    // Extract estimated amount from Relay response
    // Relay response structure: { steps: [...], destinationAmount: "...", ... }
    // The response format may vary - check multiple possible fields
    const rawEstimatedAmount = data.destinationAmount || 
                           data.quote?.destinationAmount || 
                           data.steps?.[data.steps.length - 1]?.destinationAmount ||
                           null
    
    if (!rawEstimatedAmount) {
      console.error('[Relay Link] Invalid response structure:', JSON.stringify(data, null, 2))
      throw new Error('Invalid response from Relay Link API: missing destinationAmount')
    }
    
    // Convert estimated amount back from smallest unit to human-readable format
    const toDecimals = getTokenDecimals(toAsset, toChain)
    const estimatedAmountBigInt = BigInt(rawEstimatedAmount.toString())
    const divisor = BigInt(10 ** toDecimals)
    const estimatedAmountHuman = (Number(estimatedAmountBigInt) / Number(divisor)).toString()
    
    // Calculate rate if available
    const rate = data.rate || 
                 (estimatedAmountHuman && amount ? (parseFloat(estimatedAmountHuman) / parseFloat(amount)).toString() : null)
    
    return {
      estimatedAmount: estimatedAmountHuman, // Return in human-readable format
      rate: rate,
      minAmount: data.minAmount || null,
      maxAmount: data.maxAmount || null,
      depositAddress: data.depositAddress || data.deposit?.address || null,
      quoteId: data.quoteId || data.id || data.requestId || null,
    }
  } catch (error) {
    console.error('[Relay Link] Error getting quote:', error)
    throw error
  }
}

/**
 * Create a relay transaction (bridge/swap)
 */
export const createRelayTransaction = async (orderData) => {
  const {
    fromChain,
    fromAsset,
    toChain,
    toAsset,
    amount,
    recipientAddress,
    refundAddress,
    orderId, // BlockPay order ID
    userAddress, // User's wallet address
  } = orderData

  try {
    const originChainId = await getRelayChainId(fromChain)
    const destinationChainId = await getRelayChainId(toChain)
    
    if (!originChainId || !destinationChainId) {
      throw new Error(`Unsupported chain: ${fromChain} or ${toChain}`)
    }
    
    const originCurrency = await getRelayCurrencyAddress(fromAsset, fromChain)
    const destinationCurrency = await getRelayCurrencyAddress(toAsset, toChain)
    
    const apiUrl = 'https://api.relay.link/quote'
    
    // Convert amount to smallest unit (wei, lamports, etc.) as string with only digits
    const amountInSmallestUnit = convertToSmallestUnit(amount, fromAsset, fromChain)
    
    // Validate and format addresses based on their chains
    // For Relay Link:
    // - recipient: should match destination chain format
    // - user: should match origin chain format (if provided, otherwise use recipient)
    // - refundTo: should match origin chain format
    
    // Validate recipient address format matches destination chain
    const isEVMChain = (chain) => ['ethereum', 'bnb', 'polygon'].includes(chain.toLowerCase())
    const isSolanaChain = (chain) => chain.toLowerCase() === 'solana'
    
    const recipientIsEVM = /^0x[a-fA-F0-9]{40}$/i.test(recipientAddress)
    const recipientIsSolana = !recipientIsEVM && recipientAddress.length >= 32 && recipientAddress.length <= 44
    
    if (isEVMChain(toChain) && !recipientIsEVM) {
      throw new Error(`Invalid recipient address format for ${toChain}. Expected EVM address (0x...) but got Solana format.`)
    }
    if (isSolanaChain(toChain) && !recipientIsSolana) {
      throw new Error(`Invalid recipient address format for Solana. Expected Solana address (base58, 32-44 chars) but got EVM format.`)
    }
    
    // Format user address - should match origin chain format
    // Relay Link requires this field, so we must provide a valid address in origin chain format
    let formattedUserAddress = null
    
    if (userAddress) {
      const userIsEVM = /^0x[a-fA-F0-9]{40}$/i.test(userAddress)
      if (isEVMChain(fromChain) && userIsEVM) {
        formattedUserAddress = userAddress
      } else if (isSolanaChain(fromChain) && !userIsEVM && userAddress.length >= 32 && userAddress.length <= 44) {
        formattedUserAddress = userAddress
      } else {
        console.warn(`[Relay Link] User address format mismatch for origin chain ${fromChain}. Using fallback.`)
      }
    }
    
    // If still no valid user address, use fallback based on origin chain format
    if (!formattedUserAddress) {
      if (isEVMChain(fromChain)) {
        // For EVM chains, use zero address as placeholder (valid EVM format)
        formattedUserAddress = '0x0000000000000000000000000000000000000000'
        console.log(`[Relay Link] Using zero address placeholder for EVM origin chain ${fromChain}`)
      } else if (isSolanaChain(fromChain)) {
        // For Solana, check if recipient is Solana format
        if (recipientAddress.length >= 32 && recipientAddress.length <= 44) {
          formattedUserAddress = recipientAddress
        } else {
          // Use Solana system program address as placeholder
          formattedUserAddress = '11111111111111111111111111111111'
          console.log(`[Relay Link] Using Solana system program address as placeholder`)
        }
      }
    }
    
    // Format refund address - should match origin chain
    let formattedRefundAddress = refundAddress
    if (refundAddress) {
      const refundIsEVM = /^0x[a-fA-F0-9]{40}$/i.test(refundAddress)
      if (isEVMChain(fromChain) && !refundIsEVM) {
        console.warn(`[Relay Link] Refund address format mismatch for origin chain ${fromChain}. Expected EVM format.`)
        formattedRefundAddress = null // Don't include if format is wrong
      }
    }
    
    const payload = {
      originChainId,
      destinationChainId,
      originCurrency,
      destinationCurrency,
      amount: amountInSmallestUnit,
      tradeType: 'EXACT_INPUT',
      recipient: recipientAddress, // Destination chain format
      user: formattedUserAddress, // Required field - origin chain format
      useDepositAddress: true,
      ...(formattedRefundAddress && { refundTo: formattedRefundAddress }), // Origin chain format
      ...(orderId && { referrer: 'BlockPay' }),
    }
    
    console.log(`[Relay Link] Creating transaction: ${apiUrl}`)
    console.log(`[Relay Link] Payload:`, { ...payload, recipient: recipientAddress.substring(0, 10) + '...', user: (userAddress || recipientAddress).substring(0, 10) + '...' })
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { message: errorText }
      }
      
      console.error(`[Relay Link] API error ${response.status}:`, errorData)
      
      if (response.status === 400) {
        const errorMsg = errorData.message || errorText
        if (errorMsg.includes('Could not execute swap') || errorMsg.includes('swap')) {
          throw new Error(`This swap route is not available: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). The currency pair may not be supported by Relay Link. Please try a different currency pair.`)
        }
        throw new Error(`Invalid request: ${errorMsg}`)
      } else if (response.status === 404) {
        throw new Error(`Exchange pair not available: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain})`)
      } else if (response.status === 500) {
        const errorMsg = errorData.message || errorText || ''
        if (errorMsg.includes('Could not execute swap') || errorMsg.includes('swap')) {
          throw new Error(`Relay Link cannot execute this swap: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). This pair may not be supported or the route is unavailable. Please try a different currency pair or amount.`)
        }
        throw new Error(`Relay Link API error: ${errorMsg || 'Internal server error'}`)
      } else {
        throw new Error(`Relay Link API error: ${response.status} - ${errorData.message || errorText}`)
      }
    }
    
    const data = await response.json()
    console.log(`[Relay Link] Transaction response:`, data)
    
    // Extract deposit address and transaction info from Relay response
    const rawEstimatedAmount = data.destinationAmount || data.quote?.destinationAmount || null
    
    // Convert estimated amount back from smallest unit to human-readable format
    let estimatedAmountHuman = null
    if (rawEstimatedAmount) {
      const toDecimals = getTokenDecimals(toAsset, toChain)
      const estimatedAmountBigInt = BigInt(rawEstimatedAmount.toString())
      const divisor = BigInt(10 ** toDecimals)
      estimatedAmountHuman = (Number(estimatedAmountBigInt) / Number(divisor)).toString()
    }
    
    return {
      depositAddress: data.depositAddress || data.deposit?.address || null,
      exchangeId: data.quoteId || data.id || data.requestId || null,
      estimatedAmount: estimatedAmountHuman,
      exchangeRate: data.rate || null,
      validUntil: data.expiresAt || data.validUntil || null,
      flow: 'relay',
      steps: data.steps || [],
    }
  } catch (error) {
    console.error('Error creating Relay transaction:', error)
    throw error
  }
}

/**
 * Get transaction status from Relay Link
 */
export const getRelayStatus = async (requestId) => {
  try {
    const apiUrl = `https://api.relay.link/requests/${requestId}`
    
    console.log(`[Relay Link] Getting status: ${apiUrl}`)
    
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
      
      if (response.status === 404) {
        throw new Error(`Transaction not found: ${requestId}`)
      } else {
        throw new Error(`Relay Link API error: ${response.status} - ${errorData.message || errorText}`)
      }
    }
    
    const data = await response.json()
    console.log(`[Relay Link] Status response:`, data)
    
    // Map Relay status to BlockPay status
    const statusMap = {
      'pending': 'awaiting_deposit',
      'completed': 'completed',
      'failed': 'failed',
      'refunded': 'failed',
    }
    
    return {
      status: statusMap[data.status] || 'awaiting_deposit',
      depositAddress: data.depositAddress || null,
      depositTxHash: data.depositTxHash || null,
      swapTxHash: data.swapTxHash || null,
      fromAmount: data.fromAmount || null,
      toAmount: data.toAmount || data.destinationAmount || null,
      exchangeRate: data.rate || null,
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null,
    }
  } catch (error) {
    console.error('Error getting Relay status:', error)
    throw error
  }
}

export default {
  getExchangeRate,
  createRelayTransaction,
  getRelayStatus,
}

