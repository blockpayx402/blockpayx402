// Staking Providers - fetch real pools via DeFiLlama Yields API

const DEFI_LLAMA_YIELDS = 'https://yields.llama.fi/pools'

const CHAIN_NAME_MAP = {
  ethereum: 'Ethereum',
  bnb: 'Binance',
  polygon: 'Polygon',
  solana: 'Solana',
}

export async function fetchRealStakingPools(chain) {
  const chainName = CHAIN_NAME_MAP[chain?.toLowerCase?.()] || chain
  try {
    const res = await fetch(DEFI_LLAMA_YIELDS)
    if (!res.ok) throw new Error(`DeFiLlama error ${res.status}`)
    const data = await res.json()
    if (!data?.data || !Array.isArray(data.data)) return []

    // Filter pools by chain - be more inclusive for better results
    const chainMap = {
      'Ethereum': ['Ethereum', 'ethereum'],
      'Binance': ['BSC', 'Binance', 'bsc', 'binance'],
      'Polygon': ['Polygon', 'polygon'],
      'Solana': ['Solana', 'solana']
    }
    
    const chainVariants = chainMap[chainName] || [chainName]
    
    // Native staking tokens per chain
    const nativeStakingTokens = {
      'Ethereum': ['ETH', 'stETH', 'rETH', 'cbETH'],
      'Binance': ['BNB'],
      'BSC': ['BNB'],
      'Polygon': ['MATIC', 'stMATIC'],
      'Solana': ['SOL', 'mSOL', 'JitoSOL', 'stSOL']
    }
    
    const stakingTokens = nativeStakingTokens[chainName] || nativeStakingTokens[chainVariants[0]] || []
    
    const filtered = data.data.filter(p => {
      const chainMatch = !chainName || chainVariants.some(v => 
        (p.chain || '').toLowerCase().includes(v.toLowerCase())
      )
      
      // Only include actual staking pools, not DeFi liquidity pools
      const isStakingPool = 
        // Must be a native staking token or known staking derivative
        stakingTokens.some(token => 
          (p.symbol || '').toUpperCase() === token.toUpperCase() ||
          (p.symbol || '').toUpperCase().includes(token)
        ) ||
        // Or project name suggests staking
        ['lido', 'rocket', 'stake', 'staked', 'validator', 'native'].some(keyword =>
          (p.project || '').toLowerCase().includes(keyword)
        )
      
      // Exclude liquidity pools (pairs like USDT-ETH, COAI-USDT, etc.)
      const isLiquidityPool = 
        (p.symbol || '').includes('-') ||
        (p.symbol || '').includes('/') ||
        (p.symbol || '').toLowerCase().includes('lp') ||
        (p.poolMeta?.category || '').toLowerCase().includes('liquidity') ||
        (p.poolMeta?.category || '').toLowerCase().includes('farm')
      
      // Realistic APY range for staking (0.1% to 30%)
      const apy = Number(p.apy || 0)
      const realisticAPY = apy >= 0.1 && apy <= 30
      
      // Must have meaningful TVL
      const hasValue = (p.tvlUsd || 0) > 1000
      
      return chainMatch && isStakingPool && !isLiquidityPool && realisticAPY && hasValue
    })
    
    // Sort by APY descending to show best pools first
    filtered.sort((a, b) => (b.apy || 0) - (a.apy || 0))

    // Map to UI shape
    const mapped = filtered.slice(0, 20).map(p => ({
      id: `${p.project}-${p.chain}-${p.symbol}-${p.pool}`.replace(/[^a-zA-Z0-9_-]/g, ''),
      chain: chain?.toLowerCase?.() || (p.chain || '').toLowerCase(),
      name: `${p.project} ${p.symbol}`,
      symbol: p.symbol,
      apy: typeof p.apy === 'number' ? p.apy : (Number(p.apy) || 0),
      tvlUsd: p.tvlUsd || 0,
      project: p.project,
      link: p.url || p.poolMeta?.url || `https://defillama.com/yields/pool/${encodeURIComponent(p.pool)}`,
      description: `${p.project} on ${p.chain}`,
      minStake: 0,
      lockPeriod: 0,
    }))

    return mapped
  } catch (e) {
    console.error('[Staking] Failed to fetch pools:', e)
    return []
  }
}


