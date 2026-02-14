# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Erzeugt den /dist Ordner
RUN npm run build

# Stage 2: Runtime
FROM node:20-slim

# 'serve' global installieren, um die Dateien auszuliefern
RUN npm install -g serve

WORKDIR /app

# Nur den gebauten dist-Ordner kopieren
COPY --from=builder /app/dist ./dist

# Startet den Server auf dem Port, der in der zentralen .env definiert wurde
# Shell-Form ist wichtig, damit $PORT korrekt aufgelöst wird
CMD serve -s dist -l $PORT