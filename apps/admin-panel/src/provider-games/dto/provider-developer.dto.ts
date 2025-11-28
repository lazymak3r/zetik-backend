import { ApiProperty } from '@nestjs/swagger';

export class ProviderDeveloperDto {
  @ApiProperty({ description: 'Display name of the provider developer' })
  name!: string;

  @ApiProperty({ description: 'Unique code used to reference the developer', example: 'pragmatic' })
  code!: string;

  @ApiProperty({ description: 'Number of games supplied by the developer' })
  gamesCount!: number;

  @ApiProperty({ description: 'Whether the provider is enabled', default: true })
  enabled!: boolean;
}

export class ProviderDevelopersResponseDto {
  @ApiProperty({ type: [ProviderDeveloperDto] })
  developers!: ProviderDeveloperDto[];
}
