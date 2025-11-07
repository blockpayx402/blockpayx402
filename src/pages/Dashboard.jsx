import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { 
  Wallet, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle,
  ArrowRight,
  PlusCircle,
  Loader2,
  ShoppingBag,
  Github,
  Twitter,
  Send
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import StatCard from '../components/StatCard'
import PaymentRequestCard from '../components/PaymentRequestCard'

const Dashboard = () => {
  const { paymentRequests, transactions, isLoading, getStats, wallet } = useApp()
  
  const stats = useMemo(() => getStats(), [getStats, paymentRequests])
  
  const recentRequests = useMemo(() => {
    return paymentRequests
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5)
  }, [paymentRequests])
  
  const recentTransactions = useMemo(() => {
    return transactions
      .slice()
      .sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0))
      .slice(0, 3)
  }, [transactions])

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-white/60" />
          </div>
          <p className="text-white/60 text-lg tracking-tight">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass rounded-3xl p-8 border border-white/[0.08]"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-semibold mb-2 gradient-text tracking-tight">
              Welcome Back
            </h1>
            <p className="text-white/60 text-lg tracking-tight">
              {wallet?.connected 
                ? `Connected: ${wallet.address?.slice(0, 6)}...${wallet.address?.slice(-4)}`
                : 'Connect your wallet to get started'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href="https://pump.fun/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl text-white font-medium shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 transition-all flex items-center gap-2"
            >
              <ShoppingBag className="w-5 h-5" />
              Buy
            </a>
            {!wallet?.connected && (
              <Link
                to="/request"
                className="px-6 py-3 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 text-white font-medium transition-all flex items-center gap-2"
              >
                <PlusCircle className="w-5 h-5" />
                Create Request
              </Link>
            )}
          </div>
        </div>
      </motion.div>

      {/* Social Links Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="glass rounded-3xl p-6 border border-white/[0.08]"
      >
        <div className="flex items-center justify-center gap-4">
          <a
            href="https://github.com/abdelrahman147/payment-cloud-system"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all group"
          >
            <Github className="w-5 h-5 text-white/70 group-hover:text-white" />
            <span className="text-white/70 group-hover:text-white font-medium tracking-tight">GitHub</span>
          </a>
          <a
            href="https://twitter.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 glass-strong rounded-xl border border-white/10 hover:border-sky-500/30 transition-all group"
          >
            <Twitter className="w-5 h-5 text-white/70 group-hover:text-sky-400" />
            <span className="text-white/70 group-hover:text-sky-400 font-medium tracking-tight">Twitter</span>
          </a>
          <a
            href="https://t.me"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 glass-strong rounded-xl border border-white/10 hover:border-blue-500/30 transition-all group"
          >
            <Send className="w-5 h-5 text-white/70 group-hover:text-blue-400" />
            <span className="text-white/70 group-hover:text-blue-400 font-medium tracking-tight">Telegram</span>
          </a>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <StatCard
          label="Total Revenue"
          value={`$${stats.totalRevenue}`}
          change={`+${stats.growthRate}%`}
          icon={Wallet}
          color="text-primary-400"
        />
        <StatCard
          label="Active Requests"
          value={stats.activeRequests}
          change={stats.pendingPayments > 0 ? `+${stats.pendingPayments}` : '0'}
          icon={Clock}
          color="text-yellow-400"
        />
        <StatCard
          label="Completed"
          value={stats.completedPayments}
          change={stats.completedPayments > 0 ? `+${stats.completedPayments}` : '0'}
          icon={CheckCircle2}
          color="text-green-400"
        />
        <StatCard
          label="Success Rate"
          value={`${stats.growthRate}%`}
          change={stats.growthRate > 50 ? '+5%' : '-2%'}
          icon={TrendingUp}
          color="text-blue-400"
        />
      </motion.div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Payment Requests */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="glass rounded-3xl p-8 border border-white/[0.08]"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold tracking-tight">Recent Requests</h2>
            <Link
              to="/request"
              className="text-primary-400 hover:text-primary-300 text-sm font-medium flex items-center gap-1 transition-colors"
            >
              Create New
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {recentRequests.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                <PlusCircle className="w-8 h-8 text-white/40" />
              </div>
              <p className="text-white/60 mb-4 tracking-tight">No payment requests yet</p>
              <Link
                to="/request"
                className="inline-flex items-center gap-2 px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all text-sm font-medium"
              >
                <PlusCircle className="w-4 h-4" />
                Create Your First Request
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentRequests.map((request, index) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                >
                  <PaymentRequestCard request={request} />
                </motion.div>
              ))}
              {paymentRequests.length > 5 && (
                <Link
                  to="/transactions"
                  className="block text-center py-3 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all text-sm font-medium text-white/60 hover:text-white"
                >
                  View All ({paymentRequests.length})
                </Link>
              )}
            </div>
          )}
        </motion.div>

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="glass rounded-3xl p-8 border border-white/[0.08]"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold tracking-tight">Recent Transactions</h2>
            <Link
              to="/transactions"
              className="text-primary-400 hover:text-primary-300 text-sm font-medium flex items-center gap-1 transition-colors"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {recentTransactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                <Wallet className="w-8 h-8 text-white/40" />
              </div>
              <p className="text-white/60 mb-2 tracking-tight">No transactions yet</p>
              <p className="text-white/40 text-sm tracking-tight">
                Transactions will appear here once payments are completed
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentTransactions.map((tx, index) => {
                const amountParts = (tx.amount || '0').toString().split(' ')
                const amount = amountParts[0] || '0'
                const currency = amountParts.slice(1).join(' ') || tx.currency || 'ETH'
                
                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    className="glass-strong rounded-2xl p-5 border border-white/[0.12]"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          tx.status === 'completed' 
                            ? 'bg-green-500/10 border border-green-500/20' 
                            : 'bg-red-500/10 border border-red-500/20'
                        }`}>
                          {tx.status === 'completed' ? (
                            <CheckCircle2 className={`w-5 h-5 ${
                              tx.status === 'completed' ? 'text-green-400' : 'text-red-400'
                            }`} />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-white font-medium tracking-tight">
                            {amount} {currency}
                          </p>
                          <p className="text-white/50 text-xs tracking-tight">
                            {tx.chain || 'ethereum'}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        tx.status === 'completed'
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      } tracking-tight`}>
                        {tx.status || 'pending'}
                      </span>
                    </div>
                    {tx.txHash && (
                      <p className="text-white/40 text-xs font-mono tracking-tight truncate">
                        {tx.txHash.slice(0, 20)}...
                      </p>
                    )}
                  </motion.div>
                )
              })}
              {transactions.length > 3 && (
                <Link
                  to="/transactions"
                  className="block text-center py-3 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all text-sm font-medium text-white/60 hover:text-white"
                >
                  View All ({transactions.length})
                </Link>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

export default Dashboard

