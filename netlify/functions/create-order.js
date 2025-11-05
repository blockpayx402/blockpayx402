// Netlify Function: Create Order
import { dbHelpers } from '../../server/database.js'
import { generateDepositAddress } from '../../server/services/depositAddress.js'
import { calculatePlatformFee } from '../../server/config.js'

export const handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const {
      requestId,
      fromChain,
      fromAsset,
      amount,
      refundAddress
    } = JSON.parse(event.body)

    // Get the payment request
    const request = dbHelpers.getRequestById(requestId)
    if (!request) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Payment request not found' })
      }
    }

    // Calculate platform fee
    const fee = calculatePlatformFee(parseFloat(amount), fromAsset)

    // Generate order ID first
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Generate deposit address via ChangeNOW
    const depositInfo = await generateDepositAddress({
      fromChain,
      fromAsset,
      toChain: request.chain,
      toAsset: request.currency,
      amount: parseFloat(amount),
      recipientAddress: request.recipient,
      refundAddress,
      orderId
    })

    // Create order in database
    const order = dbHelpers.createOrder({
      id: orderId,
      requestId: request.id,
      fromChain,
      fromAsset,
      toChain: request.chain,
      toAsset: request.currency,
      amount: amount.toString(),
      depositAddress: depositInfo.depositAddress,
      refundAddress,
      expectedAmount: depositInfo.estimatedAmount?.toString() || request.amount,
      status: 'awaiting_deposit',
      exchangeId: depositInfo.exchangeId,
      platformFeeAmount: fee.amount.toString(),
      platformFeePercent: fee.percent.toString(),
      amountAfterFee: depositInfo.amountAfterFee?.toString() || amount.toString()
    })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...order,
        depositAddress: depositInfo.depositAddress,
        orderId: order.id,
        platformFee: fee,
        estimatedAmount: depositInfo.estimatedAmount,
        exchangeRate: depositInfo.exchangeRate,
        validUntil: depositInfo.validUntil
      })
    }
  } catch (error) {
    console.error('Error creating order:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message || 'Failed to create order. Please check your ChangeNOW API key.' 
      })
    }
  }
}

