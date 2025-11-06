import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Search, Filter, Download, Link as LinkIcon, Loader2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import PaymentRequestCard from '../components/PaymentRequestCard'
import { formatDistanceToNow } from 'date-fns'

const Transactions = () => {
  const { paymentRequests, transactions, isLoading } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const navigate = useNavigate()

  // Debug logging
  useEffect(() => {
    console.log('Transactions page - Data loaded:', {
      transactionsCount: transactions?.length || 0,
      requestsCount: paymentRequests?.length || 0,
      isLoading,
      transactions: transactions?.slice(0, 3), // First 3 for debugging
      requests: paymentRequests?.slice(0, 3) // First 3 for debugging
    })
  }, [transactions, paymentRequests, isLoading])

  // Combine payment requests and transactions - MUST be before any early returns
  const allItems = useMemo(() => {
    console.log('Processing allItems - Raw data:', {
      paymentRequests: paymentRequests?.length || 0,
      transactions: transactions?.length || 0,
      paymentRequestsArray: paymentRequests,
      transactionsArray: transactions
    })

    const requests = (paymentRequests || []).map(req => {
      if (!req || !req.id) {
        console.warn('Invalid payment request:', req)
        return null
      }
      return {
        id: req.id,
        amount: `${req.amount || 0} ${req.currency || ''}`,
        status: req.status || 'pending',
        chain: req.chain,
        from: req.recipient ? `${req.recipient.slice(0, 6)}...${req.recipient.slice(-4)}` : 'Pending',
        timestamp: req.createdAt ? formatDistanceToNow(new Date(req.createdAt), { addSuffix: true }) : 'Unknown',
        description: req.description || 'Payment request',
        type: 'request',
        createdAt: req.createdAt
      }
    }).filter(req => req !== null && req.id)

    const txs = (transactions || []).map(tx => {
      if (!tx || !tx.id) {
        console.warn('Invalid transaction:', tx)
        return null
      }
      // Handle both database format (from/to) and old format (from_address/to_address)
      const fromAddress = tx.from || tx.from_address || 'Unknown'
      const toAddress = tx.to || tx.to_address || 'Unknown'
      
      return {
        id: tx.id,
        amount: `${tx.amount || 0} ${tx.currency || ''}`,
        status: tx.status || 'completed',
        chain: tx.chain,
        from: fromAddress && fromAddress !== 'Unknown' ? `${fromAddress.slice(0, 6)}...${fromAddress.slice(-4)}` : 'Unknown',
        to: toAddress && toAddress !== 'Unknown' ? `${toAddress.slice(0, 6)}...${toAddress.slice(-4)}` : 'Unknown',
        timestamp: tx.timestamp ? formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true }) : 'Unknown',
        description: tx.description || 'Transaction',
        type: 'transaction',
        createdAt: tx.timestamp,
        txHash: tx.txHash || tx.tx_hash,
        requestId: tx.requestId || tx.request_id
      }
    }).filter(tx => tx !== null && tx.id)

    const combined = [...txs, ...requests]
    const sorted = combined.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime()
      const dateB = new Date(b.createdAt || 0).getTime()
      return dateB - dateA
    })

    console.log('allItems result:', {
      requestsCount: requests.length,
      txsCount: txs.length,
      combinedCount: combined.length,
      sortedCount: sorted.length,
      sample: sorted.slice(0, 2)
    })

    return sorted
  }, [paymentRequests, transactions])

  // Filter items - MUST be before any early returns
  const filteredItems = useMemo(() => {
    try {
      return allItems.filter(item => {
        if (!item) return false
        
        const matchesSearch = !searchQuery || 
          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (item.amount && item.amount.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (item.from && item.from.toLowerCase().includes(searchQuery.toLowerCase()))
        
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter
        
        return matchesSearch && matchesStatus
      })
    } catch (error) {
      console.error('Error filtering items:', error)
      return []
    }
  }, [allItems, searchQuery, statusFilter])

  // Loading state - AFTER all hooks
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-white/60" />
          </div>
          <p className="text-white/60 text-lg tracking-tight">Loading transactions...</p>
        </div>
      </div>
    )
  }

  try {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Link to="/" className="inline-flex items-center gap-2 text-dark-400 hover:text-white mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Transactions</h1>
            <p className="text-dark-400">View and manage all your payment requests</p>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all">
              <Filter className="w-5 h-5" />
            </button>
            <button className="px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all">
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="flex-1 glass rounded-2xl p-6 border border-white/10">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transactions..."
                className="w-full pl-12 pr-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-primary-500/50 focus:outline-none transition-all"
              />
            </div>
          </div>
          <div className="glass rounded-2xl p-2 border border-white/10 flex gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === 'all'
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === 'pending'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === 'completed'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === 'failed'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              Failed
            </button>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="glass rounded-2xl p-12 border border-white/10 text-center">
            <p className="text-white/60 text-lg mb-2">No transactions found</p>
            <p className="text-white/40 text-sm mb-4">
              {paymentRequests.length === 0 && transactions.length === 0
                ? 'Create your first payment request to get started'
                : `Found ${allItems.length} total items but none match your filters. Try adjusting your search or filter.`}
            </p>
            <div className="mt-4 text-xs text-white/30 space-y-1">
              <p>Debug Info:</p>
              <p>• Transactions loaded: {transactions?.length || 0}</p>
              <p>• Payment requests loaded: {paymentRequests?.length || 0}</p>
              <p>• All items combined: {allItems.length}</p>
              <p>• Filtered items: {filteredItems.length}</p>
              <p>• Search query: "{searchQuery}"</p>
              <p>• Status filter: "{statusFilter}"</p>
              {transactions?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <p className="text-white/50">Sample transaction data:</p>
                  <pre className="text-xs text-left mt-1 p-2 bg-white/5 rounded overflow-auto max-h-32">
                    {JSON.stringify(transactions[0], null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item, index) => {
              if (!item || !item.id) {
                console.warn('Skipping invalid item:', item)
                return null
              }
              
              try {
                // Parse amount and currency
                const amountParts = (item.amount || '0').split(' ')
                const amount = amountParts[0] || '0'
                const currency = amountParts.slice(1).join(' ') || ''
                
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="relative"
                  >
                    {item.type === 'request' && (
                      <div className="absolute top-4 right-4 flex gap-2 z-10">
                        <button
                          onClick={() => navigate(`/pay/${item.id}`)}
                          className="p-2 glass-strong rounded-lg border border-white/10 hover:border-primary-500/30 transition-all text-white/60 hover:text-primary-400"
                          title="View payment page"
                        >
                          <LinkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <PaymentRequestCard 
                      request={{
                        id: item.id,
                        amount: amount || '0',
                        currency: currency || 'ETH',
                        status: item.status || 'pending',
                        chain: item.chain || 'ethereum',
                        description: item.description || (item.type === 'transaction' ? 'Transaction' : 'Payment request'),
                        recipient: item.type === 'transaction' ? (item.to || item.from || '') : (item.from || ''),
                        createdAt: item.createdAt,
                        isExpired: false,
                        txHash: item.txHash || item.tx_hash || null
                      }}
                    />
                  </motion.div>
                )
              } catch (error) {
                console.error('Error rendering transaction item:', error, item)
                return null
              }
            })}
          </div>
        )}
      </motion.div>
    </div>
    )
  } catch (error) {
    console.error('Error rendering Transactions page:', error)
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="glass rounded-2xl p-12 border border-red-500/30 text-center">
          <p className="text-red-400 text-lg mb-2">Error loading transactions</p>
          <p className="text-white/60 text-sm mb-4">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all text-white/80 hover:text-white"
          >
            Reload Page
          </button>
        </div>
      </div>
    )
  }
}

export default Transactions

