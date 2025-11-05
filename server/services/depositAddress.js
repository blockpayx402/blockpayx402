/**
 * BlockPay Deposit Address Generation Service
 * Production-ready integration with ChangeNOW for cross-chain swaps
 */

import { createExchangeTransaction, getExchangeStatus } from './changenow.js'
import { calculatePlatformFee } from '../config.js'

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
    orderId // BlockPay order ID
  } = orderData

  try {
    // Calculate BlockPay platform fee
    const fee = calculatePlatformFee(amount, fromAsset)
    
    // Adjust amount to account for platform fee
    // The fee will be deducted from the final amount received by the seller
    const amountAfterFee = amount - fee.amount

    // Create exchange transaction via ChangeNOW API
    const exchangeData = await createExchangeTransaction({
      fromChain,
      fromAsset,
      toChain,
      toAsset,
      amount: amountAfterFee, // Amount after BlockPay fee
      recipientAddress,
      refundAddress,
      orderId,
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
    return await getExchangeStatus(exchangeId)
  } catch (error) {
    console.error('Error getting exchange status:', error)
    throw error
  }
}

export default {
  generateDepositAddress,
  checkDepositStatus,
  executeSwap
}

