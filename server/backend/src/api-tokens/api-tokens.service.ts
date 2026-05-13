import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { UpdateApiTokenDto } from './dto/update-api-token.dto';
import { ValidatedApiToken } from './api-token-auth.types';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ApiTokensService {
  constructor(private prisma: PrismaService) {}

  private async assertDevicesBelongToUser(userId: string, deviceIds: string[]): Promise<void> {
    const unique = [...new Set(deviceIds)];
    if (unique.length === 0) {
      return;
    }
    const count = await this.prisma.device.count({
      where: { userId, id: { in: unique } },
    });
    if (count !== unique.length) {
      throw new BadRequestException('One or more device IDs are invalid or not owned by you');
    }
  }

  async create(userId: string, createApiTokenDto: CreateApiTokenDto) {
    const deviceIds = createApiTokenDto.deviceIds?.filter(Boolean) ?? [];
    if (deviceIds.length) {
      await this.assertDevicesBelongToUser(userId, deviceIds);
    }

    const plainToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(plainToken, 10);

    const token = await this.prisma.apiToken.create({
      data: {
        name: createApiTokenDto.name,
        token: hashedToken,
        userId,
        expiresAt: createApiTokenDto.expiresAt,
        ...(deviceIds.length
          ? {
              allowedDevices: {
                create: deviceIds.map((deviceId) => ({ deviceId })),
              },
            }
          : {}),
      },
    });

    return {
      id: token.id,
      name: token.name,
      token: `wol_${plainToken}`,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      deviceIds: deviceIds.length ? deviceIds : undefined,
    };
  }

  async findAll(userId: string) {
    const rows = await this.prisma.apiToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
        allowedDevices: { select: { deviceId: true } },
      },
    });
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      lastUsedAt: t.lastUsedAt,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
      deviceIds:
        t.allowedDevices.length > 0
          ? t.allowedDevices.map((d) => d.deviceId)
          : undefined,
    }));
  }

  async update(id: string, userId: string, dto: UpdateApiTokenDto) {
    const token = await this.prisma.apiToken.findFirst({
      where: { id, userId },
    });

    if (!token) {
      throw new NotFoundException(`API Token with ID ${id} not found`);
    }

    if (
      dto.name === undefined &&
      dto.deviceIds === undefined &&
      dto.expiresAt === undefined
    ) {
      throw new BadRequestException('No fields to update');
    }

    if (dto.deviceIds !== undefined) {
      const deviceIds = dto.deviceIds.filter(Boolean);
      if (deviceIds.length) {
        await this.assertDevicesBelongToUser(userId, deviceIds);
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.apiTokenDevice.deleteMany({ where: { apiTokenId: id } });
        if (deviceIds.length) {
          await tx.apiTokenDevice.createMany({
            data: deviceIds.map((deviceId) => ({ apiTokenId: id, deviceId })),
          });
        }
      });
    }

    if (dto.name !== undefined) {
      await this.prisma.apiToken.update({
        where: { id },
        data: { name: dto.name },
      });
    }

    if (dto.expiresAt !== undefined) {
      await this.prisma.apiToken.update({
        where: { id },
        data: { expiresAt: dto.expiresAt },
      });
    }

    const row = await this.prisma.apiToken.findFirst({
      where: { id, userId },
      select: {
        id: true,
        name: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
        allowedDevices: { select: { deviceId: true } },
      },
    });

    if (!row) {
      throw new NotFoundException(`API Token with ID ${id} not found`);
    }

    return {
      id: row.id,
      name: row.name,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      deviceIds:
        row.allowedDevices.length > 0
          ? row.allowedDevices.map((d) => d.deviceId)
          : undefined,
    };
  }

  async remove(id: string, userId: string) {
    const token = await this.prisma.apiToken.findFirst({
      where: { id, userId },
    });

    if (!token) {
      throw new NotFoundException(`API Token with ID ${id} not found`);
    }

    await this.prisma.apiToken.delete({
      where: { id },
    });

    return { message: 'API Token deleted successfully' };
  }

  async validateToken(bearerToken: string): Promise<ValidatedApiToken> {
    const plainToken = bearerToken.startsWith('wol_')
      ? bearerToken.substring(4)
      : bearerToken;

    const now = new Date();
    const tokens = await this.prisma.apiToken.findMany({
      where: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        user: true,
        allowedDevices: { select: { deviceId: true } },
      },
    });

    for (const token of tokens) {
      const isValid = await bcrypt.compare(plainToken, token.token);
      if (isValid) {
        await this.prisma.apiToken.update({
          where: { id: token.id },
          data: { lastUsedAt: new Date() },
        });
        const apiTokenDeviceScope =
          token.allowedDevices.length > 0
            ? token.allowedDevices.map((d) => d.deviceId)
            : undefined;
        return { userId: token.userId, apiTokenDeviceScope };
      }
    }

    throw new UnauthorizedException('Invalid API token');
  }
}
