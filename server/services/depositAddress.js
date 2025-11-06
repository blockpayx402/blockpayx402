/**
 * BlockPay Deposit Address Generation Service
 * Deposit address generation service
 * Supports Relay Link for cross-chain swaps - fully dynamic, no hardcoded pairs
 */

import { createRelayTransaction, getRelayStatus } from './relay.js'
import { calculatePlatformFee, BLOCKPAY_CONFIG } from '../config.js'

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
    // Relay Link dynamically supports all chains and tokens it supports
    // No need for pair validation - Relay will return proper errors if pair is invalid

    // Calculate BlockPay platform fee (with chain-specific recipient)
    const fee = calculatePlatformFee(amount, fromAsset, fromChain)
    
    // Ensure fee doesn't exceed amount (safety check)
    const safeFeeAmount = Math.min(fee.amount, amount * 0.99)
    const safeFee = { ...fee, amount: safeFeeAmount }
    
    // Adjust amount to account for platform fee
    // The fee will be deducted from the final amount received by the seller
    let amountAfterFee = amount - safeFeeAmount
    
    // Ensure amount after fee is positive (at least 1% of original amount)
    if (amountAfterFee <= 0) {
      // If fee would make amount negative, use a percentage-based fee instead
      const percentageFee = amount * 0.01 // 1% fee
      amountAfterFee = amount - percentageFee
      // Update fee to match
      safeFee.amount = percentageFee
      safeFee.percent = 0.01
    }

    // Create exchange transaction via Relay Link API
    // Relay handles all chains and tokens dynamically - no hardcoded pairs
    let exchangeData = null
    
    try {
      exchangeData = await createRelayTransaction({
        fromChain,
        fromAsset,
        toChain,
        toAsset,
        amount: amountAfterFee, // Amount after BlockPay fee
        recipientAddress,
        refundAddress,
        orderId,
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

