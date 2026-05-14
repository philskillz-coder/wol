# --- STAGE 1: Der Koch (Build) ---
    FROM node:20-slim AS builder
    WORKDIR /app
    
    # Diese Args brauchen wir, damit Vite sie beim Bauen kennt
    ARG BACKEND_URL
    ARG FRONTEND_PORT
    ENV VITE_BACKEND_URL=$BACKEND_URL
    ENV VITE_FRONTEND_PORT=$FRONTEND_PORT
    
    COPY package*.json ./
    RUN npm install
    COPY . .
    
    # Vite erstellt hier den /dist Ordner
    RUN npm run build
    
    # --- STAGE 2: Der Kellner (Serve) ---
    FROM node:20-slim AS runner
    WORKDIR /app
    
    # Wir installieren NUR serve, um die Dateien stabil auszuliefern
    RUN npm install -g serve
    
    # Wir kopieren NUR den fertigen dist-Ordner vom Koch
    COPY --from=builder /app/dist ./dist
    
    # Port für serve zur Laufzeit
    ARG FRONTEND_PORT
    ENV FRONTEND_PORT=$FRONTEND_PORT
    
    # Serve liefert den dist-Ordner aus
    # -s sorgt dafür, dass React-Routing (SPA) funktioniert
    # -l legt den Port fest
    CMD ["sh", "-c", "serve -s dist -l ${FRONTEND_PORT}"]