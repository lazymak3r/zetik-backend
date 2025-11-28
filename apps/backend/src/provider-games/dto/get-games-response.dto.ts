import { ApiProperty } from '@nestjs/swagger';
import { IGameEntity } from '../interfaces/game.interface';

export interface IGetGamesResponse {
  games: IGameEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class GetGamesResponseDto implements IGetGamesResponse {
  @ApiProperty({ type: 'array', description: 'List of games' })
  games!: IGameEntity[];

  @ApiProperty({ description: 'Total number of games matching the filter' })
  total!: number;

  @ApiProperty({ description: 'Current page number' })
  page!: number;

  @ApiProperty({ description: 'Items per page' })
  limit!: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages!: number;
}
