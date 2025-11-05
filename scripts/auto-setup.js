#!/usr/bin/env node

/**
 * Auto-Setup Script
 * Automatically configures BlockPay with sensible defaults
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const envPath = path.join(rootDir, '.env')
const envExamplePath = path.join(rootDir, '.env.example')

console.log('🔧 Auto-configuring BlockPay...\n')

// Check if .env exists
if (fs.existsSync(envPath)) {
  console.log('✅ .env file already exists')
  console.log('   Edit it to add your ChangeNOW API key\n')
} else {
  // Create .env from example
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath)
    console.log('✅ Created .env file with default configuration')
    console.log('   📝 Next step: Add your CHANGENOW_API_KEY to .env file')
    console.log('   🔗 Get your key from: https://changenow.io/api\n')
  } else {
    // Create minimal .env
    const defaultEnv = `# BlockPay Configuration
CHANGENOW_API_KEY=
BLOCKPAY_FEE_PERCENT=0.01
BLOCKPAY_MIN_FEE_USD=0.10
BLOCKPAY_MAX_FEE_USD=0
BLOCKPAY_FEE_RECIPIENT=0x0000000000000000000000000000000000000000
BLOCKPAY_FEE_CHAIN=ethereum
PORT=3001
NODE_ENV=development
`
    fs.writeFileSync(envPath, defaultEnv)
    console.log('✅ Created .env file with minimal configuration')
    console.log('   📝 Next step: Add your CHANGENOW_API_KEY to .env file\n')
  }
}

console.log('✅ Auto-setup complete!')
console.log('\n📋 What to do next:')
console.log('   1. Get ChangeNOW API key: https://changenow.io/api')
console.log('   2. Add it to .env file: CHANGENOW_API_KEY=your_key')
console.log('   3. (Optional) Set your fee recipient address')
console.log('   4. Run: npm start\n')

