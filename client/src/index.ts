import { io, Socket } from 'socket.io-client';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

interface Config {
    deviceId: string;
    secret: string;
    serverUrl: string; // Basis: https://wol.theskz.dev/api
    allowShutdown: boolean;
}

function getEnvPath(): string {
    const configArg = process.argv.find(arg => arg.startsWith('--config=') || arg.startsWith('--env='));
    const customPath = configArg ? configArg.split('=')[1] : null;
    return customPath ? path.resolve(process.cwd(), customPath) : path.resolve(process.cwd(), '.env');
}

function loadConfig(): Config {
    const deviceId = process.env.DEVICE_ID;
    const secret = process.env.SECRET;
    const serverUrl = process.env.SERVER_URL;

    if (!deviceId || !secret || !serverUrl) {
        console.error('❌ Kritische Konfiguration fehlt (DEVICE_ID, SECRET, SERVER_URL).');
        process.exit(1);
    }

    return {
        deviceId,
        secret,
        serverUrl: serverUrl.replace(/\/$/, ''), // Trailing Slash entfernen
        allowShutdown: process.env.ALLOW_SHUTDOWN === 'true' || process.env.ALLOW_SHUTDOWN === '1',
    };
}

function shutdown(): Promise<void> {
    const platform = process.platform;
    return new Promise((resolve, reject) => {
        let command: string;
        switch (platform) {
            case 'win32': command = 'shutdown /s /t 0'; break;
            case 'darwin':
            case 'linux': command = 'sudo shutdown -h now'; break;
            default: return reject(new Error(`Nicht unterstütztes OS: ${platform}`));
        }
        exec(command, (error) => error ? reject(error) : resolve());
    });
}

async function main() {
    const envPath = getEnvPath();
    if (!fs.existsSync(envPath)) {
        console.error(`❌ Konfigurationsdatei nicht gefunden: ${envPath}`);
        process.exit(1);
    }

    const dotenv = await import('dotenv');
    dotenv.config({ path: envPath });

    const config = loadConfig();
    const url = new URL(config.serverUrl);

    // AUTO-KONSTRUKTION
    // wsUrl: Nimmt die Domain und hängt den festen Namespace /ws an (z.B. https://wol.theskz.dev/ws)
    const wsUrl = `${url.origin}/ws`;
    // wsPath: Nimmt den Pfad (z.B. /api) und hängt /socket.io an
    const wsPath = `${url.pathname}/socket.io`.replace(/\/+/, '/');

    console.log('🚀 Wake-on-LAN Client wird gestartet...');
    console.log(`🆔 Device ID:  ${config.deviceId}`);
    console.log(`🔗 Server-Url: ${url}`);
    console.log(` > WS-Host:  ${wsUrl}`);
    console.log(` > WS-Path: ${wsPath}`);

    const socket: Socket = io(wsUrl, {
        path: wsPath,
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: Infinity,
        forceNew: true
    });

    socket.on('connect', () => {
        console.log('✅ Verbunden. Authentifizierung...');
        socket.emit('authenticate', {
            deviceId: config.deviceId,
            secret: config.secret,
        });
    });

    socket.on('authenticated', (data: { deviceId: string }) => {
        console.log(`✅ Authentifiziert als: ${data.deviceId}`);
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
            console.log('❌ Shutdown deaktiviert (ALLOW_SHUTDOWN=false)');
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

    socket.on('connect_error', (err: any) => {
        console.error(`❌ Verbindungsfehler: ${err.message}`);
    });

    socket.on('error', (data: any) => {
        console.error('⚠️ Server-Fehler erhalten:', data.message || data);
    });

    socket.on('disconnect', (reason) => {
        console.log(`⚠️ Verbindung getrennt: ${reason}`);
        if (reason === "io server disconnect") {
            console.error("❌ Der Server hat die Verbindung aktiv beendet. Prüfe Device-Status (ACTIVE?) und Secret.");
        }
    });

    const cleanup = () => {
        socket.disconnect();
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

main().catch((error) => {
    console.error('❌ Fataler Fehler:', error);
    process.exit(1);
});