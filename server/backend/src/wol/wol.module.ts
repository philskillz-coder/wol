import { Module } from '@nestjs/common';
import { WolService } from './wol.service';
import { WolController } from './wol.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { ApiTokensModule } from '../api-tokens/api-tokens.module';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, WebSocketModule, ApiTokensModule, PassportModule, AuthModule],
  controllers: [WolController],
  providers: [WolService],
  exports: [WolService],
})
export class WolModule {}
