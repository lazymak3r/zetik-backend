import { ApiProperty } from '@nestjs/swagger';
import { IGameEntity } from '../interfaces/game.interface';

export interface IGetProviderFavoritesResponse {
  games: IGameEntity[];
}

export class GetProviderFavoritesResponseDto implements IGetProviderFavoritesResponse {
  @ApiProperty({
    type: 'array',
    description: 'Array of favorite provider games with full details',
    items: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        name: { type: 'string' },
        enabled: { type: 'boolean' },
        developerName: { type: 'string' },
        categoryName: { type: 'string' },
        developer: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            code: { type: 'string' },
            restrictedTerritories: { type: 'array', items: { type: 'string' } },
            prohibitedTerritories: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        category: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        bonusTypes: { type: 'array', items: { type: 'string' } },
        themes: { type: 'array', items: { type: 'string' } },
        features: { type: 'array', items: { type: 'string' } },
        rtp: { type: 'string', nullable: true },
        volatility: { type: 'string', nullable: true },
        maxPayoutCoeff: { type: 'string', nullable: true },
        hitRatio: { type: 'string', nullable: true },
        funMode: { type: 'boolean' },
        releaseDate: { type: 'string', format: 'date-time', nullable: true },
        deprecationDate: { type: 'string', format: 'date-time', nullable: true },
        restrictedTerritories: { type: 'array', items: { type: 'string' } },
        prohibitedTerritories: { type: 'array', items: { type: 'string' } },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  games!: IGameEntity[];
}
