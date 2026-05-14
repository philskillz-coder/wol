# Wake-on-LAN Management System

Ein Fullstack-System zur Verwaltung von Wake-on-LAN-Geräten mit Echtzeit-Statusüberwachung über WebSocket. Enthält **bereits eine Docker-Konfiguration** für Backend und Frontend.

---

## Inhaltsverzeichnis

- [Projektstruktur](#projektstruktur)
- [Tech-Stack](#tech-stack)
- [Features](#features)
- [Voraussetzungen](#voraussetzungen)
- [Setup (lokal)](#setup-lokal)
- [Docker](#docker)
- [API-Token](#api-token)
- [Sicherheit](#sicherheit)

---

## Projektstruktur

```
wol/
├── server/
│   ├── backend/          # NestJS API, Prisma, Socket.IO, OAuth2
│   ├── frontend/         # React (Vite) Dashboard
│   └── docker-compose.yml
├── client/               # Eigenständiger Client für aktive Geräte (WebSocket)
├── package.json          # Monorepo (workspaces)
└── README.md
```

---

## Tech-Stack

| Bereich    | Technologien |
| ---------- | ------------ |
| **Backend** | NestJS, Prisma ORM, SQLite, Socket.IO |
| **Frontend** | React (Vite), Tailwind CSS, Socket.IO Client |
| **Client** | TypeScript, Socket.IO Client |
| **Auth** | OAuth2 via **Authentik**, JWT, API-Tokens (Bearer) |

---

## Features

### Backend
- OAuth2-Login über **Authentik**
- API-Tokens (CRUD, Bearer-Auth für WoL-Endpunkte)
- Geräte-Verwaltung (CRUD), Modi: passiv (Ping) / aktiv (WebSocket)
- Wake-on-LAN (Magic Packet)
- WebSocket-Namespace `/ws` für aktive Clients
- Remote-Shutdown für aktive Clients
- Echtzeit-Events: `device-status-changed` fürs Frontend

### Frontend
- Login mit Authentik
- Dashboard mit Geräteliste, Wake/Shutdown, Config-Download
- Live-Updates per WebSocket bei Verbindung/Trennung von Geräten
- API-Token-Verwaltung

### Client (aktiv)
- WebSocket-Verbindung zum Backend (Namespace `/ws`)
- Authentifizierung mit Device-ID und Secret
- Optionale Ausführung von System-Shutdown (`ALLOW_SHUTDOWN` in `.env`)

---

## Voraussetzungen

- **Node.js** 20+
- **npm** (Workspaces)
- Optional: **Docker** und **Docker Compose** für Container-Betrieb

---

## Setup (lokal)

### 1. Abhängigkeiten installieren

```bash
cd server
npm install
npm --prefix backend install
npm --prefix frontend install
```

### 2. Backend konfigurieren

```bash
cd server
cp .env.example .env
# .env anpassen: Ports/URLs + Authentik + Secrets
```

### 3. Datenbank

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Backend starten

```bash
cd server
npm run dev:backend
# API: BACKEND_URL aus server/.env
```

### 5. Frontend starten

```bash
cd server
npm run dev:frontend
# UI: FRONTEND_URL aus server/.env
```

### 6. Optional: Alles gemeinsam

```bash
cd server
npm run dev
# Backend + Frontend parallel
```

### 7. Client (aktives Gerät)

```bash
cd client
cp .env.example .env
# .env: DEVICE_ID, SECRET, SERVER_URL (vom Dashboard „Download .env“), ALLOW_SHUTDOWN
npm run dev
# Andere .env-Datei: npm run dev -- --config=./.env.production
```

---

## Docker

Das Projekt enthält eine **fertige Docker-Konfiguration** für Backend und Frontend.

- **Backend:** `server/backend/Dockerfile` (Multi-Stage, Prisma Migrate beim Start)
- **Frontend:** `server/frontend/Dockerfile` (Build, dann `serve`)
- **Orchestrierung:** `server/docker-compose.yml`

### Start mit Docker Compose

```bash
cd server
# .env muss existieren (z. B. aus .env.example)
docker compose up -d
```

Umgebungsvariablen:
- Backend: `BACKEND_PORT`, `BACKEND_URL`, `FRONTEND_URL`
- Frontend: `FRONTEND_PORT`, `BACKEND_URL`

Beide Services nutzen Port-Mappings aus `server/.env` (`BACKEND_PORT`, `FRONTEND_PORT`).

### Nur Backend bauen

```bash
cd server/backend
docker build -t wol-backend .
docker run --env-file .env -p 3000:3000 wol-backend
```

---

## API-Token

Im Dashboard einen API-Token anlegen und für Aufrufe nutzen:

```bash
# Gerät wecken
curl -X POST http://localhost:3000/wol/{deviceId}/wake \
  -H "Authorization: Bearer wol_dein_token"
```

---

## Sicherheit

- **Client-Shutdown:** Nur wenn in der lokalen `.env` des Clients `ALLOW_SHUTDOWN=true` gesetzt ist.
- **API-Tokens:** Werden gehasht gespeichert; Authentifizierung per Bearer-Header.
- **Device-Secrets:** Pro Gerät (aktiv); werden für die WebSocket-Authentifizierung verwendet.
- **OAuth2:** Login nur über Authentik; JWT für die Web-API.
