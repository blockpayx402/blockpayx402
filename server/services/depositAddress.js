/**
 * BlockPay Deposit Address Generation Service
 * Deposit address generation service
 * Supports Relay Link for cross-chain swaps - fully dynamic, no hardcoded pairs
 */

import { createRelayTransaction, getRelayStatus, getAllRelayChains, getAllRelayTokens } from './relay.js'
import { calculatePlatformFee, BLOCKPAY_CONFIG } from '../config.js'

/**
 * Generate a direct swap transaction for same-chain swaps
 * Returns transaction data that user can sign and execute directly (like Relay)
 */
const generateDirectSwap = async (orderData) => {
  const {
    fromChain,
    fromAsset,
    toChain,
    toAsset,
    amount,
    recipientAddress,
    orderId,
  } = orderData

  try {
    console.log('[Direct Swap] Generating direct swap for same-chain:', { fromChain, fromAsset, toAsset, amount })
    
    // Get token addresses from Relay
    const chains = await getAllRelayChains()
    const chain = chains.find(c => {
      const cId = c.chainId || c.id || c.chain_id
      const cName = (c.name || c.displayName || '').toLowerCase()
      return cId?.toString() === fromChain.toString() || 
             cName === fromChain.toLowerCase() ||
             c.symbol?.toLowerCase() === fromChain.toLowerCase()
    })
    
    if (!chain) {
      throw new Error(`Chain not found: ${fromChain}`)
    }
    
    const chainId = chain.chainId || chain.id || chain.chain_id
    const tokens = await getAllRelayTokens(chainId)
    const fromToken = tokens.find(t => t.symbol?.toUpperCase() === fromAsset.toUpperCase())
    const toToken = tokens.find(t => t.symbol?.toUpperCase() === toAsset.toUpperCase())
    
    if (!fromToken || !toToken) {
      throw new Error(`Token not found: ${fromAsset} or ${toAsset} on ${fromChain}`)
    }

    // Convert amount to smallest unit
    const decimals = fromToken.decimals || 18
    const amountInSmallestUnit = Math.floor(parseFloat(amount) * Math.pow(10, decimals)).toString()

    console.log('[Direct Swap] Token addresses:', {
      fromToken: fromToken.address,
      toToken: toToken.address,
      amount: amountInSmallestUnit
    })

    // Try Relay SDK first for same-chain swaps
    // Relay SDK might support same-chain swaps through direct execution
    try {
      console.log('[Direct Swap] Trying Relay SDK for same-chain swap...')
      const quote = await createRelayTransaction({
        ...orderData,
      })
      
      // If Relay returns a quote with deposit address, it supports this swap
      if (quote && quote.depositAddress) {
        console.log('[Direct Swap] Relay SDK supports this same-chain swap via deposit address')
        return {
          ...quote,
          isDirectSwap: false, // Uses deposit address
          swapType: 'relay-same-chain',
        }
      }
      
      // If quote exists but no deposit address, it might be a direct execution quote
      if (quote && quote.quote) {
        console.log('[Direct Swap] Relay SDK returned quote for direct execution')
        return {
          ...quote,
          isDirectSwap: true,
          swapType: 'relay-direct',
          transactionData: quote.quote, // Store full quote for execution
        }
      }
    } catch (relayError) {
      console.log('[Direct Swap] Relay SDK error:', relayError.message)
      // Continue to fallback
    }

    // Fallback: Return transaction data for manual execution
    // User will need to execute the swap through their wallet using a DEX
    const toDecimals = toToken.decimals || 18
    
    return {
      exchangeId: orderId,
      depositAddress: null, // No deposit address for direct swaps
      estimatedAmount: parseFloat(amount), // 1:1 estimate as fallback
      amountAfterFee: amount,
      exchangeRate: 1,
      validUntil: null,
      isDirectSwap: true,
      swapType: 'manual-dex',
      fromTokenAddress: fromToken.address,
      toTokenAddress: toToken.address,
      fromTokenDecimals: decimals,
      toTokenDecimals: toDecimals,
      amountInSmallestUnit: amountInSmallestUnit,
      chainId: chainId,
      message: 'Please execute this swap through a DEX like Uniswap, PancakeSwap, or 1inch. Same-chain swaps are not supported via deposit addresses.',
    }
  } catch (error) {
    console.error('[Direct Swap] Error:', error)
    throw new Error(`Failed to generate direct swap: ${error.message}`)
  }
}

/**
 * Generate a deposit address for cross-chain swap
 * This creates a temporary address via Relay Link that will receive funds, swap, and forward
 */
export const generateDepositAddress = async (orderData) => {
  const {
    fromChain,
    fromAsset,
    toChain,
    toAsset,
    amount,
    recipientAddress,
    refundAddress,
    orderId, // BlockPay order ID
    userAddress, // User's wallet address (optional)
  } = orderData

  try {
    // Only block if it's the EXACT same currency on the same chain
    // Allow same-chain swaps for different currencies (e.g., USDT -> BNB on BSC)
    if (fromChain === toChain && fromAsset.toUpperCase() === toAsset.toUpperCase()) {
      throw new Error(`Cannot create exchange for the same currency on the same chain: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please use direct payment instead.`)
    }
    
    // For same-chain swaps, use direct DEX swap instead of deposit address
    // This allows users to execute swaps directly on-chain like Relay does
    if (fromChain === toChain && fromAsset.toUpperCase() !== toAsset.toUpperCase()) {
      // Same chain, different tokens - use direct swap
      return await generateDirectSwap(orderData)
    }
    
    // Pure Relay wrapper - no custom fee calculation or order management
    // Relay handles everything: fees, execution, status tracking
    
    // Pass through to Relay SDK directly - no wrapper logic
    let exchangeData = null
    
    try {
      exchangeData = await createRelayTransaction({
        fromChain,
        fromAsset,
        toChain,
        toAsset,
        amount: amount, // Use full amount - Relay handles fees internally
        recipientAddress,
        refundAddress,
        orderId,
        userAddress: userAddress || recipientAddress,
      })
    } catch (err) {
      const msg = String(err?.message || '')
      
      // Provide helpful error messages
      if (msg.includes('not found') || msg.includes('not supported')) {
        throw new Error(`Relay Link does not support this pair: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try a different currency pair.`)
      } else if (msg.includes('Could not execute')) {
        throw new Error(`Relay Link cannot execute this swap: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). This pair may not be available.`)
      } else if (msg.includes('Invalid address')) {
        throw new Error(`Invalid address format for ${toChain}. Please check your recipient address.`)
      }
      
      throw err
    }

    if (!exchangeData) {
      throw new Error(`Failed to generate deposit address for ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try again.`)
    }

    return {
      depositAddress: exchangeData.depositAddress,
      orderId: orderId,
      exchangeId: exchangeData.exchangeId,
      estimatedAmount: exchangeData.estimatedAmount,
      exchangeRate: exchangeData.exchangeRate,
      validUntil: exchangeData.validUntil,
      platformFee: safeFee,
      amountAfterFee,
    }
  } catch (error) {
    console.error('Error generating deposit address:', error)
    
    // Provide helpful error messages
    if (error.message.includes('not found') || error.message.includes('not supported')) {
      throw new Error(`Relay Link does not support this pair: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try a different currency pair.`)
    } else if (error.message.includes('Could not execute')) {
      throw new Error(`Relay Link cannot execute this swap: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). This pair may not be available.`)
    } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('fetch') || error.message.includes('timeout')) {
      throw new Error('Cannot connect to Relay Link API. Please check your internet connection and try again.')
    }
    
    throw new Error(`Failed to generate deposit address: ${error.message}`)
  }
}

/**
 * Check deposit status via Relay Link API
 * This checks the actual status of the exchange transaction
 */
export const checkDepositStatus = async (exchangeId) => {
  try {
    const status = await getRelayStatus(exchangeId)
    return {
      received: status.status !== 'awaiting_deposit' && status.status !== 'pending',
      amount: status.amount || null,
      txHash: status.txHash || status.originTxHash || null,
      swapTxHash: status.destinationTxHash || status.txHash || null,
      status: status.status || 'awaiting_deposit',
      toAmount: status.destinationAmount || status.amount || null,
      exchangeRate: null,
    }
  } catch (error) {
    console.error('Error checking deposit status:', error)
    return {
      received: false,
      amount: null,
      txHash: null,
      status: 'awaiting_deposit',
    }
  }
}

/**
 * Get exchange status by exchange ID
 */
export const getExchangeStatusById = async (exchangeId) => {
  try {
    return await getRelayStatus(exchangeId)
  } catch (error) {
    console.error('Error getting exchange status:', error)
    throw error
  }
}

// Export functions - Fixed: removed undefined executeSwap
export default {
  generateDepositAddress,
  checkDepositStatus,
  getExchangeStatusById
}

