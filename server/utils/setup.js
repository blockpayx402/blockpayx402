/**
 * BlockPay Setup Utility
 * Helps users configure and verify their setup
 */

import { BLOCKPAY_CONFIG } from '../config.js'

export const checkSetup = () => {
  const issues = []
  const warnings = []
  const info = []

  // Check ChangeNOW API Key
  if (!BLOCKPAY_CONFIG.changenow.apiKey || BLOCKPAY_CONFIG.changenow.apiKey === '') {
    issues.push({
      type: 'error',
      message: 'ChangeNOW API key is not configured',
      fix: 'Set CHANGENOW_API_KEY in your .env file. Get your key from: https://changenow.io/api',
      required: true
    })
  } else {
    info.push({
      type: 'success',
      message: 'ChangeNOW API key is configured'
    })
  }

  // Check Fee Configuration
  const hasEVMRecipient = BLOCKPAY_CONFIG.fees.feeRecipients.ethereum && 
                          BLOCKPAY_CONFIG.fees.feeRecipients.ethereum !== '0x0000000000000000000000000000000000000000'
  const hasSolRecipient = BLOCKPAY_CONFIG.fees.feeRecipients.solana && 
                          BLOCKPAY_CONFIG.fees.feeRecipients.solana !== ''
  
  if (!hasEVMRecipient && !hasSolRecipient) {
    warnings.push({
      type: 'warning',
      message: 'Fee recipient addresses not configured',
      fix: 'Set BLOCKPAY_FEE_RECIPIENT_EVM and BLOCKPAY_FEE_RECIPIENT_SOL in .env to collect platform fees'
    })
  } else {
    if (hasEVMRecipient) {
      info.push({
        type: 'success',
        message: `EVM Fee recipient: ${BLOCKPAY_CONFIG.fees.feeRecipients.ethereum}`
      })
    }
    if (hasSolRecipient) {
      info.push({
        type: 'success',
        message: `Solana Fee recipient: ${BLOCKPAY_CONFIG.fees.feeRecipients.solana}`
      })
    }
  }

  // Check Partner ID (optional but recommended)
  if (!BLOCKPAY_CONFIG.changenow.partnerId) {
    warnings.push({
      type: 'warning',
      message: 'ChangeNOW Partner ID not configured (optional)',
      fix: 'Set CHANGENOW_PARTNER_ID in .env for affiliate tracking'
    })
  }

  return {
    ready: issues.length === 0,
    issues,
    warnings,
    info,
    config: {
      feePercent: BLOCKPAY_CONFIG.fees.platformFeePercent * 100,
      minFee: BLOCKPAY_CONFIG.fees.minFeeUSD,
      maxFee: BLOCKPAY_CONFIG.fees.maxFeeUSD,
      hasApiKey: !!BLOCKPAY_CONFIG.changenow.apiKey,
      hasFeeRecipient: (!!BLOCKPAY_CONFIG.fees.feeRecipients.ethereum && BLOCKPAY_CONFIG.fees.feeRecipients.ethereum !== '0x0000000000000000000000000000000000000000') ||
                       (!!BLOCKPAY_CONFIG.fees.feeRecipients.solana && BLOCKPAY_CONFIG.fees.feeRecipients.solana !== ''),
      evmFeeRecipient: BLOCKPAY_CONFIG.fees.feeRecipients.ethereum,
      solFeeRecipient: BLOCKPAY_CONFIG.fees.feeRecipients.solana
    }
  }
}

export const generateSetupInstructions = (setupStatus) => {
  let instructions = '# BlockPay Setup Instructions\n\n'
  
  if (!setupStatus.ready) {
    instructions += '## ❌ Setup Incomplete\n\n'
    instructions += 'Please fix the following issues:\n\n'
    
    setupStatus.issues.forEach((issue, i) => {
      instructions += `${i + 1}. **${issue.message}**\n`
      instructions += `   - ${issue.fix}\n\n`
    })
  } else {
    instructions += '## ✅ Setup Complete!\n\n'
    instructions += 'Your BlockPay system is ready to use.\n\n'
  }

  if (setupStatus.warnings.length > 0) {
    instructions += '## ⚠️ Warnings\n\n'
    setupStatus.warnings.forEach((warning, i) => {
      instructions += `${i + 1}. ${warning.message}\n`
      instructions += `   - ${warning.fix}\n\n`
    })
  }

  instructions += '\n## 📋 Current Configuration\n\n'
  instructions += `- Platform Fee: ${setupStatus.config.feePercent}%\n`
  instructions += `- Minimum Fee: $${setupStatus.config.minFee}\n`
  instructions += `- Maximum Fee: ${setupStatus.config.maxFee > 0 ? '$' + setupStatus.config.maxFee : 'No limit'}\n`
  instructions += `- ChangeNOW API: ${setupStatus.config.hasApiKey ? '✅ Configured' : '❌ Not configured'}\n`
  instructions += `- Fee Recipient: ${setupStatus.config.hasFeeRecipient ? '✅ Configured' : '❌ Not configured'}\n`

  return instructions
}

export default {
  checkSetup,
  generateSetupInstructions
}

