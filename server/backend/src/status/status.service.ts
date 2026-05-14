import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { DeviceMode, DeviceStatus, LogType } from '../types/enums';
import * as ping from 'ping';

@Injectable()
export class StatusService {
  private readonly logger = new Logger(StatusService.name);
  private pingIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private prisma: PrismaService,
    private wsGateway: WebSocketGateway,
  ) {
    // Start monitoring passive devices
    this.startPassiveMonitoring();
  }

  private async startPassiveMonitoring() {
    // Check every 30 seconds
    setInterval(async () => {
      await this.checkPassiveDevices();
    }, 30000);

    // Initial check
    await this.checkPassiveDevices();
  }

  private async checkPassiveDevices() {
    const passiveDevices = await this.prisma.device.findMany({
      where: {
        mode: DeviceMode.PASSIVE,
        ipAddress: { not: null },
      },
    });

    for (const device of passiveDevices) {
      if (!device.ipAddress) continue;

      try {
        const res = await ping.promise.probe(device.ipAddress, {
          timeout: 5,
        });

        const newStatus = res.alive ? DeviceStatus.ONLINE : DeviceStatus.OFFLINE;
        const currentStatus = device.status;

        if (newStatus !== currentStatus) {
          await this.prisma.device.update({
            where: { id: device.id },
            data: {
              status: newStatus,
              lastSeen: res.alive ? new Date() : device.lastSeen,
            },
          });

          // Notify via WebSocket
          this.wsGateway.server.emit('device-status-changed', {
            deviceId: device.id,
            status: newStatus,
          });

          // Log status change
          await this.prisma.log.create({
            data: {
              type: LogType.STATUS_CHANGED,
              message: `Device ${device.name} status changed to ${newStatus}`,
              deviceId: device.id,
              userId: device.userId,
            },
          });

          this.logger.log(`Device ${device.name} status: ${currentStatus} -> ${newStatus}`);
        } else if (res.alive) {
          // Update lastSeen even if status didn't change
          await this.prisma.device.update({
            where: { id: device.id },
            data: { lastSeen: new Date() },
          });
        }
      } catch (error: any) {
        this.logger.error(`Error pinging device ${device.name}: ${error.message}`);
      }
    }
  }
}
