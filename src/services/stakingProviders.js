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
    
    const filtered = data.data.filter(p => {
      const chainMatch = !chainName || chainVariants.some(v => 
        (p.chain || '').toLowerCase().includes(v.toLowerCase())
      )
      // Include pools with meaningful APY (> 0.1%) and reasonable TVL
      const hasValue = (p.apy || 0) > 0.1 && (p.tvlUsd || 0) > 1000
      return chainMatch && hasValue
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


