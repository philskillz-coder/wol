FROM node:20-slim AS builder
WORKDIR /app

ARG BACKEND_URL
ARG FRONTEND_PORT
ENV BACKEND_URL=$BACKEND_URL
ENV FRONTEND_PORT=$FRONTEND_PORT

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app

ARG FRONTEND_PORT
ENV NODE_ENV=production
ENV FRONTEND_PORT=$FRONTEND_PORT

COPY package*.json ./
RUN npm install

COPY vite.config.ts tsconfig.json tsconfig.node.json index.html ./
COPY --from=builder /app/dist ./dist

EXPOSE 6020

# Same proxy as dev: /api and WebSocket to BACKEND_URL (from container env_file at runtime).
CMD ["sh", "-c", "npx vite preview --host 0.0.0.0 --port ${FRONTEND_PORT}"]
