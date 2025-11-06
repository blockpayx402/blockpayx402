/**
 * Relay SDK Integration
 * Fully dynamic - uses Relay SDK to fetch supported chains and tokens
 * No hardcoded pairs - works with every chain and token Relay supports
 * Based on: https://docs.relay.link/references/sdk/getting-started
 */

import { createClient, configureDynamicChains, MAINNET_RELAY_API, TESTNET_RELAY_API } from '@relayprotocol/relay-sdk'
import { BLOCKPAY_CONFIG } from '../config.js'
import { validateAddress } from '../utils/validation.js'

// Initialize Relay client (singleton)
let relayClient = null
let chainsInitialized = false

/**
 * Initialize Relay client
 */
const initializeRelayClient = async () => {
  if (relayClient && chainsInitialized) {
    return relayClient
  }

  try {
    // Configure dynamic chains first
    const chains = await configureDynamicChains()
    
    // Create client with dynamic chains
    relayClient = createClient({
      baseApiUrl: MAINNET_RELAY_API, // Use TESTNET_RELAY_API for testing
      source: 'blockpay.cloud', // Your app identifier
      chains: chains, // Dynamically fetched chains
    })
    
    chainsInitialized = true
    console.log('[Relay SDK] Client initialized with', chains.length, 'chains')
    return relayClient
  } catch (error) {
    console.error('[Relay SDK] Error initializing client:', error)
    // Fallback: create client without dynamic chains (will use default)
    relayClient = createClient({
      baseApiUrl: MAINNET_RELAY_API,
      source: 'blockpay.cloud',
    })
    return relayClient
  }
}

/**
 * Get Relay client instance
 */
const getRelayClient = async () => {
  if (!relayClient) {
    await initializeRelayClient()
  }
  return relayClient
}

/**
 * Get chain by name or ID
 */
const getChainByName = async (chainName) => {
  const client = await getRelayClient()
  
  // Try to find chain by various identifiers
  const chain = client.chains?.find(c => 
    c.name?.toLowerCase() === chainName.toLowerCase() ||
    c.chainId?.toString() === chainName.toString() ||
    c.id?.toString() === chainName.toString() ||
    c.symbol?.toLowerCase() === chainName.toLowerCase()
  )
  
  if (!chain) {
    // Refresh chains and try again
    await initializeRelayClient()
    const refreshedClient = await getRelayClient()
    const refreshedChain = refreshedClient.chains?.find(c => 
      c.name?.toLowerCase() === chainName.toLowerCase() ||
      c.chainId?.toString() === chainName.toString() ||
      c.id?.toString() === chainName.toString() ||
      c.symbol?.toLowerCase() === chainName.toLowerCase()
    )
    
    if (!refreshedChain) {
      throw new Error(`Chain not found: ${chainName}. Available chains: ${refreshedClient.chains?.map(c => c.name || c.chainId).join(', ') || 'none'}`)
    }
    
    return refreshedChain
  }
  
  return chain
}

/**
 * Get token by symbol on a chain
 */
const getTokenBySymbol = async (tokenSymbol, chain) => {
  try {
    // Use SDK's getCurrencies method if available
    // For now, we'll use the chain's token list if available
    const tokens = chain.tokens || []
    
    // Find token by symbol
    const token = tokens.find(t => 
      t.symbol?.toUpperCase() === tokenSymbol.toUpperCase() ||
      t.address?.toLowerCase() === tokenSymbol.toLowerCase()
    )
    
    if (token) {
      return token
    }
    
    // If not found in chain tokens, try fetching from API
    // Native tokens use zero address
    const nativeTokens = ['ETH', 'BNB', 'MATIC', 'SOL', 'AVAX', 'FTM']
    if (nativeTokens.includes(tokenSymbol.toUpperCase())) {
      return {
        address: '0x0000000000000000000000000000000000000000',
        symbol: tokenSymbol.toUpperCase(),
        decimals: chain.decimals || 18,
        isNative: true
      }
    }
    
    throw new Error(`Token ${tokenSymbol} not found on chain ${chain.name || chain.chainId}`)
  } catch (error) {
    console.error('[Relay SDK] Error getting token:', error)
    throw error
  }
}

/**
 * Create a Relay transaction using SDK
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
    const client = await getRelayClient()
    
    // Get chains
    const originChain = await getChainByName(fromChain)
    const destinationChain = await getChainByName(toChain)
    
    console.log('[Relay SDK] Chains:', {
      fromChain,
      originChainId: originChain.chainId || originChain.id,
      toChain,
      destinationChainId: destinationChain.chainId || destinationChain.id
    })
    
    // Get tokens
    const originToken = await getTokenBySymbol(fromAsset, originChain)
    const destinationToken = await getTokenBySymbol(toAsset, destinationChain)
    
    console.log('[Relay SDK] Tokens:', {
      fromAsset,
      originTokenAddress: originToken.address,
      toAsset,
      destinationTokenAddress: destinationToken.address
    })
    
    // Validate recipient address
    const recipientValidation = validateAddress(recipientAddress.trim(), toChain)
    if (!recipientValidation.valid) {
      throw new Error(`Invalid recipient address: ${recipientValidation.error}`)
    }
    
    // Use SDK's getQuote method to get an executable quote
    // Based on Relay SDK docs: https://docs.relay.link/references/api/overview
    const quote = await client.getQuote({
      fromChainId: originChain.chainId || originChain.id,
      toChainId: destinationChain.chainId || destinationChain.id,
      fromTokenAddress: originToken.address,
      toTokenAddress: destinationToken.address,
      amount: amount.toString(),
      userAddress: recipientAddress.trim(),
      recipientAddress: recipientAddress.trim(),
      ...(refundAddress && {
        refundAddress: refundAddress.trim()
      }),
    })
    
    if (!quote || !quote.depositAddress) {
      throw new Error('Failed to get quote from Relay SDK')
    }
    
    console.log('[Relay SDK] Quote received:', {
      depositAddress: quote.depositAddress,
      destinationAmount: quote.destinationAmount,
      quoteId: quote.id
    })
    
    return {
      exchangeId: quote.id || quote.quoteId || orderId,
      depositAddress: quote.depositAddress,
      estimatedAmount: quote.destinationAmount ? parseFloat(quote.destinationAmount) : null,
      amountAfterFee: amount, // Relay handles fees internally
      exchangeRate: quote.destinationAmount && amount ? parseFloat(quote.destinationAmount) / parseFloat(amount) : null,
      validUntil: quote.expiresAt || quote.validUntil || null,
      quote: quote, // Store full quote for execution
    }
  } catch (error) {
    console.error('[Relay SDK] Error creating transaction:', error)
    
    // Provide helpful error messages
    const errorMsg = error.message || String(error)
    if (errorMsg.includes('not found') || errorMsg.includes('not supported')) {
      throw new Error(`Relay does not support this pair: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try a different currency pair.`)
    } else if (errorMsg.includes('Invalid address')) {
      throw new Error(`Invalid address format for ${toChain}. Please check your recipient address.`)
    } else if (errorMsg.includes('Could not execute') || errorMsg.includes('cannot execute')) {
      throw new Error(`Relay cannot execute this swap: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). This pair may not be available.`)
    }
    
    throw error
  }
}

/**
 * Get exchange status using SDK
 */
export const getRelayStatus = async (exchangeId) => {
  try {
    const client = await getRelayClient()
    
    // Use SDK's getStatus method
    const status = await client.getStatus(exchangeId)
    
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
      status: statusMap[status.status] || status.status,
      exchangeId: status.id || exchangeId,
      ...status,
    }
  } catch (error) {
    console.error('[Relay SDK] Error getting status:', error)
    throw error
  }
}

/**
 * Get exchange rate estimate using SDK
 */
export const getRelayExchangeRate = async (fromAsset, toAsset, fromChain, toChain, amount) => {
  try {
    const client = await getRelayClient()
    
    // Get chains
    const originChain = await getChainByName(fromChain)
    const destinationChain = await getChainByName(toChain)
    
    // Get tokens
    const originToken = await getTokenBySymbol(fromAsset, originChain)
    const destinationToken = await getTokenBySymbol(toAsset, destinationChain)
    
    // Use placeholder address for estimation
    const placeholderAddress = originChain.chainId === 792703809 || originChain.id === 792703809
      ? '11111111111111111111111111111111' // Solana placeholder
      : '0x0000000000000000000000000000000000000000' // EVM placeholder
    
    // Get quote for estimation
    const quote = await client.getQuote({
      fromChainId: originChain.chainId || originChain.id,
      toChainId: destinationChain.chainId || destinationChain.id,
      fromTokenAddress: originToken.address,
      toTokenAddress: destinationToken.address,
      amount: amount.toString(),
      userAddress: placeholderAddress,
      recipientAddress: placeholderAddress,
    })
    
    // Extract destination amount from quote (handle different response formats)
    const destinationAmount = quote.destinationAmount || quote.toAmount || quote.outputAmount
    
    if (!quote || !destinationAmount) {
      throw new Error('Invalid response from Relay SDK: missing destination amount')
    }
    
    return {
      estimatedAmount: parseFloat(destinationAmount),
      fromAmount: parseFloat(amount),
      exchangeRate: parseFloat(destinationAmount) / parseFloat(amount),
    }
  } catch (error) {
    console.error('[Relay SDK] Error getting exchange rate:', error)
    throw error
  }
}

/**
 * Get all supported chains (for frontend)
 */
export const getAllRelayChains = async () => {
  try {
    const client = await getRelayClient()
    return client.chains || []
  } catch (error) {
    console.error('[Relay SDK] Error getting chains:', error)
    return []
  }
}

/**
 * Get all supported tokens for a chain (for frontend)
 */
export const getAllRelayTokens = async (chainId) => {
  try {
    const client = await getRelayClient()
    const chain = client.chains?.find(c => 
      c.chainId?.toString() === chainId.toString() || 
      c.id?.toString() === chainId.toString()
    )
    
    if (!chain) {
      return []
    }
    
    return chain.tokens || []
  } catch (error) {
    console.error('[Relay SDK] Error getting tokens:', error)
    return []
  }
}

/**
 * Initialize on module load
 */
initializeRelayClient().catch(err => {
  console.error('[Relay SDK] Failed to initialize on load:', err)
})
