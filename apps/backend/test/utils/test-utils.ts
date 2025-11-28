import {
  ProviderCategoryEntity,
  ProviderDeveloperEntity,
  ProviderGameEntity,
} from '@zetik/shared-entities';
import { DataSource } from 'typeorm';

export interface ITestGame {
  code: string;
  name: string;
  enabled: boolean;
  developerName: string;
  categoryName: string;
  bonusTypes?: string[];
  themes?: string[];
  features?: string[];
  rtp?: string;
  volatility?: string;
  maxPayoutCoeff?: string;
  hitRatio?: string;
  funMode: boolean;
  releaseDate: Date;
  deprecationDate?: Date | null;
}

export interface ITestCategory {
  name: string;
  type: string;
}

export interface ITestDeveloper {
  name: string;
  code: string;
  restrictedTerritories?: string[];
  prohibitedTerritories?: string[];
}

export async function seedTestDatabase(
  dataSource: DataSource,
  categories: ITestCategory[] = [],
  developers: ITestDeveloper[] = [],
  games: ITestGame[] = [],
): Promise<void> {
  const categoryRepo = dataSource.getRepository(ProviderCategoryEntity);
  const developerRepo = dataSource.getRepository(ProviderDeveloperEntity);
  const gameRepo = dataSource.getRepository(ProviderGameEntity);

  for (const categoryData of categories) {
    const category = categoryRepo.create(categoryData);
    await categoryRepo.save(category);
  }

  for (const developerData of developers) {
    const developer = developerRepo.create(developerData);
    await developerRepo.save(developer);
  }

  for (const gameData of games) {
    const game = gameRepo.create(gameData);
    await gameRepo.save(game);
  }
}

export const defaultTestData = {
  categories: [
    { name: 'Video Slots', type: 'rng' },
    { name: 'Table Games', type: 'rng' },
    { name: 'Live Casino', type: 'live' },
  ],
  developers: [
    {
      name: 'Red Tiger',
      code: 'rtg',
      restrictedTerritories: [],
      prohibitedTerritories: ['GB', 'US'],
    },
    {
      name: 'Evolution Games',
      code: 'evo',
      restrictedTerritories: ['DE'],
      prohibitedTerritories: [],
    },
  ],
  games: [
    {
      code: 'rtg_primate_king',
      name: 'Primate King',
      enabled: true,
      developerName: 'Red Tiger',
      categoryName: 'Video Slots',
      bonusTypes: ['free_bets'],
      themes: ['Jungle', 'Adventure'],
      features: ['In-game Freespins', 'Bonus Game'],
      rtp: '97.54',
      volatility: '3.00',
      maxPayoutCoeff: '3950.43',
      hitRatio: '23.3',
      funMode: true,
      releaseDate: new Date('2020-01-01'),
      deprecationDate: null,
    },
    {
      code: 'evo_blackjack',
      name: 'Blackjack Pro',
      enabled: true,
      developerName: 'Evolution Games',
      categoryName: 'Table Games',
      bonusTypes: [],
      themes: ['Classic'],
      features: [],
      rtp: '99.54',
      volatility: '1.50',
      maxPayoutCoeff: '2.0',
      hitRatio: '46.0',
      funMode: false,
      releaseDate: new Date('2019-05-15'),
      deprecationDate: null,
    },
  ],
};
