import { io, Socket } from 'socket.io-client';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

interface Config {
  deviceId: string;
  secret: string;
  serverUrl: string;
  wsUrl: string;
  allowShutdown: boolean;
}

/**
 * Lädt die Konfiguration aus der config.json im Root-Verzeichnis
 */
function loadConfig(): Config {
  // 1. Prüfe, ob ein Pfad als Argument übergeben wurde (z.B. --config=./my-config.json)
  const configArg = process.argv.find(arg => arg.startsWith('--config='));
  const customPath = configArg ? configArg.split('=')[1] : null;

  // 2. Bestimme den finalen Pfad (absolut)
  const configPath = customPath 
    ? path.resolve(process.cwd(), customPath) 
    : path.join(__dirname, '../config.json');

  console.log(`🔍 Lade Konfiguration von: ${configPath}`);

  if (!fs.existsSync(configPath)) {
    console.error(`❌ Konfiguration unter ${configPath} nicht gefunden!`);
    process.exit(1);
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent) as Config;
    
    // Validierung bleibt gleich...
    return config;
  } catch (error: any) {
    console.error('❌ Fehler beim Laden der Datei:', error?.message || error);
    process.exit(1);
  }
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
  const config = loadConfig();
  
  // Socket.IO verbindet zur Namespace /ws; Engine.IO-Handshake läuft über /socket.io (Server-Standard)
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

  // --- DETAILLIERTES ERROR LOGGING ---

  // Standard Verbindungsfehler
  socket.on('connect_error', (err: any) => {
    console.error('❌ Verbindungsfehler Details:');
    console.error(`   - Nachricht: ${err.message}`);
    // Zeigt zusätzliche Details vom Server (z.B. Proxy-Errors oder Header-Probleme)
    if (err.description) console.error(`   - Beschreibung: ${err.description}`);
    if (err.context) console.error(`   - Kontext: ${JSON.stringify(err.context)}`);
    
    // Prüfe auf SSL/Zertifikatsprobleme
    if (err.message?.includes('CERT_')) {
      console.error('   - Hinweis: Es gibt ein Problem mit dem SSL-Zertifikat!');
    }
  });

  // Fehler während der bestehenden Verbindung
  socket.on('error', (err: any) => {
    console.error('❌ Socket-Fehler:', err);
  });

  // Fehler beim Transport (Engine.io Ebene)
  socket.io.on("error", (err) => {
    console.error('❌ Transport-Layer Fehler:', err);
  });

  // --- RESTLICHE LOGIK ---

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
      console.log('❌ Shutdown abgebrochen: Deaktiviert in config.json');
      socket.emit('shutdown-ack', { deviceId: config.deviceId, status: 'disabled' });
      return;
    }

    try {
      // Bestätigung an Server senden, bevor das System ausgeht
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

  // Graceful Shutdown des Client-Prozesses (z.B. bei STRG+C)
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