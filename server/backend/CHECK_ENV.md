# .env Datei Checkliste

## ⚠️ WICHTIGE HINWEISE:

### 1. CLIENT_ID und CLIENT_SECRET sind identisch
**Das ist sehr ungewöhnlich!** Normalerweise sollten diese unterschiedlich sein.

**Zu prüfen in Authentik:**
- Gehe zu: Authentik Admin → Applications → Deine App → Provider
- Prüfe die **Client ID** und das **Client Secret**
- Diese sollten **unterschiedlich** sein
- Falls sie identisch sind, generiere ein neues Client Secret

### 2. URLs prüfen
- Alle URLs sollten erreichbar sein
- Trailing Slashes sind OK, aber sollten konsistent sein

### 3. Redirect URI prüfen
- In Authentik muss exakt stehen: `http://localhost:3000/auth/authentik/callback`
- Keine Trailing Slashes, exakte Übereinstimmung

### 4. Client Authentication Method
In Authentik Provider Settings:
- **Client Authentication Method** sollte sein:
  - `client_secret_post` (empfohlen für unseren Code)
  - ODER `client_secret_basic` (dann müsste Code angepasst werden)

## Schnelltest:

1. Öffne in Browser: `https://auth.theskz.dev/application/o/authorize/?client_id=GYIIdDr6YFOOGST3y9zjxn2LnoiOh57PRZSXAALD&response_type=code&redirect_uri=http://localhost:3000/auth/authentik/callback&scope=openid+profile+email`
2. Wenn das funktioniert, ist die Authorization URL korrekt
3. Der Fehler tritt beim Token-Exchange auf, also beim Tauschen des Codes gegen ein Token

## Empfohlene Aktionen:

1. **In Authentik prüfen:**
   - Client ID und Secret kopieren (sollten unterschiedlich sein!)
   - Client Authentication Method auf `client_secret_post` setzen
   - Redirect URI exakt prüfen

2. **In .env aktualisieren:**
   - Korrekte, unterschiedliche CLIENT_ID und CLIENT_SECRET eintragen
   - JWT_SECRET für Production ändern
