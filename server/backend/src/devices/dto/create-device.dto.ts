import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { DeviceMode } from '../../types/enums';

export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  macAddress: string;

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsEnum(DeviceMode)
  @IsOptional()
  mode?: DeviceMode;
}
