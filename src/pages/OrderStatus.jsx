import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { 
  Loader2, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  RefreshCw,
  Copy,
  ExternalLink
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { ordersAPI } from '../services/api'
import { CHAINS } from '../services/blockchain'
import QRCode from 'qrcode.react'

const OrderStatus = () => {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderId) return

    const loadOrderStatus = async () => {
      try {
        const orderData = await ordersAPI.getStatus(orderId)
        setOrder(orderData)
      } catch (error) {
        console.error('Error loading order status:', error)
        toast.error('Failed to load order status')
      } finally {
        setLoading(false)
      }
    }

    loadOrderStatus()

    // Auto-refresh every 5 seconds
    const interval = setInterval(loadOrderStatus, 5000)

    return () => clearInterval(interval)
  }, [orderId])

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const getStatusConfig = (status) => {
    const configs = {
      awaiting_deposit: {
        label: 'Awaiting Deposit',
        description: 'Waiting for your payment to the deposit address',
        icon: Clock,
        color: 'text-yellow-400',
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/30'
      },
      processing: {
        label: 'Processing',
        description: 'Swapping tokens across chains',
        icon: RefreshCw,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        spinning: true
      },
      completed: {
        label: 'Complete',
        description: 'Recipient has received the funds',
        icon: CheckCircle2,
        color: 'text-green-400',
        bg: 'bg-green-500/10',
        border: 'border-green-500/30'
      },
      failed: {
        label: 'Failed',
        description: 'Swap failed - refund initiated',
        icon: Clock,
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/30'
      }
    }
    return configs[status] || configs.awaiting_deposit
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-white/60" />
          </div>
          <p className="text-white/60 text-lg tracking-tight">Loading order status...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="glass rounded-2xl p-12 border border-red-500/30 text-center">
          <p className="text-red-400 text-lg mb-2">Order not found</p>
          <p className="text-white/60 text-sm mb-4">The order ID may be invalid</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all text-white/80 hover:text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const statusConfig = getStatusConfig(order.status)
  const StatusIcon = statusConfig.icon
  const request = order.request

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to={`/pay/${order.requestId}`}
        className="inline-flex items-center gap-2 text-dark-400 hover:text-white mb-8"
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        Back to Payment Page
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="glass rounded-2xl p-8 border border-white/10">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 tracking-tight">Order Status</h1>
            <p className="text-dark-400">Tracking your cross-chain payment</p>
          </div>

          <div className="glass-strong rounded-2xl p-6 border border-white/[0.12] mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-white/60 mb-1 tracking-tight">Order ID</p>
                <p className="font-mono text-sm text-white/90">{order.id}</p>
              </div>
              <div className={`px-4 py-2 rounded-xl ${statusConfig.bg} ${statusConfig.border} border`}>
                <div className="flex items-center gap-2">
                  <StatusIcon className={`w-4 h-4 ${statusConfig.color} ${statusConfig.spinning ? 'animate-spin' : ''}`} />
                  <span className={`text-sm font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Steps */}
          <div className="space-y-4 mb-8">
            {[
              { status: 'awaiting_deposit', label: 'Awaiting Deposit', desc: 'Waiting for your payment to the deposit address' },
              { status: 'processing', label: 'Processing', desc: 'Swapping tokens across chains' },
              { status: 'completed', label: 'Complete', desc: 'Recipient has received the funds' }
            ].map((step, index) => {
              const isActive = order.status === step.status
              const isCompleted = ['processing', 'completed'].includes(order.status) && index < 2 ||
                                  order.status === 'completed' && index === 2
              
              return (
                <div
                  key={step.status}
                  className={`glass-strong rounded-xl p-5 border transition-all ${
                    isActive
                      ? `${statusConfig.bg} ${statusConfig.border} border-2`
                      : isCompleted
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'border-white/[0.12]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isActive
                        ? `${statusConfig.bg} border ${statusConfig.border}`
                        : isCompleted
                        ? 'bg-green-500/20 border border-green-500/30'
                        : 'bg-white/[0.08] border border-white/[0.12]'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : isActive ? (
                        <StatusIcon className={`w-5 h-5 ${statusConfig.color} ${statusConfig.spinning ? 'animate-spin' : ''}`} />
                      ) : (
                        <Clock className="w-5 h-5 text-white/40" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className={`font-semibold mb-1 tracking-tight ${
                        isActive || isCompleted ? 'text-white' : 'text-white/60'
                      }`}>
                        {step.label}
                      </div>
                      <div className={`text-sm tracking-tight ${
                        isActive || isCompleted ? 'text-white/70' : 'text-white/50'
                      }`}>
                        {step.desc}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Transaction Details */}
          <div className="glass-strong rounded-2xl p-6 border border-white/[0.12] mb-6">
            <h2 className="text-xl font-semibold mb-4 tracking-tight">Transaction Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-white/60 mb-2 tracking-tight">Sending</p>
                <p className="font-medium text-white/90">
                  {order.amount || 'Any amount'} {order.fromAsset} on {CHAINS[order.fromChain]?.name || order.fromChain}
                </p>
              </div>
              <div>
                <p className="text-sm text-white/60 mb-2 tracking-tight">Receiving</p>
                <p className="font-medium text-primary-400">
                  {order.expectedAmount || 'Equivalent'} {order.toAsset} on {CHAINS[order.toChain]?.name || order.toChain}
                </p>
              </div>
            </div>
          </div>

          {/* Deposit Address (if still awaiting) */}
          {order.status === 'awaiting_deposit' && (
            <div className="glass-strong rounded-2xl p-6 border border-blue-500/30 bg-blue-500/10">
              <h3 className="text-lg font-semibold mb-4 tracking-tight">Send Payment</h3>
              <p className="text-sm text-white/70 mb-4 tracking-tight">
                Send {order.fromAsset} to the deposit address below
              </p>

              <div className="glass rounded-2xl p-6 flex items-center justify-center mb-4 border border-white/[0.12]">
                <div className="w-48 h-48 bg-white rounded-2xl p-3 flex items-center justify-center shadow-soft-lg">
                  <QRCode 
                    value={order.depositAddress} 
                    size={180}
                    level="H"
                    includeMargin={false}
                  />
                </div>
              </div>

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
            </div>
          )}

          {/* Transaction Hashes */}
          {(order.depositTxHash || order.swapTxHash) && (
            <div className="glass-strong rounded-2xl p-6 border border-white/[0.12]">
              <h3 className="text-lg font-semibold mb-4 tracking-tight">Transaction Hashes</h3>
              <div className="space-y-3">
                {order.depositTxHash && (
                  <div>
                    <p className="text-sm text-white/60 mb-1 tracking-tight">Deposit Transaction</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-xs bg-white/[0.05] px-3 py-2 rounded-lg text-white/80 break-all">
                        {order.depositTxHash}
                      </code>
                      <a
                        href={`${CHAINS[order.fromChain]?.explorerUrl || 'https://etherscan.io'}/tx/${order.depositTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-400 hover:text-primary-300 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                )}
                {order.swapTxHash && (
                  <div>
                    <p className="text-sm text-white/60 mb-1 tracking-tight">Swap Transaction</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-xs bg-white/[0.05] px-3 py-2 rounded-lg text-white/80 break-all">
                        {order.swapTxHash}
                      </code>
                      <a
                        href={`${CHAINS[order.toChain]?.explorerUrl || 'https://etherscan.io'}/tx/${order.swapTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-400 hover:text-primary-300 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="text-center text-xs text-white/40 tracking-tight">
            Auto-updating every 5 seconds
          </div>

          <div className="flex gap-4 mt-6">
            <button
              onClick={() => navigate('/')}
              className="flex-1 px-6 py-3 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all font-medium text-white/80 hover:text-white"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => navigate('/request')}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl text-white font-medium shadow-lg shadow-primary-500/30"
            >
              Create Another Request
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default OrderStatus

