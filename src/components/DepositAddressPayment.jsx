import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, CheckCircle2, ArrowRight, Loader2, Copy, ExternalLink, ArrowUpDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import QRCode from 'qrcode.react'
import { ordersAPI } from '../services/api'
import { CHAINS } from '../services/blockchain'

const DepositAddressPayment = ({ request }) => {
  const navigate = useNavigate()
  // Buyer/sender chooses what to pay with
  const [fromChain, setFromChain] = useState('bnb')
  const [fromAsset, setFromAsset] = useState('USDT')
  const [amount, setAmount] = useState('')
  // Seller wants to receive (fixed from payment request)
  const [requiredAmount] = useState(request.amount || '') // Seller's requested amount
  const [calculatedAmount, setCalculatedAmount] = useState('') // How much buyer needs to send
  const [estimatedReceive, setEstimatedReceive] = useState('')
  const [refundAddress, setRefundAddress] = useState('')
  const [showRefund, setShowRefund] = useState(false)
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [order, setOrder] = useState(null)
  const debounceTimer = useRef(null)

  const availableChains = [
    { value: 'ethereum', label: 'Ethereum', assets: ['ETH', 'USDT', 'USDC'] },
    { value: 'bnb', label: 'BNB Chain', assets: ['BNB', 'USDT', 'BUSD'] },
    { value: 'polygon', label: 'Polygon', assets: ['MATIC', 'USDT', 'USDC'] },
    { value: 'solana', label: 'Solana', assets: ['SOL', 'USDC'] },
  ]

  const currentChainConfig = availableChains.find(c => c.value === fromChain)

  // Auto-calculate send amount based on payment request amount
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    const calculateRate = async () => {
      // Always use reverse calculation: payment request has fixed amount, calculate how much to send
      if (requiredAmount && parseFloat(requiredAmount) > 0 && fromChain && fromAsset) {
        setCalculating(true)
        try {
          const rateData = await ordersAPI.getExchangeRate({
            fromChain,
            fromAsset,
            toChain: request.chain,
            toAsset: request.currency,
            amount: parseFloat(requiredAmount),
            direction: 'reverse'
          })
          const fromAmount = rateData.fromAmount && typeof rateData.fromAmount === 'number' ? rateData.fromAmount.toFixed(6) : (rateData.fromAmount?.toString() || '')
          setCalculatedAmount(fromAmount)
          setAmount(fromAmount)
        } catch (error) {
          console.error('Error calculating rate:', error)
          setCalculatedAmount('')
          setAmount('')
          const errorMsg = error.response?.data?.error || error.message || 'Failed to calculate required amount'
          // Only show toast if it's a meaningful error (not just API key missing)
          if (errorMsg.includes('API key')) {
            toast.error('SimpleSwap API key is not configured. Please contact support.')
          } else if (errorMsg.includes('pair not available') || errorMsg.includes('not supported')) {
            // Show user-friendly message for unsupported pairs
            toast.error(`This swap pair (${fromAsset} on ${fromChain} → ${request.currency} on ${request.chain}) may not be available. Try a different payment method or contact support.`, {
              duration: 6000
            })
          } else if (!errorMsg.includes('API key')) {
            // Only show non-API-key errors to avoid spam
            console.warn('Rate calculation failed:', errorMsg)
          }
        } finally {
          setCalculating(false)
        }
      }
    }

    debounceTimer.current = setTimeout(calculateRate, 500)
    
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [requiredAmount, fromChain, fromAsset, request.chain, request.currency, request])

  const handleGenerateDepositAddress = async () => {
    // Use calculated amount (from reverse calculation based on payment request amount)
    const sendAmount = calculatedAmount || amount
    
    if (!sendAmount || parseFloat(sendAmount) <= 0) {
      toast.error('Please wait for the amount calculation to complete')
      return
    }

    setLoading(true)
    try {
      const orderData = await ordersAPI.create({
        requestId: request.id,
        fromChain,
        fromAsset,
        amount: parseFloat(sendAmount),
        refundAddress: refundAddress || null
      })

      setOrder(orderData)
      toast.success('Deposit address generated!')
      
      // Navigate to status page
      setTimeout(() => {
        navigate(`/status/${orderData.id}`)
      }, 1500)
    } catch (error) {
      console.error('Error creating order:', error)
      // Extract error message from response
      const errorMessage = error.response?.data?.error || error.message || 'Failed to generate deposit address. Please try again.'
      
      // Show specific error message
      if (errorMessage.includes('API key')) {
        toast.error('SimpleSwap API key is not configured. Please contact the administrator to add SIMPLESWAP_API_KEY to Netlify environment variables.', {
          duration: 6000
        })
      } else {
        toast.error(errorMessage, {
          duration: 5000
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  if (order) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-strong rounded-2xl p-6 bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-green-500/30"
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-xl font-semibold text-green-400 mb-2 tracking-tight">Deposit Address Generated!</h3>
          <p className="text-sm text-white/70 tracking-tight">Send {fromAsset} to the address below</p>
        </div>

        <div className="glass-strong rounded-2xl p-6 flex items-center justify-center mb-6 border border-white/[0.12]">
          <div className="w-64 h-64 bg-white rounded-2xl p-4 flex items-center justify-center shadow-soft-lg">
            <QRCode 
              value={order.depositAddress} 
              size={224}
              level="H"
              includeMargin={false}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-strong rounded-xl p-4 border border-white/[0.12]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/60 tracking-tight">Deposit Address</span>
              <button
                onClick={() => copyToClipboard(order.depositAddress)}
                className="text-primary-400 hover:text-primary-300 flex items-center gap-2 transition-colors p-2 glass-strong rounded-lg border border-primary-500/30 hover:bg-primary-500/10"
              >
                <Copy className="w-4 h-4" />
                <span className="text-xs tracking-tight">Copy</span>
              </button>
            </div>
            <p className="font-mono text-sm break-all text-white/90 tracking-tight">{order.depositAddress}</p>
          </div>

          <div className="glass-strong rounded-xl p-4 border border-white/[0.12]">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-white/60">Sending</span>
              <span className="font-medium">{amount} {fromAsset} on {currentChainConfig?.label}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Receiving</span>
              <span className="font-medium text-primary-400">{request.amount} {request.currency} on {CHAINS[request.chain]?.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/50 mb-4">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span>Auto-swap enabled • Direct to recipient</span>
          </div>

          <button
            onClick={() => navigate(`/status/${order.id}`)}
            className="w-full px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl font-medium text-white hover:from-primary-600 hover:to-primary-700 transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Track Order Status
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="glass-strong rounded-2xl p-6 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center flex-shrink-0">
          <RefreshCw className="w-6 h-6 text-blue-400" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-blue-400 mb-1 tracking-tight text-lg">Instant Cross-Chain Payment</div>
          <p className="text-sm text-white/70 mb-4 tracking-tight">
            Pay with any cryptocurrency! It will automatically exchange to <span className="font-semibold text-white">{request.currency}</span> and send directly to the recipient.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Step 1: Seller wants to receive (Fixed - from payment request) */}
        <div>
          <label className="block text-sm font-medium mb-2 text-white/80 tracking-tight">You get</label>
          <div className="p-4 glass-strong rounded-xl border border-green-500/30 bg-green-500/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-xs text-white/60 mb-1 tracking-tight">Recipient will receive</p>
                <p className="text-2xl font-semibold text-white tracking-tight">
                  {requiredAmount} {request.currency}
                </p>
                <p className="text-xs text-white/50 mt-1 tracking-tight">on {CHAINS[request.chain]?.name || request.chain}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/60 mb-1 tracking-tight">Recipient Address</p>
                <p className="text-xs font-mono text-white/80 break-all max-w-[200px]">
                  {request.recipient?.substring(0, 10)}...{request.recipient?.substring(request.recipient.length - 8)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Floating rate indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <RefreshCw className="w-4 h-4" />
            <span>Floating rate</span>
          </div>
        </div>

        {/* Step 2: Buyer chooses what to send */}
        <div>
          <label className="block text-sm font-medium mb-2 text-white/80 tracking-tight">You send</label>
          <div className="space-y-3">
            {/* Chain and Asset Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/60 mb-1.5 tracking-tight">Chain</label>
                <select
                  value={fromChain}
                  onChange={(e) => {
                    setFromChain(e.target.value)
                    const chain = availableChains.find(c => c.value === e.target.value)
                    // Prefer USDT if available, otherwise first asset
                    const preferredAsset = chain?.assets.find(a => a === 'USDT') || chain?.assets[0] || 'ETH'
                    setFromAsset(preferredAsset)
                    // Clear calculated amounts when chain changes (will auto-recalculate)
                    setAmount('')
                    setCalculatedAmount('')
                  }}
                  className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-blue-500/50 focus:outline-none transition-all bg-white/[0.04] text-white text-sm"
                >
                  {availableChains.map(chain => (
                    <option key={chain.value} value={chain.value} className="bg-black text-white">
                      {chain.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-1.5 tracking-tight">Currency</label>
                <select
                  value={fromAsset}
                  onChange={(e) => setFromAsset(e.target.value)}
                  className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-blue-500/50 focus:outline-none transition-all bg-white/[0.04] text-white text-sm"
                >
                  {currentChainConfig?.assets.map(asset => (
                    <option key={asset} value={asset} className="bg-black text-white">
                      {asset}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Calculated Send Amount */}
            <div>
              <label className="block text-xs text-white/60 mb-1.5 tracking-tight">Amount to send</label>
              <div className="relative">
                <input
                  type="text"
                  value={calculatedAmount || ''}
                  readOnly
                  placeholder={calculating ? "Calculating..." : "0.0"}
                  className="w-full px-4 py-3 glass-strong rounded-xl border border-blue-500/30 focus:border-blue-500/50 focus:outline-none transition-all bg-blue-500/10 text-white placeholder:text-white/30 text-lg font-semibold"
                />
                {calculating && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                  </div>
                )}
              </div>
              {calculating && (
                <p className="text-xs text-blue-400 mt-2 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Calculating how much {fromAsset} you need to send...
                </p>
              )}
              {calculatedAmount && !calculating && (
                <p className="text-xs text-white/60 mt-2 tracking-tight">
                  This will automatically exchange to <span className="font-semibold text-white">{requiredAmount} {request.currency}</span> and send to recipient
                </p>
              )}
            </div>
          </div>
        </div>

        {showRefund && (
          <div>
            <label className="block text-sm font-medium mb-2 text-white/80 tracking-tight">
              Refund Address (Optional)
            </label>
            <input
              type="text"
              value={refundAddress}
              onChange={(e) => setRefundAddress(e.target.value)}
              placeholder={fromChain === 'solana' ? 'Your refund address...' : '0x...'}
              className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-blue-500/50 focus:outline-none transition-all bg-white/[0.04] text-white placeholder:text-white/30 font-mono text-sm"
            />
            <p className="text-xs text-white/50 mt-2 tracking-tight">
              Address to refund if swap fails
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setShowRefund(!showRefund)}
            className="px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-white/20 text-white/70 hover:text-white transition-all text-sm"
          >
            {showRefund ? 'Hide' : 'Add'} Refund Address
          </button>
        </div>

        <button
          onClick={handleGenerateDepositAddress}
          disabled={loading || calculating || !calculatedAmount || parseFloat(calculatedAmount) <= 0}
          className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl font-medium text-white hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              Generate Deposit Address
            </>
          )}
        </button>

        <div className="flex items-center gap-2 text-xs text-white/50">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span>Instant exchange • Direct to recipient • No extra steps</span>
        </div>
      </div>
    </div>
  )
}

export default DepositAddressPayment

