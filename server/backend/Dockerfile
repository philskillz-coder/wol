FROM node:20-slim AS builder
WORKDIR /app

# Argumente setzen
ARG BACKEND_URL=http://127.0.0.1:6010
ARG FRONTEND_PORT=6020
ENV BACKEND_URL=$BACKEND_URL
ENV FRONTEND_PORT=$FRONTEND_PORT

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app

ARG FRONTEND_PORT=6020
ENV NODE_ENV=production
ENV FRONTEND_PORT=$FRONTEND_PORT

# Wir kopieren die node_modules vom Builder, damit alle Plugins 
# für die vite.config.ts vorhanden sind.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/vite.config.ts ./
COPY --from=builder /app/tsconfig.json ./

EXPOSE $FRONTEND_PORT

CMD ["sh", "-c", "npx vite preview --host 0.0.0.0 --port ${FRONTEND_PORT}"]