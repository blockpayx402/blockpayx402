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
  const [fromChain, setFromChain] = useState('bnb')
  const [fromAsset, setFromAsset] = useState('USDT')
  const [amount, setAmount] = useState('')
  const [requiredAmount, setRequiredAmount] = useState(request.amount || '')
  const [calculatedAmount, setCalculatedAmount] = useState('')
  const [estimatedReceive, setEstimatedReceive] = useState('')
  const [refundAddress, setRefundAddress] = useState('')
  const [showRefund, setShowRefund] = useState(false)
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [order, setOrder] = useState(null)
  const [inputMode, setInputMode] = useState('send') // 'send' or 'receive'
  const debounceTimer = useRef(null)

  const availableChains = [
    { value: 'ethereum', label: 'Ethereum', assets: ['ETH', 'USDT', 'USDC'] },
    { value: 'bnb', label: 'BNB Chain', assets: ['BNB', 'USDT', 'BUSD'] },
    { value: 'polygon', label: 'Polygon', assets: ['MATIC', 'USDT', 'USDC'] },
    { value: 'solana', label: 'Solana', assets: ['SOL', 'USDC'] },
  ]

  const currentChainConfig = availableChains.find(c => c.value === fromChain)

  // Calculate exchange rate when inputs change
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    const calculateRate = async () => {
      if (inputMode === 'send' && amount && parseFloat(amount) > 0) {
        setCalculating(true)
        try {
          const rateData = await ordersAPI.getExchangeRate({
            fromChain,
            fromAsset,
            toChain: request.chain,
            toAsset: request.currency,
            amount: parseFloat(amount),
            direction: 'forward'
          })
          setEstimatedReceive(rateData.estimatedToAmount?.toFixed(6) || '')
        } catch (error) {
          console.error('Error calculating rate:', error)
          setEstimatedReceive('')
          // Don't show toast for rate calculation errors - they're expected if API key is missing
          // Only show error if it's a user-actionable error
          if (error.message && !error.message.includes('API key')) {
            console.warn('Rate calculation failed:', error.message)
          }
        } finally {
          setCalculating(false)
        }
      } else if (inputMode === 'receive' && requiredAmount && parseFloat(requiredAmount) > 0) {
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
          setCalculatedAmount(rateData.fromAmount?.toFixed(6) || '')
          setAmount(rateData.fromAmount?.toFixed(6) || '')
        } catch (error) {
          console.error('Error calculating rate:', error)
          setCalculatedAmount('')
          const errorMsg = error.response?.data?.error || error.message || 'Failed to calculate required amount'
          // Only show toast if it's a meaningful error (not just API key missing)
          if (errorMsg.includes('API key')) {
            toast.error('ChangeNOW API key is not configured. Please contact support.')
          } else {
            toast.error(errorMsg)
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
  }, [amount, requiredAmount, fromChain, fromAsset, request.chain, request.currency, inputMode, request])

  const handleGenerateDepositAddress = async () => {
    const sendAmount = inputMode === 'send' ? amount : calculatedAmount
    
    if (!sendAmount || parseFloat(sendAmount) <= 0) {
      toast.error('Please enter a valid amount')
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
        toast.error('ChangeNOW API key is not configured. Please contact the administrator to add CHANGENOW_API_KEY to Netlify environment variables.', {
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-white/80 tracking-tight">From Chain</label>
            <select
              value={fromChain}
              onChange={(e) => {
                setFromChain(e.target.value)
                const chain = availableChains.find(c => c.value === e.target.value)
                // Prefer USDT if available, otherwise first asset
                const preferredAsset = chain?.assets.find(a => a === 'USDT') || chain?.assets[0] || 'ETH'
                setFromAsset(preferredAsset)
                // Clear calculated amounts when chain changes
                setAmount('')
                setCalculatedAmount('')
                setEstimatedReceive('')
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
            <label className="block text-sm font-medium mb-2 text-white/80 tracking-tight">From Asset</label>
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

        <div className="space-y-4">
          {/* Input Mode Toggle */}
          <div className="flex items-center gap-2 p-2 glass-strong rounded-xl border border-white/10">
            <button
              onClick={() => {
                setInputMode('send')
                setAmount('')
                setCalculatedAmount('')
                setEstimatedReceive('')
              }}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                inputMode === 'send'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              Enter Send Amount
            </button>
            <button
              onClick={() => {
                setInputMode('receive')
                setRequiredAmount(request.amount || '')
                setCalculatedAmount('')
                setAmount('')
              }}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                inputMode === 'receive'
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              Enter Required Amount
            </button>
          </div>

          {inputMode === 'send' ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-2 text-white/80 tracking-tight">
                  Amount You'll Send ({fromAsset})
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    setInputMode('send')
                  }}
                  placeholder="0.0"
                  className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-blue-500/50 focus:outline-none transition-all bg-white/[0.04] text-white placeholder:text-white/30 text-sm"
                />
                {calculating && (
                  <p className="text-xs text-blue-400 mt-2 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Calculating...
                  </p>
                )}
                {estimatedReceive && !calculating && (
                  <p className="text-xs text-white/60 mt-2 tracking-tight">
                    Recipient will receive approximately <span className="font-semibold text-white">{estimatedReceive} {request.currency}</span>
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-2 text-white/80 tracking-tight">
                  Amount Needed ({request.currency})
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={requiredAmount}
                  onChange={(e) => {
                    setRequiredAmount(e.target.value)
                    setInputMode('receive')
                  }}
                  placeholder={request.amount || "0.0"}
                  className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-purple-500/50 focus:outline-none transition-all bg-white/[0.04] text-white placeholder:text-white/30 text-sm"
                />
                {calculating && (
                  <p className="text-xs text-purple-400 mt-2 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Calculating required amount...
                  </p>
                )}
                {calculatedAmount && !calculating && (
                  <div className="mt-3 p-3 glass-strong rounded-xl border border-purple-500/20 bg-purple-500/10">
                    <p className="text-xs text-white/60 mb-1 tracking-tight">You need to send:</p>
                    <p className="text-lg font-semibold text-purple-400 tracking-tight">
                      {calculatedAmount} {fromAsset}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
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
          disabled={loading || calculating || (inputMode === 'send' ? (!amount || parseFloat(amount) <= 0) : (!calculatedAmount || parseFloat(calculatedAmount) <= 0))}
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

