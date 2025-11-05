/**
 * BlockPay Deposit Address Generation Service
 * Production-ready integration with ChangeNOW for cross-chain swaps
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
    orderId // BlockPay order ID
  } = orderData

  // Check if ChangeNOW API is configured
  if (!BLOCKPAY_CONFIG.changenow.apiKey || BLOCKPAY_CONFIG.changenow.apiKey === '') {
    throw new Error('ChangeNOW API key is not configured. Please set CHANGENOW_API_KEY in your .env file. Get your key from: https://changenow.io/api')
  }

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
    
    // Provide helpful error messages
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      throw new Error('Invalid ChangeNOW API key. Please check your CHANGENOW_API_KEY in .env file.')
    } else if (error.message.includes('404') || error.message.includes('not found')) {
      throw new Error('Exchange pair not available. Please check if the currency pair is supported by ChangeNOW.')
    } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
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
  getExchangeStatusById
}

