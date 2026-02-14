import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateOAuthUser(oauthData: {
    oauthId: string;
    email: string;
    name?: string;
    provider: string;
  }) {
    let user = await this.prisma.user.findUnique({
      where: { oauthId: oauthData.oauthId },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          oauthId: oauthData.oauthId,
          email: oauthData.email,
          name: oauthData.name,
          provider: oauthData.provider,
        },
      });
    } else {
      // Update user info
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: oauthData.email,
          name: oauthData.name || user.name,
        },
      });
    }

    return user;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async generateDeviceSecret(): Promise<string> {
    return crypto.randomBytes(32).toString('hex');
  }
}
