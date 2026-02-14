import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ApiTokensService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createApiTokenDto: CreateApiTokenDto) {
    // Generate a random token
    const plainToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(plainToken, 10);

    const token = await this.prisma.apiToken.create({
      data: {
        name: createApiTokenDto.name,
        token: hashedToken,
        userId,
        expiresAt: createApiTokenDto.expiresAt,
      },
    });

    // Return the plain token only once (for user to save)
    return {
      id: token.id,
      name: token.name,
      token: `wol_${plainToken}`, // Prefix for identification
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
    };
  }

  async findAll(userId: string) {
    return this.prisma.apiToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
      },
    });
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

  async validateToken(bearerToken: string): Promise<string> {
    // Remove 'wol_' prefix if present
    const plainToken = bearerToken.startsWith('wol_') 
      ? bearerToken.substring(4) 
      : bearerToken;

    // Find all tokens and check if any matches
    const now = new Date();
    const tokens = await this.prisma.apiToken.findMany({
      where: {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      include: {
        user: true,
      },
    });

    for (const token of tokens) {
      const isValid = await bcrypt.compare(plainToken, token.token);
      if (isValid) {
        // Update lastUsedAt
        await this.prisma.apiToken.update({
          where: { id: token.id },
          data: { lastUsedAt: new Date() },
        });
        return token.userId;
      }
    }

    throw new UnauthorizedException('Invalid API token');
  }
}
