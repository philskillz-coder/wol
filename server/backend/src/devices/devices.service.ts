import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { AuthService } from '../auth/auth.service';
import { DeviceMode, LogType } from '../types/enums';

@Injectable()
export class DevicesService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async create(userId: string, createDeviceDto: CreateDeviceDto) {
    const secret = await this.authService.generateDeviceSecret();

    const device = await this.prisma.device.create({
      data: {
        ...createDeviceDto,
        secret,
        userId,
      },
    });

    // Log device creation
    await this.prisma.log.create({
      data: {
        type: LogType.DEVICE_CREATED,
        message: `Device ${device.name} created`,
        deviceId: device.id,
        userId,
      },
    });

    return device;
  }

  async findAll(userId: string) {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        macAddress: true,
        ipAddress: true,
        mode: true,
        status: true,
        lastSeen: true,
        createdAt: true,
        updatedAt: true,
        // Don't expose secret in list
      },
    });
  }

  async findOne(id: string, userId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id, userId },
    });

    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }

    return device;
  }

  async update(id: string, userId: string, updateDeviceDto: UpdateDeviceDto) {
    const device = await this.findOne(id, userId);

    const updated = await this.prisma.device.update({
      where: { id },
      data: updateDeviceDto,
    });

    // Log device update
    await this.prisma.log.create({
      data: {
        type: LogType.DEVICE_UPDATED,
        message: `Device ${device.name} updated`,
        deviceId: device.id,
        userId,
      },
    });

    return updated;
  }

  async remove(id: string, userId: string) {
    const device = await this.findOne(id, userId);

    await this.prisma.device.delete({
      where: { id },
    });

    // Log device deletion
    await this.prisma.log.create({
      data: {
        type: LogType.DEVICE_DELETED,
        message: `Device ${device.name} deleted`,
        userId,
      },
    });

    return { message: 'Device deleted successfully' };
  }

  async generateConfig(deviceId: string, userId: string) {
    const device = await this.findOne(deviceId, userId);

    if (device.mode !== DeviceMode.ACTIVE) {
      throw new Error('Config can only be generated for ACTIVE mode devices');
    }

    return {
      deviceId: device.id,
      secret: device.secret,
      serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
      wsUrl: process.env.WS_URL || 'ws://localhost:3000/ws',
    };
  }

  async regenerateSecret(deviceId: string, userId: string): Promise<{ secret: string }> {
    const device = await this.findOne(deviceId, userId);

    if (device.mode !== DeviceMode.ACTIVE) {
      throw new Error('Secret can only be regenerated for ACTIVE mode devices');
    }

    const secret = await this.authService.generateDeviceSecret();

    await this.prisma.device.update({
      where: { id: deviceId },
      data: { secret },
    });

    await this.prisma.log.create({
      data: {
        type: LogType.DEVICE_UPDATED,
        message: `Device ${device.name} secret regenerated`,
        deviceId: device.id,
        userId,
      },
    });

    return { secret };
  }
}
