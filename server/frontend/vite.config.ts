import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Single source of truth: `server/.env` (next to this app folder). */
const envDir = path.resolve(__dirname, '..');

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, envDir, '');
  const backendUrl = (
    process.env.BACKEND_URL ||
    fileEnv.BACKEND_URL ||
    ''
  ).trim();

  if (!backendUrl) {
    throw new Error(
      `BACKEND_URL is not set. Define it in ${path.join(envDir, '.env')} (see server/.env.example) or export it in the shell.`,
    );
  }
  let resolvedBackend: string;
  try {
    const parsed = new URL(backendUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('unsupported protocol');
    }
    resolvedBackend = backendUrl.replace(/\/$/, '');
  } catch {
    throw new Error(`BACKEND_URL is invalid: "${backendUrl}". Expected full URL like http://localhost:6010`);
  }

  const frontendPortRaw = (
    process.env.FRONTEND_PORT ||
    process.env.PORT ||
    fileEnv.FRONTEND_PORT ||
    ''
  ).trim();
  if (!frontendPortRaw) {
    throw new Error(
      `FRONTEND_PORT is not set. Define it in ${path.join(envDir, '.env')} (see server/.env.example) or export it in the shell.`,
    );
  }
  const frontendPort = Number.parseInt(frontendPortRaw, 10);
  if (!Number.isInteger(frontendPort) || frontendPort < 1 || frontendPort > 65535) {
    throw new Error(`FRONTEND_PORT is invalid: "${frontendPortRaw}". Expected integer between 1 and 65535.`);
  }

  const proxy = {
    '/api': {
      target: resolvedBackend,
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/api/, ''),
    },
    '/socket.io': {
      target: resolvedBackend,
      changeOrigin: true,
      ws: true,
    },
  };

  return {
    plugins: [react()],
    server: {
      host: true,
      port: frontendPort,
      strictPort: true,
      proxy,
    },
    preview: {
      host: true,
      port: frontendPort,
      strictPort: true,
      proxy,
    },
  };
});
