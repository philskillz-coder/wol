import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CreateApiTokenDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: Date;
}
