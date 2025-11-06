/**
 * BlockPay Deposit Address Generation Service
 * Deposit address generation service
 * Supports ChangeNOW for cross-chain swaps
 */

import { createExchangeTransaction, getExchangeStatus } from './changenow.js'
import { calculatePlatformFee, BLOCKPAY_CONFIG } from '../config.js'

/**
 * Generate a deposit address for cross-chain swap
 * This creates a temporary address via ChangeNOW that will receive funds, swap, and forward
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
    // Skip pair validation - it causes false negatives for valid pairs
    // ChangeNOW will return proper errors if pair is truly invalid

    // Calculate BlockPay platform fee (with chain-specific recipient)
    const fee = calculatePlatformFee(amount, fromAsset, fromChain)
    
    // Adjust amount to account for platform fee
    // The fee will be deducted from the final amount received by the seller
    const amountAfterFee = amount - fee.amount

    // Try with multiple amount adjustments and retries for better reliability
    // ChangeNOW can be sensitive to exact amounts, so we try several variations
    const attemptAmounts = [
      amountAfterFee,
      Math.max(0, Number((amountAfterFee * 0.998).toFixed(8))), // -0.2%
      Math.max(0, Number((amountAfterFee * 0.995).toFixed(8))), // -0.5%
      Math.max(0, Number((amountAfterFee * 0.99).toFixed(8))),  // -1%
      Math.max(0, Number((amountAfterFee * 0.98).toFixed(8))),  // -2%
    ]

    let exchangeData = null
    let lastError = null
    let lastErrorStatus = null

    for (const tryAmount of attemptAmounts) {
      try {
        // Create exchange transaction via ChangeNOW API
        exchangeData = await createExchangeTransaction({
          fromChain,
          fromAsset,
          toChain,
          toAsset,
          amount: tryAmount, // Amount after BlockPay fee (with adjustment)
          recipientAddress,
          refundAddress,
          orderId,
        })
        // Success! Break out of retry loop
        break
      } catch (err) {
        lastError = err
        const msg = String(err?.message || '')
        
        // Extract status code if available
        const statusMatch = msg.match(/error:\s*(\d+)/i) || msg.match(/status\s*(\d+)/i)
        if (statusMatch) {
          lastErrorStatus = parseInt(statusMatch[1])
        }
        
        // Retry on transient errors or 5xx errors
        const isTransient = 
          msg.includes('temporarily unavailable') || 
          msg.includes('unknown_error') ||
          msg.includes('500') ||
          msg.includes('502') ||
          msg.includes('503') ||
          (lastErrorStatus && lastErrorStatus >= 500)
        
        // Also retry on 400 errors that might be amount-related
        const isAmountError = 
          msg.includes('max_amount') ||
          msg.includes('min_amount') ||
          msg.includes('amount') ||
          (lastErrorStatus === 400 && tryAmount !== attemptAmounts[attemptAmounts.length - 1]) // Not the last attempt
        
        // Don't retry on clear pair errors or auth errors
        const isFatal = 
          msg.includes('Invalid pair') ||
          msg.includes('pair not available') ||
          msg.includes('pair_is_inactive') ||
          msg.includes('401') ||
          msg.includes('403') ||
          msg.includes('API key')
        
        if (isFatal) {
          throw err
        }
        
        // Continue to next amount if transient or amount-related
        if (isTransient || isAmountError) {
          console.log(`[DepositAddress] Retrying with adjusted amount: ${tryAmount} (was ${amountAfterFee})`)
          continue
        }
        
        // For other errors, throw immediately
        throw err
      }
    }

    if (!exchangeData) {
      // Provide helpful error message
      if (lastErrorStatus === 400) {
        throw new Error(`Invalid request for ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try a different amount or currency pair.`)
      } else if (lastErrorStatus && lastErrorStatus >= 500) {
        throw new Error(`ChangeNOW is temporarily unavailable for ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try again in a few moments.`)
      }
      throw lastError || new Error(`Failed to generate deposit address for ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try again.`)
    }

    return {
      depositAddress: exchangeData.depositAddress,
      orderId: orderId,
      exchangeId: exchangeData.exchangeId,
      estimatedAmount: exchangeData.estimatedAmount,
      exchangeRate: exchangeData.exchangeRate,
      validUntil: exchangeData.validUntil,
      platformFee: fee,
      amountAfterFee,
    }
  } catch (error) {
    console.error('Error generating deposit address:', error)
    
    // Provide helpful error messages
    if (error.message.includes('API key') || error.message.includes('Unauthorized') || error.message.includes('401')) {
      throw new Error('Invalid ChangeNOW API key. Please check your server configuration. Set CHANGENOW_API_KEY in environment variables.')
    } else if (error.message.includes('inactive') || error.message.includes('not available') || error.message.includes('404')) {
      throw new Error(`Exchange pair not available: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try a different currency pair.`)
    } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('fetch')) {
      throw new Error('Cannot connect to ChangeNOW API. Please check your internet connection and try again.')
    }
    
    throw new Error(`Failed to generate deposit address: ${error.message}`)
  }
}

/**
 * Check deposit status via ChangeNOW API
 * This checks the actual status of the exchange transaction
 */
export const checkDepositStatus = async (exchangeId) => {
  try {
    const status = await getExchangeStatus(exchangeId)
    return {
      received: status.status !== 'waiting' && status.payinHash,
      amount: status.amount || null,
      txHash: status.payinHash || null,
      swapTxHash: status.payoutHash || null,
      status: status.status || 'awaiting_deposit',
      toAmount: status.payoutAmount || null,
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
    return await getExchangeStatus(exchangeId)
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

