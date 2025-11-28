import { ApiProperty } from '@nestjs/swagger';
import { IGameEntity } from '../interfaces/game.interface';

export interface IGetGameResponse {
  game: IGameEntity | null;
}

export class GetGameResponseDto implements IGetGameResponse {
  @ApiProperty({ nullable: true, description: 'Game details' })
  game!: IGameEntity | null;
}
