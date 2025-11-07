import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Wallet, X, Loader2, CheckCircle2, AlertCircle, RefreshCw, PlugZap } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { toast } from 'react-hot-toast'
import { Connection, PublicKey, Transaction, clusterApiUrl } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, createCloseAccountInstruction } from '@solana/spl-token'

const SolanaCloser = () => {
  const { wallet, connectWallet } = useApp()
  const [accounts, setAccounts] = useState([])
  const [scanning, setScanning] = useState(false)
  const [closing, setClosing] = useState(false)
  const [totalReclaimable, setTotalReclaimable] = useState(0)
  const [connection, setConnection] = useState(null)
  const [resolvedEndpoint, setResolvedEndpoint] = useState('')
  const [rpcLoading, setRpcLoading] = useState(false)
  const [rpcError, setRpcError] = useState(null)
  const [customRpc, setCustomRpc] = useState('')

  const DEFAULT_ENDPOINTS = useMemo(() => {
    return [
      customRpc?.trim() || null,
      import.meta.env.VITE_SOLANA_RPC?.trim() || null,
      'https://rpc.ankr.com/solana',
      'https://solana-mainnet.g.alchemy.com/v2/demo',
      'https://solana-mainnet.rpcpool.com',
      clusterApiUrl('mainnet-beta')
    ].filter(Boolean)
  }, [customRpc])

  const resolveConnection = useCallback(async () => {
    setRpcLoading(true)
    setRpcError(null)

    for (const endpoint of DEFAULT_ENDPOINTS) {
      try {
        const candidate = new Connection(endpoint, 'confirmed')
        await candidate.getVersion()
        setConnection(candidate)
        setResolvedEndpoint(endpoint)
        setRpcLoading(false)
        if (customRpc) {
          toast.success('Using custom RPC endpoint')
        }
        return candidate
      } catch (error) {
        console.error('RPC endpoint failed:', endpoint, error)
      }
    }

    const message = 'Unable to reach any Solana RPC endpoint. Add a custom endpoint or try again later.'
    setRpcError(message)
    toast.error(message)
    setRpcLoading(false)
    return null
  }, [DEFAULT_ENDPOINTS, customRpc])

  useEffect(() => {
    resolveConnection()
  }, [resolveConnection])

  useEffect(() => {
    if (wallet?.chain === 'solana' && wallet?.connected) {
      scanAccounts()
    }
  }, [wallet])

  const scanAccounts = async () => {
    if (!wallet?.address) {
      toast.error('Please connect your Solana wallet')
      return
    }

    const activeConnection = connection || (await resolveConnection())
    if (!activeConnection) {
      return
    }

    setScanning(true)
    try {
      const owner = new PublicKey(wallet.address)
      const parsedAccounts = await activeConnection.getParsedTokenAccountsByOwner(owner, {
        programId: TOKEN_PROGRAM_ID
      })

      const emptyAccounts = parsedAccounts.value
        .map(({ pubkey, account }) => {
          const info = account.data.parsed.info
          const lamports = account.lamports || 0
          const amountRaw = info.tokenAmount.amount
          const decimals = info.tokenAmount.decimals
          const uiAmount = Number(info.tokenAmount.uiAmountString || info.tokenAmount.uiAmount || 0)

          return {
            address: pubkey.toBase58(),
            mint: info.mint,
            rentLamports: lamports,
            rent: lamports / 1e9,
            amountRaw,
            decimals,
            uiAmount
          }
        })
        .filter(acc => acc.amountRaw === '0' || acc.uiAmount === 0)

      setAccounts(emptyAccounts)
      const total = emptyAccounts.reduce((sum, acc) => sum + acc.rent, 0)
      setTotalReclaimable(total)
    } catch (error) {
      console.error('Error scanning accounts:', error)
      if (typeof error?.message === 'string' && error.message.includes('403')) {
        toast.error('RPC endpoint blocked (403). Add a custom RPC endpoint and try again.')
        setRpcError('Access forbidden on current RPC endpoint. Provide a custom RPC endpoint that allows your IP.')
      } else {
        toast.error('Failed to scan accounts')
      }
      setAccounts([])
      setTotalReclaimable(0)
    } finally {
      setScanning(false)
    }
  }

  const closeAccount = async (accountAddress) => {
    if (!wallet?.connected || wallet?.chain !== 'solana') {
      toast.error('Please connect your Solana wallet')
      return
    }

    setClosing(true)
    try {
      const provider = window.solana
      if (!provider || !provider.isConnected) {
        toast.error('Wallet not connected')
        setClosing(false)
        return
      }

      const activeConnection = connection || (await resolveConnection())
      if (!activeConnection) {
        setClosing(false)
        return
      }

      const owner = new PublicKey(wallet.address)
      const accountPubkey = new PublicKey(accountAddress)

      const transaction = new Transaction()
      transaction.add(createCloseAccountInstruction(
        accountPubkey,
        owner,
        owner
      ))

      transaction.feePayer = owner
      const { blockhash, lastValidBlockHeight } = await activeConnection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash

      const signedTx = await provider.signTransaction(transaction)
      const signature = await activeConnection.sendRawTransaction(signedTx.serialize())
      await activeConnection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')

      toast.success(`Closed account ${accountAddress.slice(0, 4)}...${accountAddress.slice(-4)}`)

      setAccounts(prev => prev.filter(acc => acc.address !== accountAddress))
      const closedAccount = accounts.find(acc => acc.address === accountAddress)
      if (closedAccount) {
        setTotalReclaimable(prev => Math.max(0, prev - closedAccount.rent))
      }
    } catch (error) {
      console.error('Error closing account:', error)
      toast.error('Failed to close account')
    } finally {
      setClosing(false)
    }
  }

  const closeAllAccounts = async () => {
    if (accounts.length === 0) return
    
    setClosing(true)
    try {
      for (const account of accounts) {
        await closeAccount(account.address)
        // Small delay between closures
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      toast.success(`Closed ${accounts.length} accounts`)
    } catch (error) {
      console.error('Error closing accounts:', error)
      toast.error('Failed to close some accounts')
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-semibold mb-2 gradient-text tracking-tight">Solana Account Closer</h1>
        <p className="text-white/60 text-lg tracking-tight">
          Close empty token accounts and reclaim rent-exempt SOL
        </p>
      </motion.div>

      {/* RPC Config */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 border border-white/[0.08]"
      >
        <div className="flex items-start gap-4">
          <PlugZap className="w-10 h-10 text-primary-400" />
          <div className="flex-1">
            <h2 className="text-xl font-semibold mb-2 tracking-tight">RPC Endpoint</h2>
            <p className="text-white/60 text-sm mb-4 tracking-tight">
              {rpcLoading
                ? 'Resolving Solana RPC endpoint...'
                : resolvedEndpoint
                  ? `Using ${resolvedEndpoint}`
                  : 'No endpoint available. Add a custom RPC URL.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={customRpc}
                onChange={(e) => setCustomRpc(e.target.value)}
                placeholder="https://your-solana-rpc.com"
                className="flex-1 px-4 py-3 glass-strong rounded-xl border border-white/10 focus:border-primary-500/50 focus:outline-none transition-all bg-white/[0.04] text-white placeholder:text-white/30"
              />
              <button
                onClick={resolveConnection}
                className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl text-white font-medium shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 transition-all flex items-center gap-2"
                disabled={rpcLoading}
              >
                <RefreshCw className={`w-4 h-4 ${rpcLoading ? 'animate-spin' : ''}`} />
                Apply RPC
              </button>
            </div>
            {rpcError && (
              <p className="text-sm text-red-400 mt-3 tracking-tight">{rpcError}</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Connect Wallet */}
      {!wallet?.connected || wallet?.chain !== 'solana' ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-8 border border-white/[0.08] text-center"
        >
          <Wallet className="w-16 h-16 mx-auto mb-4 text-white/40" />
          <h2 className="text-2xl font-semibold mb-2 tracking-tight">Connect Solana Wallet</h2>
          <p className="text-white/60 mb-6 tracking-tight">
            Connect your Phantom or Solflare wallet to scan for empty token accounts
          </p>
          <button
            onClick={() => connectWallet('solana')}
            className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl text-white font-medium shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 transition-all"
          >
            Connect Wallet
          </button>
        </motion.div>
      ) : (
        <>
          {/* Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-3xl p-8 border border-white/[0.08]"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold mb-2 tracking-tight">Reclaimable SOL</h2>
                <p className="text-5xl font-bold text-primary-400 tracking-tight">
                  {totalReclaimable.toFixed(6)} SOL
                </p>
                <p className="text-white/60 text-sm mt-2 tracking-tight">
                  From {accounts.length} empty token account{accounts.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={scanAccounts}
                  disabled={scanning}
                  className="px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
                  Rescan
                </button>
                {accounts.length > 0 && (
                  <button
                    onClick={closeAllAccounts}
                    disabled={closing}
                    className="px-6 py-2 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl text-white font-medium shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 transition-all disabled:opacity-50"
                  >
                    Close All
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* Accounts List */}
          {scanning ? (
            <div className="glass rounded-2xl p-12 border border-white/[0.08] text-center">
              <Loader2 className="w-12 h-12 animate-spin text-white/60 mx-auto mb-4" />
              <p className="text-white/60 tracking-tight">Scanning for empty token accounts...</p>
            </div>
          ) : accounts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass rounded-2xl p-12 border border-white/[0.08] text-center"
            >
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-400" />
              <h3 className="text-xl font-semibold mb-2 tracking-tight">No Empty Accounts</h3>
              <p className="text-white/60 tracking-tight">
                All your token accounts have balances or have already been closed
              </p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account, index) => (
                <motion.div
                  key={account.address}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass rounded-2xl p-6 border border-white/[0.08]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                          <X className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                          <p className="font-mono text-sm text-white/80 tracking-tight">
                            {account.address.slice(0, 8)}...{account.address.slice(-8)}
                          </p>
                          <p className="text-xs text-white/50 tracking-tight">
                            Mint: {account.mint.slice(0, 8)}...{account.mint.slice(-8)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-sm text-white/60 mb-1 tracking-tight">Rent to Reclaim</p>
                        <p className="text-lg font-semibold text-primary-400 tracking-tight">
                          {account.rent.toFixed(6)} SOL
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => closeAccount(account.address)}
                      disabled={closing}
                      className="px-4 py-2 glass-strong rounded-xl border border-white/10 hover:border-primary-500/30 transition-all disabled:opacity-50 text-sm font-medium"
                    >
                      {closing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Close'
                      )}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-6 border border-white/[0.08]"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-2 tracking-tight">About Account Closure</h3>
                <ul className="space-y-2 text-sm text-white/60">
                  <li>• Only empty token accounts (zero balance) can be closed</li>
                  <li>• Closing an account returns the rent-exempt SOL to your wallet</li>
                  <li>• Each account typically holds ~0.002 SOL in rent</li>
                  <li>• Account closure is irreversible - ensure the account is no longer needed</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}

export default SolanaCloser

