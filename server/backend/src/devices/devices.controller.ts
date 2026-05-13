import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { JwtOrApiTokenGuard } from '../auth/guards/jwt-or-api-token.guard';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @UseGuards(JwtOrApiTokenGuard)
  create(@Request() req, @Body() createDeviceDto: CreateDeviceDto) {
    const userId = req.user.id;
    const scope = req.user.apiTokenDeviceScope as string[] | undefined;
    return this.devicesService.create(userId, createDeviceDto, scope);
  }

  @Get()
  @UseGuards(JwtOrApiTokenGuard)
  findAll(@Request() req) {
    const userId = req.user.id;
    const scope = req.user.apiTokenDeviceScope as string[] | undefined;
    return this.devicesService.findAll(userId, scope);
  }

  @Get(':id')
  @UseGuards(JwtOrApiTokenGuard)
  findOne(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    const scope = req.user.apiTokenDeviceScope as string[] | undefined;
    return this.devicesService.findOne(id, userId, scope);
  }

  @Patch(':id')
  @UseGuards(JwtOrApiTokenGuard)
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDeviceDto: UpdateDeviceDto,
  ) {
    const userId = req.user.id;
    const scope = req.user.apiTokenDeviceScope as string[] | undefined;
    return this.devicesService.update(id, userId, updateDeviceDto, scope);
  }

  @Delete(':id')
  @UseGuards(JwtOrApiTokenGuard)
  remove(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    const scope = req.user.apiTokenDeviceScope as string[] | undefined;
    return this.devicesService.remove(id, userId, scope);
  }

  @Get(':id/config')
  @UseGuards(JwtOrApiTokenGuard)
  generateConfig(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    const scope = req.user.apiTokenDeviceScope as string[] | undefined;
    return this.devicesService.generateConfig(id, userId, scope);
  }

  @Post(':id/regenerate-secret')
  @UseGuards(JwtOrApiTokenGuard)
  regenerateSecret(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    const scope = req.user.apiTokenDeviceScope as string[] | undefined;
    return this.devicesService.regenerateSecret(id, userId, scope);
  }
}
