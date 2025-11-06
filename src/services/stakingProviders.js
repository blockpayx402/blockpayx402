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

    // Filter pools by chain and include common core tokens
    const coreSymbols = new Set(['ETH', 'SOL', 'MATIC', 'BNB', 'stETH', 'rETH', 'stMATIC', 'mSOL', 'JitoSOL'])
    const filtered = data.data.filter(p =>
      (!chainName || p.chain === chainName) &&
      (coreSymbols.has(p.symbol) || coreSymbols.has(p.project) || /eth|sol|matic|bnb/i.test(p.symbol))
    )

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


