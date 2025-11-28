import { ApiProperty } from '@nestjs/swagger';
import { IDeveloperWithCount } from '../interfaces/developer-with-count.interface';

export interface IGetDevelopersResponse {
  developers: IDeveloperWithCount[];
}

export class DeveloperWithCountDto implements IDeveloperWithCount {
  @ApiProperty({ description: 'Developer name' })
  name!: string;

  @ApiProperty({ description: 'Developer code' })
  code!: string;

  @ApiProperty({
    description: 'Restricted territories',
    required: false,
    type: [String],
    default: [],
  })
  restrictedTerritories?: string[];

  @ApiProperty({
    description: 'Prohibited territories',
    required: false,
    type: [String],
    default: [],
  })
  prohibitedTerritories?: string[];

  @ApiProperty({ description: 'Developer games', type: 'array' })
  games!: any[];

  @ApiProperty({ description: 'Number of games by this developer' })
  gamesCount!: number;
}

export class GetDevelopersResponseDto implements IGetDevelopersResponse {
  @ApiProperty({
    type: [DeveloperWithCountDto],
    description: 'List of developers with game counts',
  })
  developers!: IDeveloperWithCount[];
}
