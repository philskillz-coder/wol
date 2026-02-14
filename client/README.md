# Wake-on-LAN Client

Ein leichtgewichtiger TypeScript-Client für aktive Wake-on-LAN-Geräte.

## Setup

1. Installiere Dependencies:
```bash
npm install
```

2. Erstelle `config.json` basierend auf `config.json.example`:
```bash
cp config.json.example config.json
```

3. Fülle die `config.json` mit den Werten aus dem Backend-Dashboard aus.

## Verwendung

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## Config

Die `config.json` enthält:
- `deviceId`: Die ID des Geräts (vom Backend generiert)
- `secret`: Das Secret für die Authentifizierung (vom Backend generiert)
- `serverUrl`: URL des Backend-Servers
- `wsUrl`: WebSocket-URL des Backend-Servers
- `allowShutdown`: `true`/`false` - Erlaubt Remote-Shutdown (nur wenn explizit `true`)

## Sicherheit

**WICHTIG:** Setze `allowShutdown` nur auf `true`, wenn du wirklich Remote-Shutdown erlauben möchtest. Der Client führt nur dann einen Shutdown aus, wenn diese Option explizit auf `true` gesetzt ist.
