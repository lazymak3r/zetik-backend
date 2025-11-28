import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateProviderDeveloperDto {
  @ApiProperty({ description: 'Whether the provider is enabled', required: false })
  @IsBoolean()
  enabled?: boolean;
}
