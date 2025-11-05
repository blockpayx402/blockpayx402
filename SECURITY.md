# 🔒 BlockPay Security Guide

## API Key Security

Your ChangeNOW API key is stored in `.env` file and is **NEVER** committed to git.

### ✅ Security Measures in Place:

1. **`.env` in `.gitignore`**
   - `.env` file is automatically ignored by git
   - Prevents accidental commits

2. **Security Checks**
   - Server validates `.env` is not tracked by git
   - Warns if API key might be exposed
   - Logs sanitize API keys automatically

3. **Environment Variables Only**
   - API key only stored in `.env`
   - Never hardcoded in source code
   - Never exposed in logs

### 🔐 Best Practices:

1. **Never commit `.env`**
   ```bash
   # Check if .env is tracked (should return nothing)
   git ls-files .env
   ```

2. **Never share `.env` file**
   - Don't email it
   - Don't share in chat
   - Don't upload to cloud storage publicly

3. **Rotate keys if exposed**
   - If key is ever exposed, regenerate it immediately
   - Update `.env` with new key
   - Old key will stop working

4. **Use different keys for dev/prod**
   - Development key for testing
   - Production key for live site
   - Never mix them

### ⚠️ If API Key is Exposed:

1. **Immediately regenerate** at https://changenow.io/api
2. **Update `.env`** with new key
3. **Check git history** if accidentally committed:
   ```bash
   git log --all --full-history -- .env
   ```
4. **Remove from git** if found:
   ```bash
   git rm --cached .env
   git commit -m "Remove .env from git"
   ```

### 🛡️ Current Security Status:

- ✅ `.env` is in `.gitignore`
- ✅ API key stored only in `.env`
- ✅ Security checks on server startup
- ✅ Log sanitization prevents key exposure

### 📝 What's Protected:

- ✅ ChangeNOW API Key
- ✅ Webhook Secrets
- ✅ Fee Recipient Addresses
- ✅ All sensitive configuration

---

**Your API key is secure!** 🔒

