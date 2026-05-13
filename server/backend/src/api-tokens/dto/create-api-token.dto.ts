import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsArray,
} from 'class-validator';

export class CreateApiTokenDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: Date;

  /** If non-empty, the token may only wake/shutdown and manage these devices. Omit for full access. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deviceIds?: string[];
}
