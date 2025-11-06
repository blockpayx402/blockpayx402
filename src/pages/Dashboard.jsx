import { motion } from 'framer-motion'
import { TrendingUp, Wallet, DollarSign, Clock, ArrowRight, Plus, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import PaymentRequestCard from '../components/PaymentRequestCard'
import StatCard from '../components/StatCard'
import { formatDistanceToNow } from 'date-fns'

const Dashboard = () => {
  const { paymentRequests, getStats, isLoading } = useApp()
  const statsData = getStats()

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

  const stats = [
    { 
      label: 'Total Volume', 
      value: `$${statsData.totalRevenue}`, 
      change: `+${statsData.completedPayments}`, 
      icon: DollarSign, 
      color: 'text-green-400' 
    },
    { 
      label: 'Active Requests', 
      value: `${statsData.activeRequests}`, 
      change: `+${statsData.activeRequests > 0 ? statsData.activeRequests : 0}`, 
      icon: Wallet, 
      color: 'text-primary-400' 
    },
    { 
      label: 'Pending Payments', 
      value: `${statsData.pendingPayments}`, 
      change: statsData.pendingPayments > 0 ? `-${statsData.pendingPayments}` : '0', 
      icon: Clock, 
      color: 'text-yellow-400' 
    },
    { 
      label: 'Success Rate', 
      value: `${statsData.growthRate}%`, 
      change: `+${statsData.completedPayments}`, 
      icon: TrendingUp, 
      color: 'text-purple-400' 
    },
  ]

  const recentRequests = paymentRequests.slice(0, 5).map(req => {
    const isExpired = req.isExpired || (req.expiresAt && new Date(req.expiresAt) < new Date())
    return {
      ...req,
      isExpired,
      status: isExpired && req.status === 'pending' ? 'expired' : req.status
    }
  })

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-5xl font-semibold mb-3 gradient-text tracking-tight">Dashboard</h1>
          <p className="text-white/60 text-lg">Welcome back! Here's your payment overview.</p>
        </div>
        <Link to="/request">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2.5 px-6 py-3.5 bg-white text-black rounded-2xl text-sm font-semibold shadow-soft-lg hover:shadow-soft-lg hover:bg-white/90 transition-all tracking-tight"
          >
            <Plus className="w-5 h-5" />
            Create Request
          </motion.button>
        </Link>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="glass rounded-3xl p-8 border border-white/[0.08]"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-semibold gradient-text tracking-tight">Recent Payment Requests</h2>
          <Link
            to="/transactions"
            className="flex items-center gap-2 text-white/60 hover:text-white text-sm font-medium transition-colors tracking-tight"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="space-y-3">
          {recentRequests.map((request, index) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.08, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            >
              <PaymentRequestCard 
                key={request.id}
                request={request}
                onClick={() => window.location.href = `/pay/${request.id}`}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="grid grid-cols-1 md:grid-cols-2 gap-5"
      >
        <div className="glass rounded-3xl p-10 border border-white/[0.08] relative overflow-hidden group hover:border-white/[0.12] transition-all duration-300">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary-500/10 to-primary-600/10 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
          <div className="relative">
            <h3 className="text-2xl font-semibold mb-3 gradient-text tracking-tight">Need Help?</h3>
            <p className="text-white/60 mb-6 text-[15px] leading-relaxed">Learn how to create and manage payment requests</p>
            <button className="text-white/80 hover:text-white font-medium flex items-center gap-2 transition-colors text-sm tracking-tight">
              View Documentation
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="glass rounded-3xl p-10 border border-white/[0.08] relative overflow-hidden group hover:border-white/[0.12] transition-all duration-300">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity" />
          <div className="relative">
            <h3 className="text-2xl font-semibold mb-3 gradient-text tracking-tight">Security First</h3>
            <p className="text-white/60 mb-6 text-[15px] leading-relaxed">Your funds are always under your control</p>
            <button className="text-white/80 hover:text-white font-medium flex items-center gap-2 transition-colors text-sm tracking-tight">
              Learn More
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default Dashboard

