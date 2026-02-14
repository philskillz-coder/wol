import { Module } from '@nestjs/common';
import { StatusService } from './status.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [PrismaModule, WebSocketModule],
  providers: [StatusService],
  exports: [StatusService],
})
export class StatusModule {}
