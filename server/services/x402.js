/**
 * x402 Payment Protocol Facilitator for Solana
 * Implements the x402 payment protocol for Solana payments
 */

import { Connection, PublicKey } from '@solana/web3.js'

// x402 Protocol Version
const X402_VERSION = 1

// Supported Solana RPC endpoints
const SOLANA_RPC_URLS = [
  process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana',
]

/**
 * Get Solana connection
 */
function getSolanaConnection() {
  const rpcUrl = SOLANA_RPC_URLS[0]
  return new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransaction: 5,
  })
}

/**
 * Verify a payment payload for Solana
 * @param {Object} paymentPayload - The decoded X-PAYMENT header payload
 * @param {Object} paymentRequirements - The payment requirements from the 402 response
 * @returns {Object} Verification response
 */
export async function verifyPayment(paymentPayload, paymentRequirements) {
  try {
    // Validate x402 version
    if (paymentPayload.x402Version !== X402_VERSION) {
      return {
        isValid: false,
        invalidReason: `Unsupported x402 version. Expected ${X402_VERSION}, got ${paymentPayload.x402Version}`,
      }
    }

    // Validate scheme
    if (paymentPayload.scheme !== 'exact') {
      return {
        isValid: false,
        invalidReason: `Unsupported scheme: ${paymentPayload.scheme}. Only 'exact' is supported.`,
      }
    }

    // Validate network
    if (paymentPayload.network !== 'solana-mainnet' && paymentPayload.network !== 'solana') {
      return {
        isValid: false,
        invalidReason: `Unsupported network: ${paymentPayload.network}. Only 'solana-mainnet' or 'solana' is supported.`,
      }
    }

    // Validate payment requirements match
    if (paymentRequirements.scheme !== paymentPayload.scheme) {
      return {
        isValid: false,
        invalidReason: `Scheme mismatch. Expected ${paymentRequirements.scheme}, got ${paymentPayload.scheme}`,
      }
    }

    if (paymentRequirements.network !== paymentPayload.network && 
        paymentRequirements.network !== 'solana' && 
        paymentPayload.network !== 'solana-mainnet') {
      return {
        isValid: false,
        invalidReason: `Network mismatch. Expected ${paymentRequirements.network}, got ${paymentPayload.network}`,
      }
    }

    // For 'exact' scheme on Solana, the payload should contain transaction signature
    if (!paymentPayload.payload || !paymentPayload.payload.signature) {
      return {
        isValid: false,
        invalidReason: 'Missing transaction signature in payload',
      }
    }

    const signature = paymentPayload.payload.signature
    const connection = getSolanaConnection()

    // Verify transaction exists and is confirmed
    try {
      const tx = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      })

      if (!tx) {
        return {
          isValid: false,
          invalidReason: 'Transaction not found',
        }
      }

      if (tx.meta?.err) {
        return {
          isValid: false,
          invalidReason: `Transaction failed: ${JSON.stringify(tx.meta.err)}`,
        }
      }

      // Verify recipient address matches
      const recipientPubkey = new PublicKey(paymentRequirements.payTo)
      const accountIndex = tx.transaction.message.accountKeys.findIndex(
        (key) => key.equals(recipientPubkey)
      )

      if (accountIndex === -1) {
        return {
          isValid: false,
          invalidReason: 'Recipient address not found in transaction',
        }
      }

      // Verify amount matches (for native SOL)
      let receivedAmount = 0
      if (!paymentRequirements.asset || paymentRequirements.asset === 'native' || paymentRequirements.asset === 'So11111111111111111111111111111111111111112') {
        const preBalance = tx.meta.preBalances?.[accountIndex] || 0
        const postBalance = tx.meta.postBalances?.[accountIndex] || 0
        receivedAmount = (postBalance - preBalance) / 1e9 // Convert lamports to SOL

        const requiredAmount = parseFloat(paymentRequirements.maxAmountRequired) / 1e9 // Convert from atomic units
        const tolerance = 0.0001 // Allow small tolerance for fees

        if (receivedAmount < requiredAmount - tolerance) {
          return {
            isValid: false,
            invalidReason: `Insufficient amount. Required: ${requiredAmount} SOL, Received: ${receivedAmount} SOL`,
          }
        }
      }

      // Verify transaction is recent (within last hour)
      const txTime = tx.blockTime ? tx.blockTime * 1000 : Date.now()
      const now = Date.now()
      const oneHour = 60 * 60 * 1000

      if (now - txTime > oneHour) {
        return {
          isValid: false,
          invalidReason: 'Transaction is too old (must be within last hour)',
        }
      }

      return {
        isValid: true,
        invalidReason: null,
        transaction: {
          signature,
          amount: receivedAmount,
          timestamp: txTime,
        },
      }
    } catch (txError) {
      console.error('Error verifying transaction:', txError)
      return {
        isValid: false,
        invalidReason: `Failed to verify transaction: ${txError.message}`,
      }
    }
  } catch (error) {
    console.error('Error in verifyPayment:', error)
    return {
      isValid: false,
      invalidReason: error.message || 'Verification failed',
    }
  }
}

/**
 * Settle a payment (for x402, this is mainly verification since payment is already on-chain)
 * @param {Object} paymentPayload - The decoded X-PAYMENT header payload
 * @param {Object} paymentRequirements - The payment requirements from the 402 response
 * @returns {Object} Settlement response
 */
export async function settlePayment(paymentPayload, paymentRequirements) {
  try {
    // First verify the payment
    const verification = await verifyPayment(paymentPayload, paymentRequirements)

    if (!verification.isValid) {
      return {
        success: false,
        error: verification.invalidReason || 'Payment verification failed',
        txHash: null,
        networkId: null,
      }
    }

    // For Solana, the payment is already settled on-chain
    // We just need to confirm it's finalized
    const signature = paymentPayload.payload.signature
    const connection = getSolanaConnection()

    try {
      const status = await connection.getSignatureStatus(signature)
      
      if (status?.value?.confirmationStatus === 'finalized' || status?.value?.confirmationStatus === 'confirmed') {
        return {
          success: true,
          error: null,
          txHash: signature,
          networkId: 'solana-mainnet',
        }
      } else {
        // Wait a bit and check again
        await new Promise((resolve) => setTimeout(resolve, 2000))
        const retryStatus = await connection.getSignatureStatus(signature)
        
        if (retryStatus?.value?.confirmationStatus === 'finalized' || retryStatus?.value?.confirmationStatus === 'confirmed') {
          return {
            success: true,
            error: null,
            txHash: signature,
            networkId: 'solana-mainnet',
          }
        } else {
          return {
            success: false,
            error: 'Transaction not yet confirmed',
            txHash: signature,
            networkId: 'solana-mainnet',
          }
        }
      }
    } catch (statusError) {
      console.error('Error checking transaction status:', statusError)
      // If we can't check status but verification passed, assume success
      return {
        success: true,
        error: null,
        txHash: signature,
        networkId: 'solana-mainnet',
      }
    }
  } catch (error) {
    console.error('Error in settlePayment:', error)
    return {
      success: false,
      error: error.message || 'Settlement failed',
      txHash: null,
      networkId: null,
    }
  }
}

/**
 * Get supported payment schemes and networks
 */
export function getSupportedSchemes() {
  return {
    kinds: [
      {
        scheme: 'exact',
        network: 'solana-mainnet',
      },
      {
        scheme: 'exact',
        network: 'solana',
      },
    ],
  }
}

/**
 * Create payment requirements object for a Solana payment
 * @param {Object} params - Payment parameters
 * @returns {Object} Payment requirements
 */
export function createPaymentRequirements({
  amount,
  recipient,
  resource,
  description,
  mimeType = 'application/json',
  maxTimeoutSeconds = 300,
  asset = 'native', // 'native' for SOL or SPL token mint address
}) {
  // Convert amount to atomic units (lamports for SOL)
  const atomicAmount = Math.floor(parseFloat(amount) * 1e9).toString()

  return {
    scheme: 'exact',
    network: 'solana-mainnet',
    maxAmountRequired: atomicAmount,
    resource: resource || '',
    description: description || 'Payment required',
    mimeType,
    outputSchema: null,
    payTo: recipient,
    maxTimeoutSeconds,
    asset: asset === 'native' ? 'So11111111111111111111111111111111111111112' : asset,
    extra: {
      name: asset === 'native' ? 'Solana' : 'SPL Token',
      version: '1.0',
    },
  }
}

