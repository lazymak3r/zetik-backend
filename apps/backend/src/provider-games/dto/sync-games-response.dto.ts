import { ApiProperty } from '@nestjs/swagger';

export interface ISyncGamesResponse {
  status: string;
  message: string;
}

export class SyncGamesResponseDto implements ISyncGamesResponse {
  @ApiProperty({ description: 'Status of the sync operation' })
  status!: string;

  @ApiProperty({ description: 'Detailed message about the sync operation' })
  message!: string;
}
