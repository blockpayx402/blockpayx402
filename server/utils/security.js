/**
 * Security Utilities
 * Prevents accidental exposure of sensitive data
 */

/**
 * Check if API key is being exposed
 */
export const validateApiKeySecurity = () => {
  const apiKey = process.env.CHANGENOW_API_KEY
  
  // Check if API key is in common exposure places
  const warnings = []
  
  // Check if key is in code
  if (process.env.NODE_ENV === 'production') {
    // In production, ensure key is not hardcoded
    const fs = require('fs')
    const path = require('path')
    
    // Files to check (exclude node_modules and dist)
    const filesToCheck = [
      path.join(process.cwd(), 'server', 'services', 'changenow.js'),
      path.join(process.cwd(), 'server', 'config.js'),
      path.join(process.cwd(), 'server', 'index.js'),
    ]
    
    filesToCheck.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf-8')
          if (apiKey && content.includes(apiKey)) {
            warnings.push(`⚠️  SECURITY WARNING: API key found in ${file}`)
          }
        }
      } catch (error) {
        // Ignore errors
      }
    })
  }
  
  return warnings
}

/**
 * Sanitize logs to prevent API key exposure
 */
export const sanitizeLog = (message) => {
  const apiKey = process.env.CHANGENOW_API_KEY
  
  if (!apiKey) return message
  
  // Replace API key with masked version in logs
  return message.replace(
    new RegExp(apiKey, 'g'),
    '***MASKED_API_KEY***'
  )
}

/**
 * Validate .env file is not in git
 */
export const checkGitSecurity = () => {
  const fs = require('fs')
  const path = require('path')
  const { execSync } = require('child_process')
  
  try {
    // Check if .env is tracked by git
    const gitStatus = execSync('git ls-files .env', { 
      encoding: 'utf-8',
      stdio: 'pipe'
    }).trim()
    
    if (gitStatus.includes('.env')) {
      return {
        secure: false,
        warning: '⚠️  SECURITY WARNING: .env file is tracked by git! Remove it immediately.'
      }
    }
    
    // Check if .env is in .gitignore
    const gitignorePath = path.join(process.cwd(), '.gitignore')
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8')
      if (!gitignore.includes('.env')) {
        return {
          secure: false,
          warning: '⚠️  WARNING: .env is not in .gitignore'
        }
      }
    }
    
    return { secure: true }
  } catch (error) {
    // Git not available or not a git repo
    return { secure: true }
  }
}

export default {
  validateApiKeySecurity,
  sanitizeLog,
  checkGitSecurity
}

