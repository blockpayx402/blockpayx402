# Netlify Environment Variable Setup

## Add SimpleSwap API Key to Netlify

1. Go to your Netlify dashboard: https://app.netlify.com
2. Select your site (blockpay.cloud)
3. Go to **Site settings** → **Environment variables**
4. Click **Add a variable**
5. Add:
   - **Key**: `SIMPLESWAP_API_KEY`
   - **Value**: `MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgVVOdMRtgXdgA6TMkdoBRnDh+GJUXODvNuQrxR4fury6hRANCAAShaUFlbXt5RR3p+f9iYtJfRSoxpn3IzPyNw6iYusN2oh6qUwiSpR5hkGtDJHcuZj63pohFC4UYfzWldvY6yUFU`
6. Click **Save**
7. **Redeploy** your site (go to Deploys → Trigger deploy → Deploy site)

## Quick Command (if you have Netlify CLI)

```bash
netlify env:set SIMPLESWAP_API_KEY "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgVVOdMRtgXdgA6TMkdoBRnDh+GJUXODvNuQrxR4fury6hRANCAAShaUFlbXt5RR3p+f9iYtJfRSoxpn3IzPyNw6iYusN2oh6qUwiSpR5hkGtDJHcuZj63pohFC4UYfzWldvY6yUFU"
```

Then redeploy:
```bash
netlify deploy --prod
```
