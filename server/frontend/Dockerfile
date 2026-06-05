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
    
    # --- STAGE 2: Static files + API/WS proxy ---
    FROM node:20-slim AS runner
    WORKDIR /app

    COPY package*.json ./
    RUN npm install --omit=dev

    COPY --from=builder /app/dist ./dist
    COPY server.mjs ./

    ARG FRONTEND_PORT
    ENV FRONTEND_PORT=$FRONTEND_PORT

    CMD ["node", "server.mjs"]