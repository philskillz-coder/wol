import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Single source of truth: `.env` im übergeordneten Ordner */
const envDir = path.resolve(__dirname, '..');

export default defineConfig(({ mode }) => {
  // Lädt die .env aus dem Root-Ordner
  const fileEnv = loadEnv(mode, envDir, '');

  // 1. Backend URL validieren
  const backendUrl = (
    process.env.BACKEND_URL ||
    fileEnv.BACKEND_URL ||
    ''
  ).trim();

  if (!backendUrl) {
    throw new Error(
      `BACKEND_URL is not set. Define it in ${path.join(envDir, '.env')} or export it in the shell.`,
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

  // 2. Frontend Port validieren
  const frontendPortRaw = (
    process.env.FRONTEND_PORT ||
    process.env.PORT ||
    fileEnv.FRONTEND_PORT ||
    '6020'
  ).trim();

  const frontendPort = Number.parseInt(frontendPortRaw, 10);
  if (!Number.isInteger(frontendPort) || frontendPort < 1 || frontendPort > 65535) {
    throw new Error(`FRONTEND_PORT is invalid: "${frontendPortRaw}". Expected integer between 1 and 65535.`);
  }

  // 3. Proxy Konfiguration für lokale Entwicklung
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
    
    // Macht die Variablen im Frontend-Code (z.B. App.tsx) verfügbar
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify('/api'),
      'import.meta.env.VITE_WS_NAMESPACE': JSON.stringify('/ws'),
    },

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
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});