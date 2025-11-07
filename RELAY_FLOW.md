# Relay Link Flow - How It Actually Works

## Flowchart: Relay Cross-Chain Swap Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INITIATES SWAP                          │
│  User selects: fromChain, fromAsset, toChain, toAsset, amount   │
└────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STEP 1: GET QUOTE                            │
│  Call: client.actions.getQuote({                                │
│    chainId, toChainId, currency, toCurrency, amount,            │
│    tradeType: 'EXACT_INPUT', user, recipient                   │
│  })                                                             │
│                                                                 │
│  Response includes:                                             │
│  - depositAddress (temporary address for user to send funds)   │
│  - destinationAmount (how much user will receive)               │
│  - quoteId (to track the swap)                                  │
│  - validUntil (quote expiration time)                          │
└────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 2: USER SENDS FUNDS                            │
│  User sends fromAsset to depositAddress on fromChain            │
│  - For ERC20: User approves token, then transfers to address    │
│  - For Native: User sends native token directly to address      │
│                                                                 │
│  ⚠️ IMPORTANT: User must send EXACT amount from quote           │
│  ⚠️ IMPORTANT: User must send within validUntil time            │
└────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│            STEP 3: RELAY DETECTS DEPOSIT                        │
│  Relay monitors depositAddress for incoming funds               │
│  Once detected, Relay automatically:                            │
│  1. Swaps fromAsset → Native currency on origin chain           │
│  2. Bridges native currency to destination chain                 │
│  3. Swaps native currency → toAsset on destination chain        │
│  4. Sends toAsset to recipientAddress                           │
└────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 4: CHECK STATUS                                │
│  Poll: client.actions.getStatus(quoteId)                        │
│                                                                 │
│  Status values:                                                 │
│  - 'awaiting_deposit': Waiting for user to send funds           │
│  - 'pending': Deposit received, processing swap                │
│  - 'completed': Swap successful, tokens sent to recipient      │
│  - 'failed': Swap failed (user can get refund)                 │
└────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STEP 5: COMPLETION                            │
│  User receives toAsset at recipientAddress on toChain           │
│  Transaction complete! ✅                                         │
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

