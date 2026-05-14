import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { existsSync } from 'fs';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { WebSocketModule } from './websocket/websocket.module';
import { StatusModule } from './status/status.module';
import { ApiTokensModule } from './api-tokens/api-tokens.module';
import { WolModule } from './wol/wol.module';

const envFileCandidates = [
  join(process.cwd(), '.env'),
  join(process.cwd(), '..', '.env'),
  join(__dirname, '..', '.env'),
  join(__dirname, '..', '..', '.env'),
];
const envFilePath = [...new Set(envFileCandidates.filter((p) => existsSync(p)))];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ...(envFilePath.length ? { envFilePath } : {}),
    }),
    PrismaModule,
    AuthModule,
    DevicesModule,
    WebSocketModule,
    StatusModule,
    ApiTokensModule,
    WolModule,
  ],
})
export class AppModule {}
