# Wake-on-LAN Client

Ein leichtgewichtiger TypeScript-Client für aktive Wake-on-LAN-Geräte. Die Konfiguration erfolgt über eine **.env-Datei** (nicht im Repository committen).

## Setup

1. Dependencies installieren:
```bash
npm install
```

2. `.env` anlegen (z. B. aus dem Dashboard „Download .env“ oder aus dem Beispiel):
```bash
cp .env.example .env
```

3. `.env` mit Werten füllen: `DEVICE_ID`, `SECRET`, `SERVER_URL` (vom Backend-Dashboard). Optional: `ALLOW_SHUTDOWN=true` für Remote-Shutdown.

## Verwendung

### Development
```bash
npm run dev
```

Andere .env-Datei:
```bash
npm run dev -- --config=./.env.staging
```

### Production
```bash
npm run build
npm start
```

## Konfiguration (.env)

| Variable         | Beschreibung |
|------------------|--------------|
| `DEVICE_ID`      | Geräte-ID (vom Dashboard) |
| `SECRET`         | Geheimnis für die WebSocket-Authentifizierung |
| `SERVER_URL`     | Basis-URL des Backends (z. B. `http://localhost:3000`) |
| `ALLOW_SHUTDOWN` | `true` oder `false` – erlaubt Remote-Shutdown nur wenn `true` |

Die WebSocket-URL wird aus `SERVER_URL` abgeleitet (Namespace `/ws`).

## Sicherheit

- **`.env` nicht committen** – sie ist in `.gitignore` und enthält das Secret.
- **ALLOW_SHUTDOWN:** Nur auf `true` setzen, wenn du Remote-Shutdown wirklich erlauben willst.
