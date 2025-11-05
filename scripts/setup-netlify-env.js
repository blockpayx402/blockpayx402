/**
 * Netlify Environment Variables Setup Script
 * This script helps you set environment variables in Netlify
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log(`
╔════════════════════════════════════════════════════════════╗
║      BlockPay Netlify Environment Variables Setup          ║
╚════════════════════════════════════════════════════════════╝
`)

// Environment variables to set
const envVars = {
  'CHANGENOW_API_KEY': '1cda159504a3b708495e678ee620d58664c840f5a5cd341e6fb51f04ee79572b',
  'NODE_ENV': 'production',
  'BLOCKPAY_FEE_PERCENT': '0.01',
  'BLOCKPAY_MIN_FEE_USD': '0.10',
  'BLOCKPAY_MAX_FEE_USD': '0',
  'BLOCKPAY_FEE_RECIPIENT': '0x0000000000000000000000000000000000000000',
  'BLOCKPAY_FEE_CHAIN': 'ethereum'
}

// Check if Netlify CLI is installed
let hasNetlifyCLI = false
try {
  execSync('netlify --version', { stdio: 'ignore' })
  hasNetlifyCLI = true
  console.log('✅ Netlify CLI detected\n')
} catch (error) {
  console.log('ℹ️  Netlify CLI not detected\n')
}

if (hasNetlifyCLI) {
  console.log('📋 Option 1: Using Netlify CLI (Automated)\n')
  console.log('This will set environment variables directly via CLI.\n')
  
  try {
    // Check if logged in
    try {
      execSync('netlify status', { stdio: 'ignore' })
      console.log('✅ You are logged into Netlify CLI\n')
      
      // Set each environment variable
      console.log('🔧 Setting environment variables...\n')
      for (const [key, value] of Object.entries(envVars)) {
        try {
          execSync(`netlify env:set ${key} "${value}"`, { stdio: 'inherit' })
          console.log(`✅ Set ${key}\n`)
        } catch (error) {
          console.log(`⚠️  Failed to set ${key}, you may need to set it manually\n`)
        }
      }
      
      console.log('\n✅ Environment variables set!')
      console.log('🔄 Triggering redeploy...\n')
      
      try {
        execSync('netlify deploy --prod', { stdio: 'inherit' })
        console.log('\n✅ Deployment complete!')
        console.log('🌐 Visit: https://blockpay.cloud/api/setup to verify\n')
      } catch (error) {
        console.log('\n⚠️  Automatic deployment failed. Please redeploy manually in Netlify dashboard.\n')
      }
      
    } catch (error) {
      console.log('❌ Not logged into Netlify CLI')
      console.log('📝 Please run: netlify login\n')
      console.log('Then run this script again.\n')
    }
  } catch (error) {
    console.log('⚠️  Error using Netlify CLI\n')
  }
} else {
  console.log('📋 Option 2: Manual Setup (Netlify Dashboard)\n')
}

// Generate instructions file
console.log('📄 Generating setup instructions...\n')

const instructions = `# Netlify Environment Variables - Quick Setup

## ✅ Automated Setup (If Netlify CLI is installed)

1. Install Netlify CLI:
   \`\`\`bash
   npm install -g netlify-cli
   \`\`\`

2. Login to Netlify:
   \`\`\`bash
   netlify login
   \`\`\`

3. Run setup script:
   \`\`\`bash
   node scripts/setup-netlify-env.js
   \`\`\`

---

## 📋 Manual Setup (Netlify Dashboard)

### Step 1: Go to Netlify Dashboard
👉 https://app.netlify.com → Your site → **Site settings**

### Step 2: Add Environment Variables
**Site settings** → **Build & deploy** → **Environment variables** → **Add a variable**

### Step 3: Add These Variables (Copy-Paste Ready):

\`\`\`
CHANGENOW_API_KEY = 1cda159504a3b708495e678ee620d58664c840f5a5cd341e6fb51f04ee79572b
NODE_ENV = production
BLOCKPAY_FEE_PERCENT = 0.01
BLOCKPAY_MIN_FEE_USD = 0.10
BLOCKPAY_MAX_FEE_USD = 0
BLOCKPAY_FEE_RECIPIENT = 0x0000000000000000000000000000000000000000
BLOCKPAY_FEE_CHAIN = ethereum
\`\`\`

### Step 4: Redeploy
**Deploys** tab → **Trigger deploy** → **Clear cache and deploy site**

### Step 5: Verify
Visit: https://blockpay.cloud/api/setup

Should show: \`"ready": true\` ✅

---

## 🎯 Quick Copy-Paste Commands

If you have Netlify CLI installed and logged in:

\`\`\`bash
netlify env:set CHANGENOW_API_KEY "1cda159504a3b708495e678ee620d58664c840f5a5cd341e6fb51f04ee79572b"
netlify env:set NODE_ENV "production"
netlify env:set BLOCKPAY_FEE_PERCENT "0.01"
netlify env:set BLOCKPAY_MIN_FEE_USD "0.10"
netlify env:set BLOCKPAY_MAX_FEE_USD "0"
netlify env:set BLOCKPAY_FEE_RECIPIENT "0x0000000000000000000000000000000000000000"
netlify env:set BLOCKPAY_FEE_CHAIN "ethereum"
netlify deploy --prod
\`\`\`

---

**That's it! After setting variables and redeploying, your setup will be complete!** ✅
`

fs.writeFileSync(path.join(__dirname, '..', 'NETLIFY_ENV_SETUP_INSTRUCTIONS.md'), instructions)

console.log('✅ Instructions saved to: NETLIFY_ENV_SETUP_INSTRUCTIONS.md\n')

// Display manual instructions
console.log('═══════════════════════════════════════════════════════════════\n')
console.log('📋 MANUAL SETUP INSTRUCTIONS\n')
console.log('═══════════════════════════════════════════════════════════════\n')

console.log('1. Go to: https://app.netlify.com')
console.log('2. Select your site: blockpay.cloud')
console.log('3. Click: Site settings → Build & deploy → Environment variables')
console.log('4. Click: Add a variable')
console.log('5. Add these variables:\n')

for (const [key, value] of Object.entries(envVars)) {
  console.log(`   ${key} = ${value}`)
}

console.log('\n6. Go to: Deploys tab')
console.log('7. Click: Trigger deploy → Clear cache and deploy site')
console.log('8. Wait for deployment')
console.log('9. Visit: https://blockpay.cloud/api/setup')
console.log('\n✅ Done! Should show "ready": true\n')

console.log('═══════════════════════════════════════════════════════════════\n')

