# Relay Link Flow - How It Actually Works

## Flowchart: Relay Direct Wallet Execution (Like Relay Website)

```
┌─────────────────────────────────────────────────────────────────┐
│              STEP 1: USER CONNECTS WALLET                       │
│  User connects MetaMask/Phantom/Solflare wallet                 │
│  Wallet address is used as both sender and recipient            │
└────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│          STEP 2: USER SELECTS SWAP DETAILS                      │
│  User chooses:                                                  │
│  - From: Chain + Token (e.g., BSC + USDT)                      │
│  - To: Chain + Token (e.g., Ethereum + USDT)                  │
│  - Amount: How much to send                                     │
└────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 3: GET QUOTE FROM RELAY                       │
│  Call: client.actions.getQuote({                               │
│    chainId, toChainId, currency, toCurrency, amount,            │
│    tradeType: 'EXACT_INPUT',                                    │
│    user: walletAddress,                                         │
│    recipient: walletAddress                                     │
│  })                                                             │
│                                                                 │
│  Response includes:                                             │
│  - transaction: Smart contract transaction data                 │
│  - approvalTransaction: ERC20 approval tx (if needed)          │
│  - destinationAmount: How much user will receive                │
│  - quoteId: To track the swap                                  │
│  - validUntil: Quote expiration time                           │
└────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│        STEP 4: USER SEES QUOTE & CLICKS SWAP                    │
│  UI shows:                                                      │
│  - "You send: 100 USDT"                                        │
│  - "You get: ~98.5 USDT" (on different chain)                  │
│  - Estimated time and fees                                      │
│  User clicks "Swap" button                                      │
└────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│        STEP 5: USER SIGNS TRANSACTION                            │
│  If ERC20 token:                                                │
│  1. User signs approvalTransaction (approve Relay to spend)     │
│  2. User signs transaction (execute swap)                      │
│                                                                 │
│  If Native token:                                               │
│  1. User signs transaction (execute swap)                      │
│                                                                 │
│  Transaction is sent to blockchain                              │
└────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│        STEP 6: RELAY EXECUTES SWAP                               │
│  Once transaction is confirmed:                                 │
│  1. Relay detects transaction on origin chain                   │
│  2. Relay swaps fromAsset → Native currency                     │
│  3. Relay bridges native currency to destination chain          │
│  4. Relay swaps native currency → toAsset                       │
│  5. Relay sends toAsset to user's wallet                       │
└────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│        STEP 7: CHECK STATUS & COMPLETION                         │
│  Poll: client.actions.getStatus(quoteId)                        │
│                                                                 │
│  Status flow:                                                    │
│  - 'pending': Transaction submitted, waiting confirmation       │
│  - 'processing': Relay is executing swap                        │
│  - 'completed': Tokens received in user's wallet ✅             │
│  - 'failed': Swap failed (user can get refund)                 │
└────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STEP 8: DONE! ✅                              │
│  User receives toAsset in their connected wallet                │
│  Transaction complete! No deposit addresses needed!             │
└─────────────────────────────────────────────────────────────────┘
```

## Key Differences: Same-Chain vs Cross-Chain

### Cross-Chain Swap (USDT on BSC → USDT on Ethereum)
```
1. Get Quote → depositAddress provided
2. User sends USDT to depositAddress on BSC
3. Relay: USDT(BSC) → BNB → Bridge → ETH → USDT(Ethereum)
4. User receives USDT on Ethereum
```

### Same-Chain Swap (USDT → USDC on BSC)
```
1. Get Quote → depositAddress OR direct execution
2. If depositAddress: User sends USDT to address
3. Relay: USDT → USDC on same chain (DEX swap)
4. User receives USDC on BSC
```

## Our Current Implementation Issues

### ❌ What We're Doing Wrong:
1. **Missing deposit address monitoring** - We generate address but don't track when user sends funds
2. **Not using Relay's status API properly** - We should poll `getStatus()` to check deposit
3. **Error handling too generic** - We assume "not supported" when it might be other issues
4. **Not handling quote expiration** - Quotes expire, we need to regenerate

### ✅ What We Should Do (Like Relay):
1. **Generate quote with depositAddress** - ✅ We do this
2. **Show depositAddress to user** - ✅ We do this
3. **Poll getStatus() to detect deposit** - ❌ We don't do this properly
4. **Show real-time status updates** - ❌ We don't update status
5. **Handle quote expiration** - ❌ We don't check validUntil

## Correct Flow for Our Implementation

```
User creates swap order
    ↓
Backend calls createRelayTransaction()
    ↓
Relay SDK returns: { depositAddress, quoteId, validUntil }
    ↓
Frontend shows depositAddress to user
    ↓
Frontend polls: getRelayStatus(quoteId) every 5-10 seconds
    ↓
Status changes: awaiting_deposit → pending → completed
    ↓
When completed: Show success, user has received tokens
```

