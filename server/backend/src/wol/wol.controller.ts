import { Controller, Post, Param, UseGuards, Request } from '@nestjs/common';
import { WolService } from './wol.service';
import { JwtOrApiTokenGuard } from '../auth/guards/jwt-or-api-token.guard';

@Controller('wol')
export class WolController {
  constructor(private readonly wolService: WolService) {}

  @Post(':deviceId/wake')
  @UseGuards(JwtOrApiTokenGuard)
  async wake(@Request() req, @Param('deviceId') deviceId: string) {
    const userId = req.user.id;
    const scope = req.user.apiTokenDeviceScope as string[] | undefined;
    const success = await this.wolService.wakeDevice(deviceId, userId, scope);
    return { success, message: 'Wake signal sent' };
  }

  @Post(':deviceId/shutdown')
  @UseGuards(JwtOrApiTokenGuard)
  async shutdown(@Request() req, @Param('deviceId') deviceId: string) {
    const userId = req.user.id;
    const scope = req.user.apiTokenDeviceScope as string[] | undefined;
    const success = await this.wolService.shutdownDevice(deviceId, userId, scope);
    return {
      success,
      message: success ? 'Shutdown command sent' : 'Device not connected',
    };
  }
}
