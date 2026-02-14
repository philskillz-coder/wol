# Debugging Authentik OAuth2

## Common Issues

### "Client authentication failed" Error

This error typically occurs when:

1. **Client ID and Secret are incorrect**
   - Verify in Authentik Admin Panel → Applications → Your App → Provider
   - Make sure CLIENT_ID and CLIENT_SECRET in .env match exactly

2. **Client Secret is wrong format**
   - Authentik client secrets should be a long random string
   - If CLIENT_ID and CLIENT_SECRET are identical, that's likely wrong

3. **Redirect URI mismatch**
   - The callback URL in .env must match exactly what's configured in Authentik
   - Check: Authentik Admin → Applications → Your App → Redirect URIs
   - Should be: `http://localhost:3000/auth/authentik/callback`

4. **Provider Type mismatch**
   - Make sure your Authentik Provider is set to "OAuth2/OpenID Connect"
   - Not "Proxy" or other types

## Testing Steps

1. **Verify Authentik Configuration:**
   ```
   - Go to Authentik Admin Panel
   - Navigate to Applications → Your Application
   - Check Provider settings
   - Verify Redirect URIs include: http://localhost:3000/auth/authentik/callback
   ```

2. **Test Authorization URL directly:**
   ```
   https://auth.theskz.dev/application/o/authorize/?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost:3000/auth/authentik/callback&scope=openid+profile+email
   ```

3. **Check Backend Logs:**
   - Look for detailed error messages
   - Check if token exchange is happening

4. **Verify Environment Variables:**
   - Make sure .env file is loaded
   - Check that all AUTHENTIK_* variables are set correctly
   - No extra spaces or quotes in values

## Authentik Provider Settings Checklist

- [ ] Provider Type: OAuth2/OpenID Connect
- [ ] Client Type: Confidential (not Public)
- [ ] Redirect URIs: `http://localhost:3000/auth/authentik/callback`
- [ ] Scopes: `openid`, `profile`, `email`
- [ ] Client ID matches .env
- [ ] Client Secret matches .env (copy exactly, no extra spaces)
