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
    // getQuote is under client.actions, not client directly
    // tradeType is required: 'EXACT_INPUT' or 'EXACT_OUTPUT'
    const quote = await client.actions.getQuote({
      chainId: originChain.chainId || originChain.id,
      toChainId: destinationChain.chainId || destinationChain.id,
      currency: originToken.address,
      toCurrency: destinationToken.address,
      amount: amount.toString(),
      tradeType: 'EXACT_INPUT', // Required parameter
      user: recipientAddress.trim(),
      recipient: recipientAddress.trim(),
      ...(refundAddress && {
        refundTo: refundAddress.trim()
      }),
    })
    
    // Extract data from quote response
    // Relay SDK quote format may vary, so we handle multiple possible fields
    const depositAddress = quote.depositAddress || quote.originAddress || quote.fromAddress
    const destinationAmount = quote.destinationAmount || quote.toAmount || quote.outputAmount
    const quoteId = quote.id || quote.quoteId || quote.requestId
    
    console.log('[Relay SDK] Quote received:', {
      depositAddress,
      destinationAmount,
      quoteId
    })
    
    if (!quote || !depositAddress) {
      throw new Error('Failed to get quote from Relay SDK')
    }
    
    return {
      exchangeId: quoteId || orderId,
      depositAddress: depositAddress,
      estimatedAmount: destinationAmount ? parseFloat(destinationAmount) : null,
      amountAfterFee: amount, // Relay handles fees internally
      exchangeRate: destinationAmount && amount ? parseFloat(destinationAmount) / parseFloat(amount) : null,
      validUntil: quote.expiresAt || quote.validUntil || quote.expiry || null,
      quote: quote, // Store full quote for execution
    }
  } catch (error) {
    console.error('[Relay SDK] Error creating transaction:', error)
    console.error('[Relay SDK] Error details:', {
      message: error.message,
      stack: error.stack,
      fromChain,
      fromAsset,
      toChain,
      toAsset,
      amount
    })
    
    // Log the full error object for debugging
    if (error.response) {
      console.error('[Relay SDK] Error response:', error.response)
    }
    if (error.data) {
      console.error('[Relay SDK] Error data:', error.data)
    }
    
    // Provide helpful error messages
    const errorMsg = error.message || String(error)
    const errorStr = errorMsg.toLowerCase()
    
    // Only throw "not supported" if it's explicitly stated or a 404/400 with specific messages
    if (errorStr.includes('pair') && (errorStr.includes('not found') || errorStr.includes('not supported') || errorStr.includes('not available'))) {
      throw new Error(`Relay does not support this pair: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try a different currency pair.`)
    } else if (errorStr.includes('invalid address')) {
      throw new Error(`Invalid address format for ${toChain}. Please check your recipient address.`)
    } else if (errorStr.includes('could not execute') || errorStr.includes('cannot execute')) {
      throw new Error(`Relay cannot execute this swap: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). This pair may not be available.`)
    } else if (errorStr.includes('tradeType') || errorStr.includes('trade type')) {
      throw new Error(`Relay SDK configuration error. Please contact support.`)
    }
    
    // For other errors, throw the original error with more context
    throw new Error(`Relay SDK error: ${errorMsg}. Please try again or contact support if the issue persists.`)
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
    console.log('[Relay] Getting exchange rate:', { fromAsset, toAsset, fromChain, toChain, amount })
    
    // Get chains directly from API instead of SDK to ensure we have all chains
    const chains = await getAllRelayChains()
    
    // Map common chain names to IDs
    const chainNameMap = {
      'ethereum': '1',
      'eth': '1',
      'bsc': '56',
      'bnb': '56',
      'binance': '56',
      'polygon': '137',
      'matic': '137',
      'arbitrum': '42161',
      'arbitrum-one': '42161',
      'optimism': '10',
      'op': '10',
      'op-mainnet': '10',
      'base': '8453',
      'solana': '792703809',
      'sol': '792703809',
    }
    
    // Normalize chain input - could be name, ID, or value from frontend
    const fromChainLower = fromChain.toLowerCase()
    const toChainLower = toChain.toLowerCase()
    
    const fromChainId = chainNameMap[fromChainLower] || fromChain
    const toChainId = chainNameMap[toChainLower] || toChain
    
    console.log('[Relay] Looking for chains:', { fromChain, fromChainId, toChain, toChainId })
    console.log('[Relay] Available chains:', chains.map(c => ({
      id: c.chainId || c.id || c.chain_id,
      name: c.name || c.displayName || c.label,
      symbol: c.symbol
    })).slice(0, 10))
    
    const originChain = chains.find(c => {
      const cId = c.chainId || c.id || c.chain_id
      const cName = (c.name || c.displayName || c.label || '').toLowerCase().replace(/\s+/g, '-')
      const cSymbol = (c.symbol || '').toLowerCase()
      const cValue = cName.replace(/\s+/g, '-') // Match frontend value format
      
      return cId?.toString() === fromChainId.toString() || 
             cId?.toString() === fromChain.toString() ||
             cName === fromChainLower ||
             cName === fromChainId.toString() ||
             cValue === fromChainLower ||
             cSymbol === fromChainLower ||
             cId?.toString() === fromChainLower
    })
    
    const destinationChain = chains.find(c => {
      const cId = c.chainId || c.id || c.chain_id
      const cName = (c.name || c.displayName || c.label || '').toLowerCase().replace(/\s+/g, '-')
      const cSymbol = (c.symbol || '').toLowerCase()
      const cValue = cName.replace(/\s+/g, '-') // Match frontend value format
      
      return cId?.toString() === toChainId.toString() || 
             cId?.toString() === toChain.toString() ||
             cName === toChainLower ||
             cName === toChainId.toString() ||
             cValue === toChainLower ||
             cSymbol === toChainLower ||
             cId?.toString() === toChainLower
    })
    
    if (!originChain) {
      throw new Error(`Chain not found: ${fromChain}`)
    }
    if (!destinationChain) {
      throw new Error(`Chain not found: ${toChain}`)
    }
    
    const originChainId = originChain.chainId || originChain.id || originChain.chain_id
    const destinationChainId = destinationChain.chainId || destinationChain.id || destinationChain.chain_id
    
    console.log('[Relay] Chain IDs:', { originChainId, destinationChainId })
    
    // Get tokens for both chains
    const originTokens = await getAllRelayTokens(originChainId)
    const destinationTokens = await getAllRelayTokens(destinationChainId)
    
    const originToken = originTokens.find(t => 
      t.symbol?.toUpperCase() === fromAsset.toUpperCase()
    )
    const destinationToken = destinationTokens.find(t => 
      t.symbol?.toUpperCase() === toAsset.toUpperCase()
    )
    
    if (!originToken) {
      throw new Error(`Token ${fromAsset} not found on ${fromChain}`)
    }
    if (!destinationToken) {
      throw new Error(`Token ${toAsset} not found on ${toChain}`)
    }
    
    console.log('[Relay] Token addresses:', {
      originToken: originToken.address,
      destinationToken: destinationToken.address
    })
    
    // Use Relay API directly for quote (more reliable than SDK)
    const placeholderAddress = (originChainId === 792703809 || originChainId === '792703809')
      ? '11111111111111111111111111111111' // Solana placeholder
      : '0x0000000000000000000000000000000000000000' // EVM placeholder
    
    // Convert amount to smallest unit
    const decimals = originToken.decimals || 18
    const amountInSmallestUnit = Math.floor(parseFloat(amount) * Math.pow(10, decimals)).toString()
    
    console.log('[Relay] Requesting quote from SDK...')
    console.log('[Relay] Quote request:', {
      originChainId: originChainId.toString(),
      destinationChainId: destinationChainId.toString(),
      originTokenAddress: originToken.address || '0x0000000000000000000000000000000000000000',
      destinationTokenAddress: destinationToken.address || '0x0000000000000000000000000000000000000000',
      amount: amountInSmallestUnit,
    })
    
    // Use Relay SDK's getQuote method instead of direct API call
    const client = await getRelayClient()
    
    // getQuote is under client.actions, not client directly
    // tradeType is required: 'EXACT_INPUT' or 'EXACT_OUTPUT'
    const quote = await client.actions.getQuote({
      chainId: parseInt(originChainId),
      toChainId: parseInt(destinationChainId),
      currency: originToken.address || '0x0000000000000000000000000000000000000000',
      toCurrency: destinationToken.address || '0x0000000000000000000000000000000000000000',
      amount: amountInSmallestUnit,
      tradeType: 'EXACT_INPUT', // Required: EXACT_INPUT means we know the input amount
      user: placeholderAddress,
      recipient: placeholderAddress,
    })
    
    console.log('[Relay] Quote response:', JSON.stringify(quote, null, 2))
    
    // Extract destination amount from quote
    // Relay SDK quote format may vary, so we handle multiple possible fields
    // Check various possible locations for the output amount
    let destinationAmount = quote.destinationAmount || 
                          quote.toAmount || 
                          quote.outputAmount || 
                          quote.estimatedAmount || 
                          quote.amountOut ||
                          quote.amountOutMin ||
                          quote.expectedOutput ||
                          quote.output ||
                          quote.receiveAmount ||
                          quote.amount ||
                          (quote.route && quote.route.amountOut) ||
                          (quote.route && quote.route.outputAmount) ||
                          (quote.routes && quote.routes[0] && quote.routes[0].amountOut) ||
                          (quote.routes && quote.routes[0] && quote.routes[0].outputAmount) ||
                          (quote.result && quote.result.amountOut) ||
                          (quote.result && quote.result.outputAmount) ||
                          (quote.data && quote.data.amountOut) ||
                          (quote.data && quote.data.outputAmount)
    
    // If still not found, try to calculate from exchange rate or other fields
    if (!destinationAmount && destinationAmount !== 0) {
      // Try to get from exchange rate if available
      if (quote.exchangeRate || quote.rate) {
        const rate = parseFloat(quote.exchangeRate || quote.rate)
        const inputAmount = parseFloat(amountInSmallestUnit)
        destinationAmount = (inputAmount * rate).toString()
        console.log('[Relay] Calculated destination amount from rate:', destinationAmount)
      } else if (quote.priceImpact || quote.price) {
        // Try to calculate from price
        const price = parseFloat(quote.priceImpact || quote.price)
        const inputAmount = parseFloat(amountInSmallestUnit)
        destinationAmount = (inputAmount * price).toString()
        console.log('[Relay] Calculated destination amount from price:', destinationAmount)
      }
    }
    
    console.log('[Relay] Extracted destination amount:', destinationAmount)
    console.log('[Relay] Quote keys:', Object.keys(quote))
    
    if (!destinationAmount && destinationAmount !== 0) {
      console.error('[Relay] No destination amount in quote. Full quote:', JSON.stringify(quote, null, 2))
      // Return a fallback estimate based on 1:1 ratio if we can't find the amount
      // This is better than failing completely
      console.warn('[Relay] Using fallback 1:1 estimate for destination amount')
      destinationAmount = amountInSmallestUnit
    }
    
    // Convert back from smallest unit
    const destDecimals = destinationToken.decimals || 18
    // destinationAmount might already be in human-readable format or smallest unit
    // Check if it's a string (likely smallest unit) or number (might be human-readable)
    // If it's a very large number, it's likely in smallest unit
    const amountValue = typeof destinationAmount === 'string' 
      ? parseFloat(destinationAmount) 
      : parseFloat(destinationAmount)
    
    // If amount is very large (> 1e10), assume it's in smallest unit and convert
    const estimatedAmount = amountValue > 1e10 
      ? amountValue / Math.pow(10, destDecimals)
      : amountValue
    
    return {
      estimatedAmount: estimatedAmount,
      fromAmount: parseFloat(amount),
      exchangeRate: estimatedAmount / parseFloat(amount),
    }
  } catch (error) {
    console.error('[Relay SDK] Error getting exchange rate:', error)
    throw error
  }
}

/**
 * Get all supported chains (for frontend)
 * Uses Relay API directly: GET /chains
 */
export const getAllRelayChains = async () => {
  try {
    console.log('[Relay] Fetching all chains from API...')
    
    // Use Relay API directly to get all chains
    const response = await fetch('https://api.relay.link/chains', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch chains: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('[Relay] Received chains response:', Array.isArray(data) ? 'array' : typeof data)
    
    // Handle different response formats
    let chains = []
    if (Array.isArray(data)) {
      chains = data
    } else if (data.chains && Array.isArray(data.chains)) {
      chains = data.chains
    } else if (data.data && Array.isArray(data.data)) {
      chains = data.data
    }
    
    console.log('[Relay] Found', chains.length, 'chains')
    
    // Fallback to SDK if API fails
    if (chains.length === 0) {
      console.log('[Relay] API returned 0 chains, trying SDK fallback...')
      const client = await getRelayClient()
      chains = client.chains || []
      console.log('[Relay] SDK fallback returned', chains.length, 'chains')
    }
    
    return chains
  } catch (error) {
    console.error('[Relay SDK] Error getting chains:', error)
    // Fallback to SDK
    try {
      const client = await getRelayClient()
      return client.chains || []
    } catch (fallbackError) {
      console.error('[Relay SDK] Fallback also failed:', fallbackError)
      return []
    }
  }
}

/**
 * Get all supported tokens for a chain (for frontend)
 * Uses Relay API endpoint: POST /currencies
 */
export const getAllRelayTokens = async (chainId) => {
  try {
    console.log('[Relay] Fetching tokens for chainId:', chainId)
    
    // First, try to get tokens from the chain data itself (from /chains endpoint)
    const chains = await getAllRelayChains()
    const chain = chains.find(c => {
      const cId = c.chainId || c.id || c.chain_id
      return cId?.toString() === chainId.toString() || cId === chainId
    })
    
    console.log('[Relay] Found chain:', chain ? (chain.name || chain.displayName) : 'NOT FOUND')
    
    if (chain) {
      // Check if tokens are in chain data
      if (chain.tokens && Array.isArray(chain.tokens) && chain.tokens.length > 0) {
        console.log('[Relay] Found', chain.tokens.length, 'tokens in chain data')
        return chain.tokens.map(token => ({
          symbol: token.symbol || token.name || 'UNKNOWN',
          address: token.address || token.contractAddress || token.tokenAddress || (token.isNative ? '0x0000000000000000000000000000000000000000' : ''),
          decimals: token.decimals || 18,
          name: token.name || token.symbol,
          isNative: token.isNative || token.address === '0x0000000000000000000000000000000000000000' || !token.address,
        }))
      }
      
      // Check if tokens are in tokenSupport or supportedTokens
      if (chain.tokenSupport && Array.isArray(chain.tokenSupport) && chain.tokenSupport.length > 0) {
        console.log('[Relay] Found', chain.tokenSupport.length, 'tokens in tokenSupport')
        return chain.tokenSupport.map(token => ({
          symbol: token.symbol || token.name || 'UNKNOWN',
          address: token.address || token.contractAddress || token.tokenAddress || (token.isNative ? '0x0000000000000000000000000000000000000000' : ''),
          decimals: token.decimals || 18,
          name: token.name || token.symbol,
          isNative: token.isNative || token.address === '0x0000000000000000000000000000000000000000' || !token.address,
        }))
      }
      
      if (chain.supportedTokens && Array.isArray(chain.supportedTokens) && chain.supportedTokens.length > 0) {
        console.log('[Relay] Found', chain.supportedTokens.length, 'tokens in supportedTokens')
        return chain.supportedTokens.map(token => ({
          symbol: token.symbol || token.name || 'UNKNOWN',
          address: token.address || token.contractAddress || token.tokenAddress || (token.isNative ? '0x0000000000000000000000000000000000000000' : ''),
          decimals: token.decimals || 18,
          name: token.name || token.symbol,
          isNative: token.isNative || token.address === '0x0000000000000000000000000000000000000000' || !token.address,
        }))
      }
      
      // Check erc20Currencies field
      if (chain.erc20Currencies && Array.isArray(chain.erc20Currencies) && chain.erc20Currencies.length > 0) {
        console.log('[Relay] Found', chain.erc20Currencies.length, 'tokens in erc20Currencies')
        const tokens = chain.erc20Currencies.map(token => ({
          symbol: token.symbol || token.name || token.code || 'UNKNOWN',
          address: token.address || token.contractAddress || token.contract || '',
          decimals: token.decimals || token.decimal || 18,
          name: token.name || token.symbol || token.code,
          isNative: false,
        }))
        
        // Add native token
        const nativeSymbol = chain.symbol || chain.nativeCurrency?.symbol || chain.native_currency?.symbol
        if (nativeSymbol) {
          tokens.unshift({
            symbol: nativeSymbol,
            address: '0x0000000000000000000000000000000000000000',
            decimals: chain.decimals || chain.nativeCurrency?.decimals || 18,
            name: nativeSymbol,
            isNative: true,
          })
        }
        
        return tokens
      }
      
      // Check currency field (single native currency)
      if (chain.currency) {
        console.log('[Relay] Found currency field')
        const tokens = [{
          symbol: chain.currency.symbol || chain.currency.code || chain.symbol,
          address: '0x0000000000000000000000000000000000000000',
          decimals: chain.currency.decimals || chain.decimals || 18,
          name: chain.currency.name || chain.currency.symbol,
          isNative: true,
        }]
        
        // Add erc20Currencies if available
        if (chain.erc20Currencies && Array.isArray(chain.erc20Currencies)) {
          chain.erc20Currencies.forEach(token => {
            tokens.push({
              symbol: token.symbol || token.code || 'UNKNOWN',
              address: token.address || token.contract || '',
              decimals: token.decimals || token.decimal || 18,
              name: token.name || token.symbol || token.code,
              isNative: false,
            })
          })
        }
        
        return tokens
      }
    }
    
    // Try POST /currencies endpoint (this is the documented way)
    console.log('[Relay] Trying POST /currencies endpoint')
    let response = await fetch(`https://api.relay.link/currencies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chainId: chainId.toString(),
      }),
    })
    
    if (!response.ok) {
      // Try GET /chains/{chainId}/tokens as alternative
      console.log('[Relay] POST /currencies failed, trying GET /chains/{chainId}/tokens')
      response = await fetch(`https://api.relay.link/chains/${chainId}/tokens`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`[Relay] Failed to fetch tokens: ${response.status} - ${errorText}`)
      throw new Error(`Failed to fetch tokens: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    console.log('[Relay] Token response:', JSON.stringify(data).substring(0, 500))
    
    // Handle different response formats
    let tokens = []
    if (Array.isArray(data)) {
      tokens = data
    } else if (data.currencies && Array.isArray(data.currencies)) {
      tokens = data.currencies
    } else if (data.tokens && Array.isArray(data.tokens)) {
      tokens = data.tokens
    } else if (data.data && Array.isArray(data.data)) {
      tokens = data.data
    } else if (data.result && Array.isArray(data.result)) {
      tokens = data.result
    }
    
    console.log('[Relay] Found', tokens.length, 'tokens for chain', chainId)
    
    if (tokens.length === 0) {
      console.error('[Relay] No tokens found in API response. Full response:', JSON.stringify(data))
      throw new Error(`No tokens found for chain ${chainId}`)
    }
    
    // Ensure tokens have required fields
    tokens = tokens.map(token => ({
      symbol: token.symbol || token.name || token.code || 'UNKNOWN',
      address: token.address || token.contractAddress || token.tokenAddress || token.contract || (token.isNative ? '0x0000000000000000000000000000000000000000' : ''),
      decimals: token.decimals || token.decimal || 18,
      name: token.name || token.symbol || token.code,
      isNative: token.isNative || token.native || token.address === '0x0000000000000000000000000000000000000000' || !token.address,
    }))
    
    return tokens
  } catch (error) {
    console.error('[Relay SDK] Error getting tokens:', error)
    throw error // Don't return fallback, throw error so frontend knows it failed
  }
}

/**
 * Initialize on module load
 */
initializeRelayClient().catch(err => {
  console.error('[Relay SDK] Failed to initialize on load:', err)
})
