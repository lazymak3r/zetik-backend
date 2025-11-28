import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProviderGameDto {
  @ApiProperty({ description: 'Game description', nullable: true, required: false })
  @IsOptional()
  @IsString()
  description?: string | null;
}
