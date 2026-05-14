import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { DeviceMode, LogType } from '../types/enums';
import * as wol from 'wake_on_lan';

@Injectable()
export class WolService {
  private readonly logger = new Logger(WolService.name);

  constructor(
    private prisma: PrismaService,
    private wsGateway: WebSocketGateway,
  ) {}

  async wakeDevice(
    deviceId: string,
    userId: string,
    apiTokenDeviceScope?: string[],
  ): Promise<boolean> {
    if (apiTokenDeviceScope?.length && !apiTokenDeviceScope.includes(deviceId)) {
      throw new ForbiddenException(
        'This API token is not allowed to access this device',
      );
    }

    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, userId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    try {
      await new Promise<void>((resolve, reject) => {
        wol.wake(device.macAddress, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.logger.log(`Magic packet sent to ${device.name} (${device.macAddress})`);

      await this.prisma.log.create({
        data: {
          type: LogType.WAKE_SENT,
          message: `Wake signal sent to ${device.name}`,
          deviceId: device.id,
          userId,
        },
      });

      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send magic packet: ${error.message}`);

      await this.prisma.log.create({
        data: {
          type: LogType.ERROR,
          message: `Failed to wake device ${device.name}: ${error.message}`,
          deviceId: device.id,
          userId,
        },
      });

      throw error;
    }
  }

  async shutdownDevice(
    deviceId: string,
    userId: string,
    apiTokenDeviceScope?: string[],
  ): Promise<boolean> {
    if (apiTokenDeviceScope?.length && !apiTokenDeviceScope.includes(deviceId)) {
      throw new ForbiddenException(
        'This API token is not allowed to access this device',
      );
    }

    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, userId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (device.mode !== DeviceMode.ACTIVE) {
      throw new BadRequestException(
        'Shutdown is only available for ACTIVE mode devices',
      );
    }

    const success = await this.wsGateway.sendShutdownCommand(deviceId);

    if (success) {
      await this.prisma.log.create({
        data: {
          type: LogType.SHUTDOWN_SENT,
          message: `Shutdown command sent to ${device.name}`,
          deviceId: device.id,
          userId,
        },
      });
    }

    return success;
  }
}
