import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthentikStrategy } from './strategies/authentik.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtOrApiTokenGuard } from './guards/jwt-or-api-token.guard';
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
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET')?.trim();
        if (!secret) {
          throw new Error(
            'JWT_SECRET is not set. Add it to server/.env or server/backend/.env.',
          );
        }
        return {
          secret,
          signOptions: {
            // expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d',
            expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '7d') as any,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AuthentikStrategy, JwtAuthGuard, JwtOrApiTokenGuard],
  exports: [
    AuthService,
    JwtAuthGuard,
    JwtOrApiTokenGuard,
    JwtModule,
    ApiTokensModule,
  ],
})
export class AuthModule {}
