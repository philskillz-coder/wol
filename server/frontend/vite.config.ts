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

  const resolvedBackend =
    backendUrl ||
    (mode === 'production' ? 'http://127.0.0.1:6010' : '');

  if (!resolvedBackend) {
    throw new Error(
      `BACKEND_URL is not set. Define it in ${path.join(envDir, '.env')} (see server/.env.example) or export it in the shell.`,
    );
  }

  const frontendPort = parseInt(
    process.env.FRONTEND_PORT ||
      process.env.PORT ||
      fileEnv.FRONTEND_PORT ||
      '5173',
    10,
  );

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
