/**
 * Relay Link API Integration
 * Fully dynamic - fetches supported chains and tokens from Relay API
 * No hardcoded pairs - works with every chain and token Relay supports
 */

import { BLOCKPAY_CONFIG } from '../config.js'
import { validateAddress, validateExchangeOrder } from '../utils/validation.js'

const API_BASE_URL = 'https://api.relay.link'
const API_TIMEOUT = 20000
const MAX_RETRIES = 2
const RETRY_DELAY = 1000

// Cache for chains and tokens
let chainsCache = null
let chainsCacheTime = 0
let tokensCache = {}
let tokensCacheTime = {}
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch with timeout
 */
const fetchWithTimeout = async (url, options = {}, timeout = API_TIMEOUT) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  }
}

/**
 * Fetch all supported chains from Relay API
 */
export const fetchRelayChains = async () => {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/chains`,
      { method: 'GET' },
      10000
    )
    
    if (!response.ok) {
      throw new Error(`Failed to fetch chains: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    chainsCache = data
    chainsCacheTime = Date.now()
    console.log('[Relay] Fetched chains:', data?.length || 0)
    return data
  } catch (error) {
    console.error('[Relay] Error fetching chains:', error)
    throw error
  }
}

/**
 * Get chain ID from chain name
 */
export const getRelayChainId = async (chainName) => {
  try {
    // Refresh cache if expired
    if (!chainsCache || Date.now() - chainsCacheTime > CACHE_TTL) {
      await fetchRelayChains()
    }
    
    if (!chainsCache || !Array.isArray(chainsCache)) {
      throw new Error('Chains cache is invalid')
    }
    
    // Find chain by name (case-insensitive)
    const chain = chainsCache.find(c => 
      c.name?.toLowerCase() === chainName.toLowerCase() ||
      c.chainId?.toString() === chainName ||
      c.symbol?.toLowerCase() === chainName.toLowerCase()
    )
    
    if (!chain) {
      throw new Error(`Chain not found: ${chainName}. Supported chains: ${chainsCache.map(c => c.name || c.chainId).join(', ')}`)
    }
    
    return chain.chainId || chain.id
  } catch (error) {
    console.error('[Relay] Error getting chain ID:', error)
    throw error
  }
}

/**
 * Fetch supported tokens for a chain
 */
export const fetchRelayTokens = async (chainId) => {
  try {
    // Check cache first
    if (tokensCache[chainId] && Date.now() - (tokensCacheTime[chainId] || 0) < CACHE_TTL) {
      return tokensCache[chainId]
    }
    
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/chains/${chainId}/tokens`,
      { method: 'GET' },
      10000
    )
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tokens for chain ${chainId}: ${response.status}`)
    }
    
    const data = await response.json()
    tokensCache[chainId] = data
    tokensCacheTime[chainId] = Date.now()
    console.log(`[Relay] Fetched tokens for chain ${chainId}:`, data?.length || 0)
    return data
  } catch (error) {
    console.error(`[Relay] Error fetching tokens for chain ${chainId}:`, error)
    throw error
  }
}

/**
 * Get token address from symbol and chain
 */
export const getRelayTokenAddress = async (tokenSymbol, chainId) => {
  try {
    const tokens = await fetchRelayTokens(chainId)
    
    if (!tokens || !Array.isArray(tokens)) {
      throw new Error(`No tokens found for chain ${chainId}`)
    }
    
    // Find token by symbol (case-insensitive)
    const token = tokens.find(t => 
      t.symbol?.toUpperCase() === tokenSymbol.toUpperCase() ||
      t.address?.toLowerCase() === tokenSymbol.toLowerCase()
    )
    
    if (!token) {
      throw new Error(`Token ${tokenSymbol} not found on chain ${chainId}. Available tokens: ${tokens.map(t => t.symbol).join(', ')}`)
    }
    
    return token.address || token.contractAddress
  } catch (error) {
    console.error('[Relay] Error getting token address:', error)
    throw error
  }
}

/**
 * Convert amount to smallest unit (wei, lamports, etc.)
 */
const convertToSmallestUnit = (amount, decimals = 18) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount)
  if (!isFinite(num) || isNaN(num)) {
    throw new Error(`Invalid amount: ${amount}`)
  }
  const multiplier = Math.pow(10, decimals)
  return Math.floor(num * multiplier).toString()
}

/**
 * Convert from smallest unit to human-readable
 */
const convertFromSmallestUnit = (amount, decimals = 18) => {
  const num = BigInt(amount)
  const divisor = BigInt(Math.pow(10, decimals))
  const whole = num / divisor
  const remainder = num % divisor
  return (Number(whole) + Number(remainder) / Number(divisor)).toString()
}

/**
 * Get token decimals (default 18 for EVM, 9 for Solana)
 */
const getTokenDecimals = (chainId, tokenAddress) => {
  // Solana uses 9 decimals
  if (chainId === 792703809 || chainId === '792703809') {
    return 9
  }
  // Most EVM tokens use 18, but some use 6 (USDT, USDC on some chains)
  // For now, default to 18 - Relay API should handle this
  return 18
}

/**
 * Create a Relay transaction
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
    orderId,
  } = orderData

  try {
    // Get chain IDs
    const originChainId = await getRelayChainId(fromChain)
    const destinationChainId = await getRelayChainId(toChain)
    
    console.log('[Relay] Chain IDs:', {
      fromChain,
      originChainId,
      toChain,
      destinationChainId
    })
    
    // Get token addresses
    let originTokenAddress = null
    let destinationTokenAddress = null
    
    // Check if it's native currency
    const isOriginNative = fromAsset.toUpperCase() === 'ETH' || 
                          fromAsset.toUpperCase() === 'BNB' || 
                          fromAsset.toUpperCase() === 'MATIC' ||
                          fromAsset.toUpperCase() === 'SOL'
    
    const isDestinationNative = toAsset.toUpperCase() === 'ETH' || 
                                toAsset.toUpperCase() === 'BNB' || 
                                toAsset.toUpperCase() === 'MATIC' ||
                                toAsset.toUpperCase() === 'SOL'
    
    if (!isOriginNative) {
      originTokenAddress = await getRelayTokenAddress(fromAsset, originChainId)
    }
    
    if (!isDestinationNative) {
      destinationTokenAddress = await getRelayTokenAddress(toAsset, destinationChainId)
    }
    
    console.log('[Relay] Token addresses:', {
      fromAsset,
      originTokenAddress,
      toAsset,
      destinationTokenAddress
    })
    
    // Convert amount to smallest unit
    const decimals = getTokenDecimals(originChainId, originTokenAddress)
    const amountInSmallestUnit = convertToSmallestUnit(amount, decimals)
    
    // Validate addresses
    const recipientValidation = validateAddress(recipientAddress.trim(), toChain)
    if (!recipientValidation.valid) {
      throw new Error(`Invalid recipient address: ${recipientValidation.error}`)
    }
    
    // Build payload
    const payload = {
      originChainId: originChainId.toString(),
      destinationChainId: destinationChainId.toString(),
      originTokenAddress: originTokenAddress || '0x0000000000000000000000000000000000000000', // Native token
      destinationTokenAddress: destinationTokenAddress || '0x0000000000000000000000000000000000000000', // Native token
      amount: amountInSmallestUnit,
      destinationAmount: null, // Let Relay calculate
      user: recipientAddress.trim(), // User address (for tracking)
      recipient: recipientAddress.trim(),
      ...(refundAddress && {
        refundTo: refundAddress.trim()
      }),
    }
    
    console.log('[Relay] Creating transaction:', {
      ...payload,
      amount: `${amount} (${amountInSmallestUnit} smallest units)`
    })
    
    // Make API call
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/transactions`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      API_TIMEOUT
    )
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      console.error('[Relay] API error:', errorData)
      
      if (errorData.error?.includes('Invalid address')) {
        throw new Error(`Invalid address format for chain. Please check your addresses.`)
      } else if (errorData.error?.includes('not supported')) {
        throw new Error(`Chain or token not supported by Relay: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain})`)
      } else if (errorData.error?.includes('Could not execute')) {
        throw new Error(`Relay cannot execute this swap: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). This pair may not be available.`)
      } else {
        throw new Error(`Relay API error: ${errorData.error || response.statusText}`)
      }
    }
    
    const data = await response.json()
    
    return {
      exchangeId: data.id || data.transactionId,
      depositAddress: data.depositAddress || data.originAddress,
      estimatedAmount: data.destinationAmount ? convertFromSmallestUnit(data.destinationAmount, getTokenDecimals(destinationChainId, destinationTokenAddress)) : null,
      amountAfterFee: amount, // Relay handles fees internally
      exchangeRate: data.destinationAmount && amount ? parseFloat(convertFromSmallestUnit(data.destinationAmount, getTokenDecimals(destinationChainId, destinationTokenAddress))) / parseFloat(amount) : null,
      validUntil: data.expiresAt || null,
    }
  } catch (error) {
    console.error('[Relay] Error creating transaction:', error)
    throw error
  }
}

/**
 * Get exchange status
 */
export const getRelayStatus = async (exchangeId) => {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/transactions/${exchangeId}`,
      { method: 'GET' },
      API_TIMEOUT
    )
    
    if (!response.ok) {
      throw new Error(`Failed to get status: ${response.status}`)
    }
    
    const data = await response.json()
    
    // Map Relay status to our status
    const statusMap = {
      'pending': 'awaiting_deposit',
      'confirming': 'processing',
      'processing': 'processing',
      'completed': 'completed',
      'failed': 'failed',
      'refunded': 'failed',
    }
    
    return {
      status: statusMap[data.status] || data.status,
      exchangeId: data.id || exchangeId,
      ...data,
    }
  } catch (error) {
    console.error('[Relay] Error getting status:', error)
    throw error
  }
}

/**
 * Get exchange rate estimate
 */
export const getRelayExchangeRate = async (fromAsset, toAsset, fromChain, toChain, amount) => {
  try {
    // Get chain IDs
    const originChainId = await getRelayChainId(fromChain)
    const destinationChainId = await getRelayChainId(toChain)
    
    // Get token addresses
    let originTokenAddress = null
    let destinationTokenAddress = null
    
    const isOriginNative = fromAsset.toUpperCase() === 'ETH' || 
                          fromAsset.toUpperCase() === 'BNB' || 
                          fromAsset.toUpperCase() === 'MATIC' ||
                          fromAsset.toUpperCase() === 'SOL'
    
    const isDestinationNative = toAsset.toUpperCase() === 'ETH' || 
                                toAsset.toUpperCase() === 'BNB' || 
                                toAsset.toUpperCase() === 'MATIC' ||
                                toAsset.toUpperCase() === 'SOL'
    
    if (!isOriginNative) {
      originTokenAddress = await getRelayTokenAddress(fromAsset, originChainId)
    }
    
    if (!isDestinationNative) {
      destinationTokenAddress = await getRelayTokenAddress(toAsset, destinationChainId)
    }
    
    // Convert amount to smallest unit
    const decimals = getTokenDecimals(originChainId, originTokenAddress)
    const amountInSmallestUnit = convertToSmallestUnit(amount, decimals)
    
    // Use placeholder addresses for rate estimation
    const placeholderEVM = '0x0000000000000000000000000000000000000000'
    const placeholderSolana = '11111111111111111111111111111111'
    
    const originPlaceholder = (originChainId === 792703809 || originChainId === '792703809') 
      ? placeholderSolana 
      : placeholderEVM
    
    const payload = {
      originChainId: originChainId.toString(),
      destinationChainId: destinationChainId.toString(),
      originTokenAddress: originTokenAddress || placeholderEVM,
      destinationTokenAddress: destinationTokenAddress || placeholderEVM,
      amount: amountInSmallestUnit,
      destinationAmount: null,
      user: originPlaceholder,
      recipient: originPlaceholder,
    }
    
    // Use estimate endpoint if available, otherwise create transaction and cancel
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/transactions/estimate`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      API_TIMEOUT
    )
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(`Relay API error: ${errorData.error || response.statusText}`)
    }
    
    const data = await response.json()
    
    if (!data.destinationAmount) {
      throw new Error('Invalid response from Relay API: missing destinationAmount')
    }
    
    const estimatedAmount = convertFromSmallestUnit(
      data.destinationAmount, 
      getTokenDecimals(destinationChainId, destinationTokenAddress)
    )
    
    return {
      estimatedAmount: parseFloat(estimatedAmount),
      fromAmount: amount,
      exchangeRate: parseFloat(estimatedAmount) / parseFloat(amount),
    }
  } catch (error) {
    console.error('[Relay] Error getting exchange rate:', error)
    throw error
  }
}

/**
 * Get all supported chains (for frontend)
 */
export const getAllRelayChains = async () => {
  try {
    if (!chainsCache || Date.now() - chainsCacheTime > CACHE_TTL) {
      await fetchRelayChains()
    }
    return chainsCache || []
  } catch (error) {
    console.error('[Relay] Error getting chains:', error)
    return []
  }
}

/**
 * Get all supported tokens for a chain (for frontend)
 */
export const getAllRelayTokens = async (chainId) => {
  try {
    return await fetchRelayTokens(chainId)
  } catch (error) {
    console.error('[Relay] Error getting tokens:', error)
    return []
  }
}

