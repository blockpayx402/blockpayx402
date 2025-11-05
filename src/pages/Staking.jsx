import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  TrendingUp, 
  Lock, 
  Unlock, 
  Coins, 
  ArrowRight, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  Zap
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { CHAINS } from '../services/blockchain'
import { toast } from 'react-hot-toast'

const Staking = () => {
  const { wallet, isLoading } = useApp()
  const [selectedChain, setSelectedChain] = useState('ethereum')
  const [stakeAmount, setStakeAmount] = useState('')
  const [unstakeAmount, setUnstakeAmount] = useState('')
  const [stakeLoading, setStakeLoading] = useState(false)
  const [unstakeLoading, setUnstakeLoading] = useState(false)
  const [stakingData, setStakingData] = useState({
    totalStaked: 0,
    totalRewards: 0,
    apy: 0,
    stakingPools: []
  })

  // Mock staking pools data (in production, fetch from blockchain)
  const stakingPools = [
    {
      id: 'eth-main',
      chain: 'ethereum',
      name: 'Ethereum Staking',
      symbol: 'ETH',
      apy: 4.5,
      minStake: 0.1,
      lockPeriod: 30, // days
      totalStaked: 1250.5,
      totalRewards: 56.25,
      description: 'Stake ETH and earn rewards'
    },
    {
      id: 'bnb-main',
      chain: 'bnb',
      name: 'BNB Chain Staking',
      symbol: 'BNB',
      apy: 6.2,
      minStake: 0.5,
      lockPeriod: 14,
      totalStaked: 890.3,
      totalRewards: 55.2,
      description: 'Stake BNB and earn rewards'
    },
    {
      id: 'polygon-main',
      chain: 'polygon',
      name: 'Polygon Staking',
      symbol: 'MATIC',
      apy: 8.1,
      minStake: 10,
      lockPeriod: 7,
      totalStaked: 5420.8,
      totalRewards: 438.08,
      description: 'Stake MATIC and earn rewards'
    },
    {
      id: 'solana-main',
      chain: 'solana',
      name: 'Solana Staking',
      symbol: 'SOL',
      apy: 7.3,
      minStake: 1,
      lockPeriod: 21,
      totalStaked: 2340.2,
      totalRewards: 170.83,
      description: 'Stake SOL and earn rewards'
    }
  ]

  const currentPool = stakingPools.find(pool => pool.chain === selectedChain) || stakingPools[0]

  const handleStake = async () => {
    if (!wallet?.connected) {
      toast.error('Please connect your wallet first')
      return
    }

    const amount = parseFloat(stakeAmount)
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (amount < currentPool.minStake) {
      toast.error(`Minimum stake amount is ${currentPool.minStake} ${currentPool.symbol}`)
      return
    }

    setStakeLoading(true)
    try {
      // In production, this would interact with the blockchain
      // For now, simulate the transaction
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast.success(`Successfully staked ${amount} ${currentPool.symbol}!`)
      setStakeAmount('')
      setStakingData(prev => ({
        ...prev,
        totalStaked: prev.totalStaked + amount
      }))
    } catch (error) {
      toast.error('Failed to stake. Please try again.')
      console.error('Staking error:', error)
    } finally {
      setStakeLoading(false)
    }
  }

  const handleUnstake = async () => {
    if (!wallet?.connected) {
      toast.error('Please connect your wallet first')
      return
    }

    const amount = parseFloat(unstakeAmount)
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (amount > stakingData.totalStaked) {
      toast.error('Insufficient staked amount')
      return
    }

    setUnstakeLoading(true)
    try {
      // In production, this would interact with the blockchain
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast.success(`Successfully unstaked ${amount} ${currentPool.symbol}!`)
      setUnstakeAmount('')
      setStakingData(prev => ({
        ...prev,
        totalStaked: Math.max(0, prev.totalStaked - amount)
      }))
    } catch (error) {
      toast.error('Failed to unstake. Please try again.')
      console.error('Unstaking error:', error)
    } finally {
      setUnstakeLoading(false)
    }
  }

  const handleMaxStake = () => {
    // In production, get actual balance from wallet
    const mockBalance = 10.5
    setStakeAmount(mockBalance.toString())
  }

  const handleMaxUnstake = () => {
    setUnstakeAmount(stakingData.totalStaked.toString())
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-white/60" />
          </div>
          <p className="text-white/60 text-lg tracking-tight">Loading staking...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2 tracking-tight">Staking</h1>
            <p className="text-dark-400">Earn rewards by staking your cryptocurrencies</p>
          </div>
        </div>

        {/* Chain Selector */}
        <div className="glass rounded-2xl p-6 border border-white/10 mb-6">
          <p className="text-sm text-white/60 mb-4 tracking-tight">Select Chain</p>
          <div className="flex gap-3 flex-wrap">
            {stakingPools.map((pool) => {
              const chainConfig = CHAINS[pool.chain]
              const isSelected = selectedChain === pool.chain
              return (
                <button
                  key={pool.id}
                  onClick={() => setSelectedChain(pool.chain)}
                  className={`px-6 py-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-primary-500/20 text-primary-400 border-primary-500/30'
                      : 'glass-strong border-white/10 text-white/60 hover:text-white hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{chainConfig?.name || pool.name}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4" />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-2xl p-6 border border-white/10"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-white/60 tracking-tight">Total Staked</p>
              <Lock className="w-5 h-5 text-primary-400" />
            </div>
            <p className="text-2xl font-bold mb-1">{stakingData.totalStaked.toFixed(4)} {currentPool.symbol}</p>
            <p className="text-xs text-white/40">≈ ${(stakingData.totalStaked * 2000).toFixed(2)}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-6 border border-white/10"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-white/60 tracking-tight">Total Rewards</p>
              <Coins className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-2xl font-bold mb-1">{stakingData.totalRewards.toFixed(4)} {currentPool.symbol}</p>
            <p className="text-xs text-white/40">Available to claim</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-2xl p-6 border border-white/10"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-white/60 tracking-tight">APY</p>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-2xl font-bold mb-1">{currentPool.apy}%</p>
            <p className="text-xs text-white/40">Annual percentage yield</p>
          </motion.div>
        </div>

        {/* Staking Pools Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Stake Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="glass rounded-2xl p-6 border border-white/10"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center">
                <Lock className="w-6 h-6 text-primary-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold tracking-tight">Stake</h3>
                <p className="text-sm text-white/60">Lock your tokens to earn rewards</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/60 mb-2 block tracking-tight">Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-primary-500/50 focus:outline-none transition-all"
                  />
                  <button
                    onClick={handleMaxStake}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 text-xs font-medium text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    MAX
                  </button>
                </div>
                <p className="text-xs text-white/40 mt-2">Minimum: {currentPool.minStake} {currentPool.symbol}</p>
              </div>

              <div className="glass-strong rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-white/60">APY</span>
                  <span className="font-medium text-green-400">{currentPool.apy}%</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-white/60">Lock Period</span>
                  <span className="font-medium">{currentPool.lockPeriod} days</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Estimated Rewards</span>
                  <span className="font-medium text-primary-400">
                    {stakeAmount ? ((parseFloat(stakeAmount) * currentPool.apy) / 100).toFixed(4) : '0.0000'} {currentPool.symbol}/year
                  </span>
                </div>
              </div>

              <button
                onClick={handleStake}
                disabled={stakeLoading || !wallet?.connected}
                className="w-full px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl font-medium text-white hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {stakeLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Stake {currentPool.symbol}
                  </>
                )}
              </button>
            </div>
          </motion.div>

          {/* Unstake Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="glass rounded-2xl p-6 border border-white/10"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
                <Unlock className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold tracking-tight">Unstake</h3>
                <p className="text-sm text-white/60">Withdraw your staked tokens</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/60 mb-2 block tracking-tight">Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-yellow-500/50 focus:outline-none transition-all"
                  />
                  <button
                    onClick={handleMaxUnstake}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 text-xs font-medium text-yellow-400 hover:text-yellow-300 transition-colors"
                  >
                    MAX
                  </button>
                </div>
                <p className="text-xs text-white/40 mt-2">Available: {stakingData.totalStaked.toFixed(4)} {currentPool.symbol}</p>
              </div>

              <div className="glass-strong rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 text-sm text-yellow-400/80 mb-2">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">Unstaking Period</span>
                </div>
                <p className="text-xs text-white/60">
                  Tokens will be locked for {currentPool.lockPeriod} days after unstaking request
                </p>
              </div>

              <button
                onClick={handleUnstake}
                disabled={unstakeLoading || !wallet?.connected || stakingData.totalStaked === 0}
                className="w-full px-6 py-3 bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-xl font-medium text-yellow-400 hover:bg-yellow-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {unstakeLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Unlock className="w-5 h-5" />
                    Unstake {currentPool.symbol}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass rounded-2xl p-6 border border-white/10"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-2 tracking-tight">How Staking Works</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-primary-400 mt-0.5 flex-shrink-0" />
                  <span>Stake your tokens to earn passive rewards based on the APY</span>
                </li>
                <li className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-primary-400 mt-0.5 flex-shrink-0" />
                  <span>Tokens are locked for the specified period to maintain network security</span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>Rewards are calculated daily and can be claimed at any time</span>
                </li>
                <li className="flex items-start gap-2">
                  <Unlock className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <span>Unstaking requires a cooldown period before tokens are available</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default Staking

