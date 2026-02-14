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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTokenGuard } from '../auth/guards/api-token.guard';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Request() req, @Body() createDeviceDto: CreateDeviceDto) {
    const userId = req.user.id;
    return this.devicesService.create(userId, createDeviceDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Request() req) {
    const userId = req.user.id;
    return this.devicesService.findAll(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.devicesService.findOne(id, userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDeviceDto: UpdateDeviceDto,
  ) {
    const userId = req.user.id;
    return this.devicesService.update(id, userId, updateDeviceDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.devicesService.remove(id, userId);
  }

  @Get(':id/config')
  @UseGuards(JwtAuthGuard)
  generateConfig(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.devicesService.generateConfig(id, userId);
  }
}
