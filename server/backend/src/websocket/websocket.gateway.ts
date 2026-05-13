import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceMode, DeviceStatus, LogType } from '../types/enums';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  deviceId?: string;
}

@WSGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
  namespace: '/ws',
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGateway.name);
  private activeClients = new Map<string, string>(); // deviceId -> socketId

  constructor(private prisma: PrismaService) {}

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client attempting to connect: ${client.id}`);
    // Authentication will be handled via 'authenticate' message
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    if (client.deviceId) {
      this.activeClients.delete(client.deviceId);
      
      // Update device status (only for ACTIVE mode devices)
      const updated = await this.updateDeviceStatus(client.deviceId, DeviceStatus.OFFLINE);
      
      // Log disconnection
      await this.prisma.log.create({
        data: {
          type: LogType.CLIENT_DISCONNECTED,
          message: `Device ${client.deviceId} disconnected`,
          deviceId: client.deviceId,
          userId: client.userId || '',
        },
      });
      
      // Notify all clients about status change
      if (updated) {
        this.server.emit('device-status-changed', {
          deviceId: client.deviceId,
          status: DeviceStatus.OFFLINE,
        });
      }
    }
  }

  @SubscribeMessage('authenticate')
  async handleAuthenticate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { deviceId: string; secret: string },
  ) {
    try {
      if (!data.deviceId || !data.secret) {
        client.emit('error', { message: 'Missing deviceId or secret' });
        client.disconnect();
        return;
      }

      // This is an active client connecting
      const device = await this.prisma.device.findUnique({
        where: { id: data.deviceId },
      });

      if (!device) {
        client.emit('error', { message: 'Device not found' });
        client.disconnect();
        return;
      }

      if (device.mode !== DeviceMode.ACTIVE) {
        client.emit('error', { message: 'Device is not in ACTIVE mode' });
        client.disconnect();
        return;
      }

      // Verify secret
      if (device.secret !== data.secret) {
        client.emit('error', { message: 'Invalid secret' });
        client.disconnect();
        return;
      }

      client.deviceId = device.id;
      client.userId = device.userId;
      this.activeClients.set(device.id, client.id);

      // Update device status
      const updated = await this.updateDeviceStatus(device.id, DeviceStatus.ONLINE);

      // Log connection
      await this.prisma.log.create({
        data: {
          type: LogType.CLIENT_CONNECTED,
          message: `Device ${device.name} connected`,
          deviceId: device.id,
          userId: device.userId,
        },
      });

      // Notify all clients
      if (updated) {
        this.server.emit('device-status-changed', {
          deviceId: device.id,
          status: DeviceStatus.ONLINE,
        });
      }

      client.emit('authenticated', { deviceId: device.id });
      this.logger.log(`Active client authenticated: ${device.name} (${device.id})`);
    } catch (error) {
      this.logger.error(`Authentication error: ${error.message}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  @SubscribeMessage('shutdown-ack')
  async handleShutdownAck(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { deviceId: string },
  ) {
    if (!client.deviceId || client.deviceId !== data.deviceId) {
      return;
    }

    this.logger.log(`Shutdown acknowledged by device: ${data.deviceId}`);
    
    // Update device status
    const updated = await this.updateDeviceStatus(data.deviceId, DeviceStatus.OFFLINE);
    
    // Notify all clients
    if (updated) {
      this.server.emit('device-status-changed', {
        deviceId: data.deviceId,
        status: DeviceStatus.OFFLINE,
      });
    }
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { deviceId: string },
  ) {
    if (client.deviceId && data.deviceId === client.deviceId) {
      await this.updateDeviceStatus(client.deviceId, DeviceStatus.ONLINE);
    }
  }

  async sendShutdownCommand(deviceId: string): Promise<boolean> {
    if (!this.server) {
      this.logger.warn('WebSocket namespace server not ready');
      return false;
    }
    const socketId = this.activeClients.get(deviceId);
    if (!socketId) {
      return false;
    }
    this.server.to(socketId).emit('shutdown', { deviceId });
    this.logger.log(`Shutdown command sent to device: ${deviceId}`);
    return true;
  }

  private async updateDeviceStatus(deviceId: string, status: DeviceStatus): Promise<boolean> {
    try {
      const device = await this.prisma.device.findUnique({
        where: { id: deviceId },
        select: { mode: true },
      });
      if (!device || device.mode !== DeviceMode.ACTIVE) {
        return false;
      }
      await this.prisma.device.update({
        where: { id: deviceId },
        data: {
          status: status,
          lastSeen: new Date(),
        },
      });
      return true;
    } catch (error) {
      this.logger.error(`Error updating device status: ${error.message}`);
      return false;
    }
  }

  getActiveClientSocketId(deviceId: string): string | undefined {
    return this.activeClients.get(deviceId);
  }
}
