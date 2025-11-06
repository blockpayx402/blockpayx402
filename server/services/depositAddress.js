/**
 * BlockPay Deposit Address Generation Service
 * Production-ready integration with Relay Link for cross-chain swaps
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
    // Calculate BlockPay platform fee (with chain-specific recipient)
    const fee = calculatePlatformFee(amount, fromAsset, fromChain)
    
    // Adjust amount to account for platform fee
    // The fee will be deducted from the final amount received by the seller
    const amountAfterFee = amount - fee.amount

    // Create exchange transaction via Relay Link API
    const exchangeData = await createRelayTransaction({
      fromChain,
      fromAsset,
      toChain,
      toAsset,
      amount: amountAfterFee, // Amount after BlockPay fee
      recipientAddress,
      refundAddress,
      orderId,
      userAddress,
    })

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
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      throw new Error('Invalid Relay Link API request. Please check your configuration.')
    } else if (error.message.includes('404') || error.message.includes('not found') || error.message.includes('not available')) {
      throw new Error(`Exchange pair not available: ${fromAsset}(${fromChain}) -> ${toAsset}(${toChain}). Please try a different currency pair.`)
    } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
      throw new Error('Cannot connect to Relay Link API. Please check your internet connection and try again.')
    } else if (error.message.includes('Unsupported chain')) {
      throw new Error(`Unsupported blockchain: ${fromChain} or ${toChain}. Please use supported chains (Ethereum, BNB Chain, Polygon, Solana).`)
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
      received: status.status !== 'awaiting_deposit',
      amount: status.fromAmount,
      txHash: status.depositTxHash,
      swapTxHash: status.swapTxHash,
      status: status.status,
      toAmount: status.toAmount,
      exchangeRate: status.exchangeRate,
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

