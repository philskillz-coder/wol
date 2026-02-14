import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthentikStrategy } from './strategies/authentik.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { ApiTokensModule } from '../api-tokens/api-tokens.module';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    ApiTokensModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AuthentikStrategy],
  exports: [AuthService],
})
export class AuthModule {}
