import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { AuthService } from '../auth/auth.service';
import { DeviceMode, DeviceStatus, LogType } from '../types/enums';

@Injectable()
export class DevicesService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  async create(
    userId: string,
    createDeviceDto: CreateDeviceDto,
    apiTokenDeviceScope?: string[],
  ) {
    if (apiTokenDeviceScope?.length) {
      throw new ForbiddenException(
        'This API token is limited to specific devices and cannot create new ones',
      );
    }

    const name = createDeviceDto.name.trim();
    if (!name) {
      throw new BadRequestException('Device name is required');
    }
    const existingByName = await this.prisma.device.findFirst({
      where: { userId, name },
      select: { id: true },
    });
    if (existingByName) {
      throw new ConflictException(`A device named "${name}" already exists`);
    }

    const mode = createDeviceDto.mode ?? DeviceMode.PASSIVE;
    if (mode === DeviceMode.PASSIVE && !createDeviceDto.ipAddress?.trim()) {
      throw new BadRequestException(
        'Passive mode requires an IP address for ping-based status',
      );
    }

    const secret = await this.authService.generateDeviceSecret();

    const device = await this.prisma.device.create({
      data: {
        ...createDeviceDto,
        name,
        mode,
        status: DeviceStatus.UNKNOWN,
        lastSeen: null,
        secret,
        userId,
      },
    });

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

  async findAll(userId: string, apiTokenDeviceScope?: string[]) {
    const rows = await this.prisma.device.findMany({
      where: {
        userId,
        ...(apiTokenDeviceScope?.length
          ? { id: { in: apiTokenDeviceScope } }
          : {}),
      },
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
      },
    });

    return rows.map((row) => ({
      ...row,
      passiveStatus:
        row.mode === DeviceMode.PASSIVE ? row.status : DeviceStatus.UNKNOWN,
      activeStatus:
        row.mode === DeviceMode.ACTIVE ? row.status : DeviceStatus.UNKNOWN,
    }));
  }

  async findOne(id: string, userId: string, apiTokenDeviceScope?: string[]) {
    const device = await this.prisma.device.findFirst({
      where: { id, userId },
    });

    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }

    if (apiTokenDeviceScope?.length && !apiTokenDeviceScope.includes(device.id)) {
      throw new ForbiddenException(
        'This API token is not allowed to access this device',
      );
    }

    return device;
  }

  async update(
    id: string,
    userId: string,
    updateDeviceDto: UpdateDeviceDto,
    apiTokenDeviceScope?: string[],
  ) {
    const device = await this.findOne(id, userId, apiTokenDeviceScope);

    const nextName = updateDeviceDto.name?.trim();
    if (updateDeviceDto.name !== undefined && !nextName) {
      throw new BadRequestException('Device name is required');
    }
    if (nextName && nextName !== device.name) {
      const duplicate = await this.prisma.device.findFirst({
        where: { userId, name: nextName, NOT: { id } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException(`A device named "${nextName}" already exists`);
      }
    }

    const nextMode = updateDeviceDto.mode ?? device.mode;
    const nextIp = updateDeviceDto.ipAddress ?? device.ipAddress ?? undefined;
    if (nextMode === DeviceMode.PASSIVE && !String(nextIp || '').trim()) {
      throw new BadRequestException(
        'Passive mode requires an IP address for ping-based status',
      );
    }

    const modeChanged = updateDeviceDto.mode !== undefined && updateDeviceDto.mode !== device.mode;
    const updateData = {
      ...updateDeviceDto,
      ...(updateDeviceDto.name !== undefined ? { name: nextName } : {}),
      ...(modeChanged
        ? { status: DeviceStatus.UNKNOWN, lastSeen: null }
        : {}),
    };

    const updated = await this.prisma.device.update({
      where: { id },
      data: updateData,
    });

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

  async remove(id: string, userId: string, apiTokenDeviceScope?: string[]) {
    const device = await this.findOne(id, userId, apiTokenDeviceScope);

    await this.prisma.device.delete({
      where: { id },
    });

    await this.prisma.log.create({
      data: {
        type: LogType.DEVICE_DELETED,
        message: `Device ${device.name} deleted`,
        userId,
      },
    });

    return { message: 'Device deleted successfully' };
  }

  async generateConfig(
    deviceId: string,
    userId: string,
    apiTokenDeviceScope?: string[],
  ) {
    const device = await this.findOne(deviceId, userId, apiTokenDeviceScope);

    if (device.mode !== DeviceMode.ACTIVE) {
      throw new BadRequestException(
        'Config can only be generated for ACTIVE mode devices',
      );
    }

    return {
      deviceId: device.id,
      secret: device.secret,
      ...this.getDeviceClientUrls(),
    };
  }

  private getDeviceClientUrls(): { serverUrl: string; wsUrl: string } {
    const explicitServer = this.config.get<string>('SERVER_URL')?.trim();
    const backend = (
      explicitServer ||
      this.config.get<string>('BACKEND_URL')?.trim() ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
    const explicitWs = this.config.get<string>('WS_URL')?.trim();
    if (explicitWs) {
      return { serverUrl: backend, wsUrl: explicitWs };
    }
    try {
      const u = new URL(backend);
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return { serverUrl: backend, wsUrl: `${u.origin}/ws` };
    } catch {
      return { serverUrl: backend, wsUrl: 'ws://127.0.0.1:3000/ws' };
    }
  }

  async regenerateSecret(
    deviceId: string,
    userId: string,
    apiTokenDeviceScope?: string[],
  ): Promise<{ secret: string }> {
    const device = await this.findOne(deviceId, userId, apiTokenDeviceScope);

    if (device.mode !== DeviceMode.ACTIVE) {
      throw new BadRequestException(
        'Secret can only be regenerated for ACTIVE mode devices',
      );
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
