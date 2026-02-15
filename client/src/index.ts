import { io, Socket } from 'socket.io-client';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

interface Config {
  deviceId: string;
  secret: string;
  serverUrl: string;
  allowShutdown: boolean;
}

/**
 * Lädt die Konfiguration aus Umgebungsvariablen (z. B. aus .env).
 * --config=./.env oder --env=./.env setzt den Pfad zur .env-Datei (dotenv wird vor main geladen).
 */
function getEnvPath(): string {
  const configArg = process.argv.find(arg => arg.startsWith('--config=') || arg.startsWith('--env='));
  const customPath = configArg ? configArg.split('=')[1] : null;
  if (customPath) {
    return path.resolve(process.cwd(), customPath);
  }
  return path.resolve(process.cwd(), '.env');
}

function loadConfig(): Config {
  // Dotenv wurde bereits in der Import-Phase geladen (siehe loadConfigWithPath in main)
  const deviceId = process.env.DEVICE_ID;
  const secret = process.env.SECRET;
  const serverUrl = process.env.SERVER_URL;

  if (!deviceId || !secret || !serverUrl) {
    console.error('❌ Fehlende Konfiguration. Setze DEVICE_ID, SECRET und SERVER_URL (z. B. in .env).');
    process.exit(1);
  }

  const allowShutdown = process.env.ALLOW_SHUTDOWN === 'true' || process.env.ALLOW_SHUTDOWN === '1';

  return {
    deviceId,
    secret,
    serverUrl: serverUrl.replace(/\/$/, ''),
    allowShutdown,
  };
}

/**
 * Führt den System-Shutdown je nach Betriebssystem aus
 */
function shutdown(): Promise<void> {
  const platform = process.platform;
  console.log(`🔄 System-Shutdown wird eingeleitet (${platform})...`);

  return new Promise((resolve, reject) => {
    let command: string;

    switch (platform) {
      case 'win32':
        command = 'shutdown /s /t 0';
        break;
      case 'darwin':
      case 'linux':
        command = 'sudo shutdown -h now';
        break;
      default:
        reject(new Error(`Nicht unterstütztes Betriebssystem: ${platform}`));
        return;
    }

    exec(command, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function main() {
  const envPath = getEnvPath();
  if (!fs.existsSync(envPath)) {
    console.error(`❌ Konfigurationsdatei nicht gefunden: ${envPath}`);
    console.error('   Kopiere client/.env.example nach client/.env und trage DEVICE_ID, SECRET und SERVER_URL ein.');
    process.exit(1);
  }
  const dotenv = await import('dotenv');
  dotenv.config({ path: envPath });
  console.log(`🔍 Lade Konfiguration von: ${envPath}`);

  const config = loadConfig();

  console.log('🚀 Wake-on-LAN Client wird gestartet...');
  console.log(`🆔 Device ID: ${config.deviceId}`);
  console.log(`📡 Server:    ${config.serverUrl}`);
  console.log(`🔗 Namespace: /ws  (Pfad: /socket.io)`);

  const socket: Socket = io(`${config.serverUrl}/ws`, {
    path: '/socket.io',
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: Infinity,
    forceNew: true
  });

  socket.on('connect_error', (err: any) => {
    console.error('❌ Verbindungsfehler Details:');
    console.error(`   - Nachricht: ${err.message}`);
    if (err.description) console.error(`   - Beschreibung: ${err.description}`);
    if (err.context) console.error(`   - Kontext: ${JSON.stringify(err.context)}`);
    if (err.message?.includes('CERT_')) {
      console.error('   - Hinweis: Es gibt ein Problem mit dem SSL-Zertifikat!');
    }
  });

  socket.on('error', (err: any) => {
    console.error('❌ Socket-Fehler:', err);
  });

  socket.io.on('error', (err) => {
    console.error('❌ Transport-Layer Fehler:', err);
  });

  socket.on('connect', () => {
    console.log('✅ Mit Server verbunden. Authentifizierung läuft...');
    socket.emit('authenticate', {
      deviceId: config.deviceId,
      secret: config.secret,
    });
  });

  socket.on('authenticated', (data: { deviceId: string }) => {
    console.log(`✅ Authentifiziert als Gerät: ${data.deviceId}`);
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat', { deviceId: config.deviceId });
      }
    }, 30000);
    socket.on('disconnect', () => clearInterval(heartbeatInterval));
  });

  socket.on('shutdown', async (data: { deviceId: string }) => {
    if (data.deviceId !== config.deviceId) return;

    console.log('⚠️ Shutdown-Befehl empfangen!');

    if (!config.allowShutdown) {
      console.log('❌ Shutdown abgebrochen: Deaktiviert in .env (ALLOW_SHUTDOWN)');
      socket.emit('shutdown-ack', { deviceId: config.deviceId, status: 'disabled' });
      return;
    }

    try {
      socket.emit('shutdown-ack', { deviceId: config.deviceId, status: 'executing' });
      await shutdown();
    } catch (error: any) {
      console.error('❌ Shutdown-Fehler:', error?.message || error);
    }
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Verbindungsfehler:', error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log(`⚠️ Verbindung getrennt: ${reason}`);
  });

  const cleanup = () => {
    console.log('\n🛑 Client wird beendet...');
    socket.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((error) => {
  console.error('❌ Fataler Fehler im Hauptprozess:', error);
  process.exit(1);
});
