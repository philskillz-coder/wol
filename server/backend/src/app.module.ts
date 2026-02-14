import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { WebSocketModule } from './websocket/websocket.module';
import { StatusModule } from './status/status.module';
import { LogsModule } from './logs/logs.module';
import { ApiTokensModule } from './api-tokens/api-tokens.module';
import { WolModule } from './wol/wol.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    DevicesModule,
    WebSocketModule,
    StatusModule,
    LogsModule,
    ApiTokensModule,
    WolModule,
  ],
})
export class AppModule {}
