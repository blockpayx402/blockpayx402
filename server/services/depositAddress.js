/**
 * BlockPay Deposit Address Generation Service
 * Deposit address generation service
 * Supports ChangeNOW for cross-chain swaps
 */

import { createExchangeTransaction, getExchangeStatus } from './changenow.js'
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
    // Calculate BlockPay platform fee (with chain-specific recipient)
    const fee = calculatePlatformFee(amount, fromAsset, fromChain)
    
    // Adjust amount to account for platform fee
    // The fee will be deducted from the final amount received by the seller
    const amountAfterFee = amount - fee.amount

    // Try with small amount adjustments if provider is temporarily unavailable
    const attemptAmounts = [
      amountAfterFee,
      Math.max(0, Number((amountAfterFee * 0.995).toFixed(8))), // -0.5%
      Math.max(0, Number((amountAfterFee * 0.99).toFixed(8))),  // -1%
    ]

    let exchangeData = null
    let lastError = null

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
        break
      } catch (err) {
        lastError = err
        const msg = String(err?.message || '')
        // Only retry if provider is temporarily unavailable or 5xx-like errors were bubbled up
        const isTransient = msg.includes('temporarily unavailable') || msg.includes('unknown_error')
        if (!isTransient) {
          throw err
        }
        // continue to next reduced amount
      }
    }

    if (!exchangeData) {
      throw lastError || new Error('Provider temporarily unavailable. Please try again later.')
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

