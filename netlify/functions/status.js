// Netlify Function: Order Status
import { dbHelpers } from '../../server/database.js'
import { getExchangeStatusById } from '../../server/services/depositAddress.js'

export const handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }

  try {
    const { orderId } = event.pathParameters || {}
    
    if (!orderId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Order ID required' })
      }
    }

    const order = dbHelpers.getOrderById(orderId)
    
    if (!order) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Order not found' })
      }
    }
    
    // If order has exchange ID, sync status from ChangeNOW
    if (order.exchangeId) {
      try {
        const exchangeStatus = await getExchangeStatusById(order.exchangeId)
        
        // Update order status if changed
        if (exchangeStatus.status !== order.status) {
          dbHelpers.updateOrderStatus(
            order.id,
            exchangeStatus.status,
            exchangeStatus.depositTxHash,
            exchangeStatus.swapTxHash,
            order.exchangeId
          )
          
          // Refresh order data
          const updatedOrder = dbHelpers.getOrderById(order.id)
          order.status = updatedOrder.status
          order.depositTxHash = updatedOrder.depositTxHash
          order.swapTxHash = updatedOrder.swapTxHash
        }
      } catch (error) {
        console.error('Error syncing status from ChangeNOW:', error)
        // Continue with cached status if sync fails
      }
    }
    
    // Get payment request details
    const request = dbHelpers.getRequestById(order.requestId)
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...order,
        request: request ? {
          id: request.id,
          recipient: request.recipient,
          toChain: request.chain,
          toAsset: request.currency,
          description: request.description
        } : null
      })
    }
  } catch (error) {
    console.error('Error fetching order status:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

