// RPC Request Queue - prevents rate limits by queuing and throttling requests
// This ensures we don't make too many simultaneous RPC calls

class RPCQueue {
  constructor() {
    this.queue = []
    this.processing = false
    this.lastRequestTime = 0
    this.minDelay = 500 // Minimum 500ms between requests
    this.requestCount = 0
    this.resetTime = Date.now()
    this.maxRequestsPerMinute = 10 // Limit to 10 requests per minute per endpoint
  }

  async enqueue(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        requestFn,
        resolve,
        reject,
        timestamp: Date.now()
      })
      this.processQueue()
    })
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true

    while (this.queue.length > 0) {
      const now = Date.now()
      
      // Reset counter every minute
      if (now - this.resetTime > 60000) {
        this.requestCount = 0
        this.resetTime = now
      }

      // Check rate limit
      if (this.requestCount >= this.maxRequestsPerMinute) {
        const waitTime = 60000 - (now - this.resetTime)
        console.log(`⏳ Rate limit reached, waiting ${Math.ceil(waitTime / 1000)}s...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        this.requestCount = 0
        this.resetTime = Date.now()
      }

      // Ensure minimum delay between requests
      const timeSinceLastRequest = now - this.lastRequestTime
      if (timeSinceLastRequest < this.minDelay) {
        await new Promise(resolve => setTimeout(resolve, this.minDelay - timeSinceLastRequest))
      }

      const item = this.queue.shift()
      this.lastRequestTime = Date.now()
      this.requestCount++

      try {
        const result = await item.requestFn()
        item.resolve(result)
      } catch (error) {
        item.reject(error)
      }

      // Small delay between queue items
      await new Promise(resolve => setTimeout(resolve, this.minDelay))
    }

    this.processing = false
  }

  clear() {
    this.queue = []
    this.processing = false
  }
}

// Create separate queues for different chains to avoid cross-chain interference
const queues = {
  bnb: new RPCQueue(),
  ethereum: new RPCQueue(),
  polygon: new RPCQueue(),
  solana: new RPCQueue()
}

export const queueRPCRequest = async (chain, requestFn) => {
  const queue = queues[chain] || queues.ethereum
  return queue.enqueue(requestFn)
}

export const clearQueue = (chain) => {
  if (chain && queues[chain]) {
    queues[chain].clear()
  } else {
    Object.values(queues).forEach(q => q.clear())
  }
}

