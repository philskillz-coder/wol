import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTokensService } from './api-tokens.service';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api-tokens')
@UseGuards(JwtAuthGuard)
export class ApiTokensController {
  constructor(private readonly apiTokensService: ApiTokensService) {}

  @Post()
  create(@Request() req, @Body() createApiTokenDto: CreateApiTokenDto) {
    const userId = req.user.id;
    return this.apiTokensService.create(userId, createApiTokenDto);
  }

  @Get()
  findAll(@Request() req) {
    const userId = req.user.id;
    return this.apiTokensService.findAll(userId);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.apiTokensService.remove(id, userId);
  }
}
