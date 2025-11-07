/**
 * x402 Payment Component for Solana
 * Handles x402 protocol payments using Solana wallet
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Wallet, CheckCircle, XCircle, Loader, ExternalLink } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js'

const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'blockpay.cloud' || window.location.hostname.includes('blockpay.cloud')
    ? 'https://blockpay.cloud/api' 
    : 'http://localhost:3001/api')

const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com'

export default function X402Payment({ paymentRequirements, onPaymentComplete, onError }) {
  const [wallet, setWallet] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState(null)
  const [txSignature, setTxSignature] = useState(null)

  // Check for Solana wallet
  useEffect(() => {
    if (typeof window !== 'undefined' && window.solana) {
      setWallet(window.solana)
    } else {
      // Try to detect Phantom or other wallets
      const checkWallet = setInterval(() => {
        if (window.solana) {
          setWallet(window.solana)
          clearInterval(checkWallet)
        }
      }, 1000)

      return () => clearInterval(checkWallet)
    }
  }, [])

  const connectWallet = async () => {
    if (!window.solana) {
      toast.error('Please install Phantom wallet')
      window.open('https://phantom.app/', '_blank')
      return
    }

    setIsConnecting(true)
    try {
      const response = await window.solana.connect()
      setWallet(response)
      toast.success('Wallet connected!')
    } catch (error) {
      console.error('Error connecting wallet:', error)
      toast.error('Failed to connect wallet')
    } finally {
      setIsConnecting(false)
    }
  }

  const createPaymentPayload = (signature) => {
    return {
      x402Version: 1,
      scheme: paymentRequirements.scheme,
      network: paymentRequirements.network,
      payload: {
        signature,
      },
    }
  }

  const sendPayment = async () => {
    if (!wallet || !wallet.publicKey) {
      toast.error('Please connect your wallet first')
      return
    }

    setIsPaying(true)
    setPaymentStatus('preparing')

    try {
      // Create Solana connection
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

      // Parse recipient address
      const recipientPubkey = new PublicKey(paymentRequirements.payTo)
      const amountLamports = BigInt(paymentRequirements.maxAmountRequired)

      // Create transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: recipientPubkey,
          lamports: Number(amountLamports),
        })
      )

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = wallet.publicKey

      setPaymentStatus('signing')
      
      // Sign and send transaction
      const signedTx = await wallet.signTransaction(transaction)
      const signature = await connection.sendRawTransaction(signedTx.serialize())
      
      setTxSignature(signature)
      setPaymentStatus('confirming')

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed')

      setPaymentStatus('verifying')

      // Create payment payload
      const paymentPayload = createPaymentPayload(signature)
      const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64')

      // Verify payment with facilitator
      const verifyResponse = await fetch(`${API_BASE_URL}/x402/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          x402Version: 1,
          paymentHeader,
          paymentRequirements,
        }),
      })

      const verification = await verifyResponse.json()

      if (!verification.isValid) {
        throw new Error(verification.invalidReason || 'Payment verification failed')
      }

      // Settle payment
      const settleResponse = await fetch(`${API_BASE_URL}/x402/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          x402Version: 1,
          paymentHeader,
          paymentRequirements,
        }),
      })

      const settlement = await settleResponse.json()

      if (!settlement.success) {
        throw new Error(settlement.error || 'Payment settlement failed')
      }

      setPaymentStatus('completed')
      toast.success('Payment completed successfully!')
      
      if (onPaymentComplete) {
        onPaymentComplete({
          signature,
          settlement,
        })
      }
    } catch (error) {
      console.error('Payment error:', error)
      setPaymentStatus('error')
      toast.error(error.message || 'Payment failed')
      
      if (onError) {
        onError(error)
      }
    } finally {
      setIsPaying(false)
    }
  }

  const amount = parseFloat(paymentRequirements.maxAmountRequired) / 1e9
  const isNative = !paymentRequirements.asset || 
                   paymentRequirements.asset === 'native' || 
                   paymentRequirements.asset === 'So11111111111111111111111111111111111111112'

  return (
    <div className="glass rounded-2xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <Wallet className="w-5 h-5 text-primary-400" />
        <h3 className="text-xl font-semibold">x402 Payment Required</h3>
      </div>

      <div className="space-y-4">
        <div className="p-4 glass-strong rounded-xl border border-white/5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white/60">Amount</span>
            <span className="text-lg font-semibold">{amount} {isNative ? 'SOL' : 'Token'}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-white/60">Recipient</span>
            <span className="font-mono text-white/80">{paymentRequirements.payTo.slice(0, 8)}...{paymentRequirements.payTo.slice(-8)}</span>
          </div>
          {paymentRequirements.description && (
            <div className="mt-2 text-sm text-white/60">{paymentRequirements.description}</div>
          )}
        </div>

        {!wallet || !wallet.publicKey ? (
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isConnecting ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="w-5 h-5" />
                Connect Wallet
              </>
            )}
          </button>
        ) : (
          <>
            <div className="p-3 glass-strong rounded-xl border border-white/5 text-sm">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span>Connected: {wallet.publicKey.toString().slice(0, 8)}...{wallet.publicKey.toString().slice(-8)}</span>
              </div>
            </div>

            <button
              onClick={sendPayment}
              disabled={isPaying}
              className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPaying ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  {paymentStatus === 'preparing' && 'Preparing...'}
                  {paymentStatus === 'signing' && 'Signing...'}
                  {paymentStatus === 'confirming' && 'Confirming...'}
                  {paymentStatus === 'verifying' && 'Verifying...'}
                </>
              ) : (
                'Pay with Solana'
              )}
            </button>

            {paymentStatus === 'completed' && txSignature && (
              <div className="p-4 glass-strong rounded-xl border border-green-500/20 bg-green-500/5">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Payment Successful!</span>
                </div>
                <a
                  href={`https://solscan.io/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300"
                >
                  View on Solscan
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}

            {paymentStatus === 'error' && (
              <div className="p-4 glass-strong rounded-xl border border-red-500/20 bg-red-500/5">
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="w-5 h-5" />
                  <span className="font-semibold">Payment Failed</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

